-- Org + RBAC foundation (chantier 1a): multi-tenant organizations, a
-- cumulative many-to-many role model, and email invitations. See
-- docs/superpowers/specs/2026-07-29-org-rbac-foundation-design.md.
--
-- profiles.role ('user'|'admin', pages_cms_foundation.sql) is untouched —
-- it gates the marketing/site CMS and is unrelated to org-scoped roles.

-- ── organizations ────────────────────────────────────────────────────────
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(trim(name)) between 1 and 160),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

-- ── user_org_roles : many-to-many, a user can hold several roles across orgs ─
create table if not exists public.user_org_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  org_id     uuid not null references public.organizations(id) on delete cascade,
  role       text not null check (role in ('learner','trainer','pedago','registrar','admin')),
  created_at timestamptz not null default now(),
  unique (user_id, org_id, role)
);
create index if not exists user_org_roles_user_idx on public.user_org_roles(user_id);
create index if not exists user_org_roles_org_idx on public.user_org_roles(org_id);

-- ── org_invitations : admin/pedago-issued, single-use, expiring ────────────
create table if not exists public.org_invitations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  email      text not null,
  role       text not null check (role in ('learner','trainer','pedago','registrar','admin')),
  invited_by uuid not null references auth.users(id),
  token      uuid not null default gen_random_uuid() unique,
  status     text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);
create index if not exists org_invitations_org_idx on public.org_invitations(org_id);

-- ── has_org_role() : mirrors is_admin() (pages_cms_foundation.sql) ─────────
create or replace function public.has_org_role(p_org_id uuid, p_roles text[])
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_org_roles
    where user_id = auth.uid() and org_id = p_org_id and role = any(p_roles)
  );
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.organizations enable row level security;
alter table public.user_org_roles enable row level security;
alter table public.org_invitations enable row level security;

-- organizations: member read only. No client insert/update/delete — the only
-- writer is create_organization() below (mirrors manual_evaluations' "all
-- writes go through security-definer functions" pattern).
drop policy if exists organizations_member_read on public.organizations;
create policy organizations_member_read on public.organizations
  for select using (
    exists (select 1 from public.user_org_roles r where r.org_id = organizations.id and r.user_id = auth.uid())
  );

-- user_org_roles: a user reads their own memberships; an org admin reads the
-- whole roster. No client insert/update/delete — writes only via
-- create_organization() / accept_org_invitation() below.
drop policy if exists user_org_roles_self_or_admin_read on public.user_org_roles;
create policy user_org_roles_self_or_admin_read on public.user_org_roles
  for select using (
    user_id = auth.uid() or public.has_org_role(org_id, array['admin'])
  );

-- org_invitations: admin/pedago of the target org manage the full lifecycle
-- (list/create/revoke). Acceptance bypasses this via accept_org_invitation()
-- since the invitee isn't an org member yet.
drop policy if exists org_invitations_manage on public.org_invitations;
create policy org_invitations_manage on public.org_invitations
  for all using (public.has_org_role(org_id, array['admin','pedago']))
  with check (public.has_org_role(org_id, array['admin','pedago']));

-- ── create_organization() : self-serve signup, atomic org + admin role ─────
create or replace function public.create_organization(p_name text, p_slug text)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 1 then
    raise exception 'Organization name is required';
  end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Invalid slug format';
  end if;

  insert into public.organizations (name, slug)
  values (trim(p_name), p_slug)
  returning * into result;

  insert into public.user_org_roles (user_id, org_id, role)
  values (auth.uid(), result.id, 'admin');

  return result;
exception
  when unique_violation then
    raise exception 'slug_taken';
end;
$$;

revoke all on function public.create_organization(text, text) from public;
grant execute on function public.create_organization(text, text) to authenticated;

-- ── accept_org_invitation() : consumes a token, adds the role ──────────────
create or replace function public.accept_org_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.org_invitations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into invitation
  from public.org_invitations
  where token = p_token
  for update;

  if invitation.id is null then
    raise exception 'Invitation not found';
  end if;
  if invitation.status <> 'pending' then
    raise exception 'invitation_%', invitation.status;
  end if;
  if invitation.expires_at < now() then
    update public.org_invitations set status = 'expired' where id = invitation.id;
    raise exception 'invitation_expired';
  end if;

  insert into public.user_org_roles (user_id, org_id, role)
  values (auth.uid(), invitation.org_id, invitation.role)
  on conflict (user_id, org_id, role) do nothing;

  update public.org_invitations set status = 'accepted' where id = invitation.id;

  return invitation.org_id;
end;
$$;

revoke all on function public.accept_org_invitation(uuid) from public;
grant execute on function public.accept_org_invitation(uuid) to authenticated;

-- ── get_invitation_preview() : lets the (possibly logged-out) invite ───────
-- landing page show "you're invited to <org> as <role>" before login/signup.
create or replace function public.get_invitation_preview(p_token uuid)
returns table(org_name text, role text, email text, status text)
language sql
security definer
stable
set search_path = public
as $$
  select o.name, i.role, i.email, i.status
  from public.org_invitations i
  join public.organizations o on o.id = i.org_id
  where i.token = p_token;
$$;

revoke all on function public.get_invitation_preview(uuid) from public;
grant execute on function public.get_invitation_preview(uuid) to anon, authenticated;

-- ── bootstrap : every pre-existing user becomes admin of one "Brivia" org ──
-- Idempotent: re-running this migration never duplicates the org or the
-- role rows (mirrors exam_scoring_tier2.sql's retry-safe convention).
insert into public.organizations (name, slug)
select 'Brivia', 'brivia'
where not exists (select 1 from public.organizations where slug = 'brivia');

insert into public.user_org_roles (user_id, org_id, role)
select u.id, o.id, 'admin'
from auth.users u
cross join (select id from public.organizations where slug = 'brivia') o
on conflict (user_id, org_id, role) do nothing;
