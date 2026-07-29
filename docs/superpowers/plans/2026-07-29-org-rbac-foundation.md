# Org + RBAC Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-tenant organizations with a cumulative role model (learner/trainer/pedago/registrar/admin), retrofit existing content tables into it without breaking any existing user, and ship self-serve org creation + email invitations.

**Architecture:** Three sequential Supabase migrations (core org/role tables → content retrofit with auto-fill triggers → `groups`/`group_members` rename), one new Resend-backed edge function, and a handful of focused React components/pages wired into the existing router. Every existing user is migrated into one bootstrap org ("Brivia") as `admin`, so no existing flow breaks.

**Tech Stack:** Supabase (Postgres + RLS + Edge Functions/Deno), React + React Router, Vitest, Resend.

Spec: `docs/superpowers/specs/2026-07-29-org-rbac-foundation-design.md`

---

### Task 1: Core org/role migration

**Files:**
- Create: `supabase/migrations/20260730120000_org_rbac_foundation.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply and verify**

Run: `cd supabase && supabase db reset`
Expected: migration applies with no errors.

Then in `supabase db psql`:
```sql
select slug, name from organizations;                          -- one row: brivia
select count(*) from user_org_roles where role = 'admin';      -- one per existing auth.users row
select has_org_role(id, array['admin']) from organizations;    -- verify function is callable
```

Then verify idempotency (the bootstrap block must be safely re-runnable, same convention as `exam_scoring_tier2.sql`): re-run the migration's bootstrap SQL block (the final `insert into organizations ... where not exists` + `insert into user_org_roles ... on conflict do nothing`) a second time directly in `supabase db psql`.
Expected: `select count(*) from organizations where slug = 'brivia';` still returns 1, and `select count(*) from user_org_roles;` is unchanged — no duplicates.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260730120000_org_rbac_foundation.sql
git commit -m "feat: org + RBAC foundation tables, roles, invitations"
```

---

### Task 2: Content retrofit — org_id on existing tables

**Files:**
- Create: `supabase/migrations/20260730130000_org_content_retrofit.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Retrofit org_id onto every pre-existing content table (chantier 1b).
-- Three auto-fill triggers cover every insert path so no existing
-- application code (or security-definer function) needs to change to keep
-- inserting rows: today every user has exactly one org (Brivia), so the
-- fallback always resolves correctly.

-- set_default_org_id: for rows inserted by an authenticated *actor* acting
-- for themself (content, folders, exams, quiz_attempts, content_shares,
-- manual_evaluations, manual_evaluation_groups, manual_grades). Falls back
-- to the caller's first (oldest) org membership when org_id isn't supplied.
create or replace function public.set_default_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select org_id into new.org_id
    from public.user_org_roles
    where user_id = auth.uid()
    order by created_at
    limit 1;
  end if;
  return new;
end;
$$;

-- set_target_user_org_id: for rows inserted *about* another user by a
-- trigger (notifications, notification_preferences) — org must follow the
-- row's own user_id, not auth.uid() of whoever triggered the insert.
create or replace function public.set_target_user_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select org_id into new.org_id
    from public.user_org_roles
    where user_id = new.user_id
    order by created_at
    limit 1;
  end if;
  return new;
end;
$$;

-- set_exam_attempt_org_id: exam_attempts participants are frequently
-- anonymous (client-generated participant_id, not auth.uid() — see
-- exam_tables.sql), so org_id must come from the parent exam, not the actor.
create or replace function public.set_exam_attempt_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select org_id into new.org_id from public.exams where id = new.exam_id;
  end if;
  return new;
end;
$$;

-- ── per-table: add column, backfill, enforce not null, index, trigger ──────
do $$
declare
  brivia_id uuid;
  t text;
  actor_tables text[] := array[
    'content', 'folders', 'exams', 'quiz_attempts', 'content_shares',
    'manual_evaluations', 'manual_evaluation_groups', 'manual_grades'
  ];
  target_user_tables text[] := array['notifications', 'notification_preferences'];
begin
  select id into brivia_id from public.organizations where slug = 'brivia';

  foreach t in array actor_tables || target_user_tables || array['exam_attempts']
  loop
    execute format('alter table public.%I add column if not exists org_id uuid references public.organizations(id)', t);
    execute format('update public.%I set org_id = %L where org_id is null', t, brivia_id);
    execute format('alter table public.%I alter column org_id set not null', t);
    execute format('create index if not exists %I on public.%I(org_id)', t || '_org_idx', t);
  end loop;

  foreach t in array actor_tables
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_org_id', t);
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.set_default_org_id()',
      t || '_set_org_id', t
    );
  end loop;

  foreach t in array target_user_tables
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_org_id', t);
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.set_target_user_org_id()',
      t || '_set_org_id', t
    );
  end loop;

  execute 'drop trigger if exists exam_attempts_set_org_id on public.exam_attempts';
  execute 'create trigger exam_attempts_set_org_id before insert on public.exam_attempts for each row execute function public.set_exam_attempt_org_id()';
end $$;

-- ── role-gate exam creation : trainer/pedago/admin only ────────────────────
-- The only RLS change beyond adding org_id: every other existing policy
-- (owner-only reads/writes) already provides the correct security boundary,
-- so org_id there is data-model-only for now (UI-level per-persona gating is
-- a separate future sub-project — see spec's Non-goals). Exam creation is
-- named explicitly in the spec and is safe to gate today: every existing
-- user is 'admin' of the bootstrap org from Task 1, so nothing breaks.
drop policy if exists exams_owner_insert on public.exams;
create policy exams_owner_insert on public.exams
  for insert with check (
    host_id = auth.uid() and public.has_org_role(org_id, array['trainer','pedago','admin'])
  );
```

- [ ] **Step 2: Apply and verify**

Run: `cd supabase && supabase db reset`
Expected: migration applies with no errors.

Then in `supabase db psql`:
```sql
\d content            -- org_id uuid not null, indexed, FK to organizations
\d exam_attempts      -- org_id uuid not null

-- confirm the exam-derived backfill actually worked (not just brivia-default):
select e.org_id = a.org_id from exams e join exam_attempts a on a.exam_id = e.id limit 5;
-- (true for existing rows since everything is in brivia today anyway; the
-- meaningful check is that the trigger exists and fires correctly — see
-- Task 11's insert smoke test)
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260730130000_org_content_retrofit.sql
git commit -m "feat: retrofit org_id onto existing content tables"
```

---

### Task 3: Rename `groups`/`group_members` → `share_groups`/`share_group_members`

**Files:**
- Create: `supabase/migrations/20260730140000_rename_share_groups.sql`

Context: `groups`/`group_members` (course_sharing.sql) mean content-sharing groups, a different concept from the future "groupe pédagogique/promotion" (scolarité, out of scope). Renaming now frees the name. Exhaustive search found every object whose body textually references the old names — table rename does **not** rewrite function/policy body text, so each must be redefined.

- [ ] **Step 1: Write the migration**

```sql
-- Rename groups/group_members to share_groups/share_group_members to free
-- the "groups" name for the future scolarité "groupe pédagogique" concept.
-- Renaming a table doesn't rewrite the text of dependent function bodies or
-- policy USING/WITH CHECK clauses, so every object below that textually
-- referenced public.groups / public.group_members is redefined pointing at
-- the new names. TypeScript type names (Group, GroupMember) are unchanged —
-- only the underlying table names move.

alter table public.groups rename to share_groups;
alter table public.group_members rename to share_group_members;

alter index if exists groups_owner_idx rename to share_groups_owner_idx;
alter index if exists group_members_group_idx rename to share_group_members_group_idx;
alter index if exists group_members_user_idx rename to share_group_members_user_idx;

-- ── policies referencing the old names ──────────────────────────────────
drop policy if exists group_members_owner on public.share_group_members;
create policy group_members_owner on public.share_group_members
  for all using (
    exists (select 1 from public.share_groups g where g.id = group_id and g.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.share_groups g where g.id = group_id and g.owner_id = auth.uid())
  );

drop policy if exists content_shares_owner on public.content_shares;
create policy content_shares_owner on public.content_shares
  for all using (
    exists (select 1 from public.content c where c.id = content_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.content c where c.id = content_id and c.user_id = auth.uid())
    and (shared_with_group_id is null or exists (select 1 from public.share_groups g where g.id = shared_with_group_id and g.owner_id = auth.uid()))
  );

drop policy if exists content_shares_group_read on public.content_shares;
create policy content_shares_group_read on public.content_shares
  for select using (
    shared_with_group_id in (select group_id from public.share_group_members where user_id = auth.uid())
  );

drop policy if exists content_public_read on public.content;
create policy content_public_read on public.content
  for select using (
    is_public = true or is_open = true
    or exists (
      select 1 from public.content_shares cs
      where cs.content_id = content.id
        and (cs.shared_with_user_id = auth.uid()
             or cs.shared_with_group_id in (select group_id from public.share_group_members where user_id = auth.uid()))
    )
  );

-- ── functions referencing the old names ─────────────────────────────────
create or replace function public.resolve_group_member(p_group_id uuid, p_email text)
returns public.share_group_members
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  result public.share_group_members;
begin
  if not exists (select 1 from public.share_groups where id = p_group_id and owner_id = auth.uid()) then
    raise exception 'Not the owner of this group';
  end if;

  select u.id into target_user_id from auth.users u where u.email = p_email;

  if target_user_id is not null then
    insert into public.share_group_members (group_id, user_id)
    values (p_group_id, target_user_id)
    on conflict (group_id, user_id) do nothing
    returning * into result;
  else
    insert into public.share_group_members (group_id, pending_email)
    values (p_group_id, p_email)
    on conflict (group_id, pending_email) do nothing
    returning * into result;
  end if;

  return result;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text := coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1));
  candidate text := base_username;
  suffix int := 1;
begin
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base_username || '-' || suffix;
  end loop;

  insert into public.profiles (id, username) values (new.id, candidate)
  on conflict (id) do nothing;

  update public.share_group_members set user_id = new.id, pending_email = null where pending_email = new.email;
  update public.content_shares set shared_with_user_id = new.id, pending_email = null where pending_email = new.email;

  return new;
end;
$$;

create or replace function public.update_collaborative_content(
  p_content_id uuid,
  p_data jsonb
)
returns public.content
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.content;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    exists (
      select 1 from public.content c
      where c.id = p_content_id and c.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.content_shares cs
      where cs.content_id = p_content_id
        and cs.permission = 'editor'
        and (
          cs.shared_with_user_id = auth.uid()
          or cs.shared_with_group_id in (
            select gm.group_id
            from public.share_group_members gm
            where gm.user_id = auth.uid()
          )
        )
    )
  ) then
    raise exception 'Edit access required';
  end if;

  update public.content
  set data = p_data
  where id = p_content_id
  returning * into result;

  if result.id is null then
    raise exception 'Content not found';
  end if;

  return result;
end;
$$;

create or replace function public.notify_content_share()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  content_title text;
  content_type text;
begin
  if tg_op = 'UPDATE'
     and old.shared_with_user_id is not distinct from new.shared_with_user_id
     and old.shared_with_group_id is not distinct from new.shared_with_group_id
     and old.permission is not distinct from new.permission then
    return new;
  end if;

  select coalesce(c.data->>'title', 'Un contenu'), c.type
  into content_title, content_type
  from public.content c
  where c.id = new.content_id;

  if new.shared_with_user_id is not null
     and public.notification_category_enabled(new.shared_with_user_id, 'share') then
    insert into public.notifications(user_id, category, title, body, action_url, metadata)
    values (
      new.shared_with_user_id,
      'share',
      'Un contenu a été partagé avec vous',
      content_title || case when new.permission = 'editor' then ' · accès en modification' else ' · accès en lecture' end,
      '/shared-with-me',
      jsonb_build_object('content_id', new.content_id, 'content_type', content_type, 'permission', new.permission)
    );
  elsif new.shared_with_group_id is not null then
    insert into public.notifications(user_id, category, title, body, action_url, metadata)
    select
      gm.user_id,
      'share',
      'Un contenu a été partagé avec votre groupe',
      content_title || case when new.permission = 'editor' then ' · accès en modification' else ' · accès en lecture' end,
      '/shared-with-me',
      jsonb_build_object('content_id', new.content_id, 'content_type', content_type, 'permission', new.permission)
    from public.share_group_members gm
    where gm.group_id = new.shared_with_group_id
      and gm.user_id is not null
      and public.notification_category_enabled(gm.user_id, 'share');
  end if;
  return new;
end;
$$;

create or replace function public.create_manual_evaluation(
  p_name text,
  p_description text,
  p_context_label text,
  p_content_id uuid,
  p_grading_type text,
  p_minimum_score numeric,
  p_maximum_score numeric,
  p_decimal_places smallint,
  p_pass_threshold numeric,
  p_coefficient numeric,
  p_rounding_rule text,
  p_evaluation_date date,
  p_entry_deadline timestamptz,
  p_group_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_evaluation_id uuid;
  selected_group_count integer;
  owned_group_count integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 160 then
    raise exception 'Invalid evaluation name';
  end if;
  if p_grading_type not in ('numeric', 'validation') then
    raise exception 'Invalid grading type';
  end if;
  if p_maximum_score <= p_minimum_score then
    raise exception 'Maximum score must exceed minimum score';
  end if;
  if p_decimal_places not between 0 and 4 then
    raise exception 'Invalid decimal precision';
  end if;
  if p_coefficient <= 0 then raise exception 'Coefficient must be positive'; end if;
  if p_pass_threshold is not null
     and (p_pass_threshold < p_minimum_score or p_pass_threshold > p_maximum_score) then
    raise exception 'Pass threshold is outside the scale';
  end if;
  if p_rounding_rule not in ('none', 'tenth', 'half', 'integer') then
    raise exception 'Invalid rounding rule';
  end if;

  select count(*) into selected_group_count
  from (select distinct unnest(coalesce(p_group_ids, array[]::uuid[])) as id) selected;
  if selected_group_count = 0 then raise exception 'At least one group is required'; end if;

  select count(*) into owned_group_count
  from public.share_groups
  where owner_id = auth.uid()
    and id in (select distinct unnest(p_group_ids));
  if owned_group_count <> selected_group_count then
    raise exception 'One or more groups are not owned by the caller';
  end if;

  if p_content_id is not null and not exists (
    select 1 from public.content
    where id = p_content_id and user_id = auth.uid()
  ) then
    raise exception 'Linked content is not owned by the caller';
  end if;

  insert into public.manual_evaluations (
    owner_id, content_id, name, description, context_label, grading_type,
    minimum_score, maximum_score, decimal_places, pass_threshold, coefficient,
    rounding_rule, evaluation_date, entry_deadline
  )
  values (
    auth.uid(), p_content_id, trim(p_name), trim(coalesce(p_description, '')),
    trim(coalesce(p_context_label, '')), p_grading_type, p_minimum_score,
    p_maximum_score, p_decimal_places, p_pass_threshold, p_coefficient,
    p_rounding_rule, coalesce(p_evaluation_date, current_date), p_entry_deadline
  )
  returning id into new_evaluation_id;

  insert into public.manual_evaluation_groups(evaluation_id, group_id)
  select new_evaluation_id, id
  from (select distinct unnest(p_group_ids) as id) selected;

  return new_evaluation_id;
end;
$$;

create or replace function public.save_manual_grade(
  p_evaluation_id uuid,
  p_learner_id uuid,
  p_score numeric,
  p_validation_value text,
  p_attendance_status text,
  p_appreciation text,
  p_workflow_status text,
  p_expected_version integer,
  p_change_reason text
)
returns public.manual_grades
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  evaluation public.manual_evaluations;
  existing public.manual_grades;
  result public.manual_grades;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into evaluation
  from public.manual_evaluations
  where id = p_evaluation_id;
  if evaluation.id is null
     or (evaluation.owner_id <> auth.uid() and not public.is_admin()) then
    raise exception 'Not allowed to grade this evaluation';
  end if;

  select * into existing
  from public.manual_grades
  where evaluation_id = p_evaluation_id and learner_id = p_learner_id
  for update;

  if existing.id is null and not exists (
    select 1
    from public.manual_evaluation_groups assignment
    join public.share_group_members member on member.group_id = assignment.group_id
    where assignment.evaluation_id = p_evaluation_id
      and member.user_id = p_learner_id
  ) then
    raise exception 'Learner is not in an assigned group';
  end if;

  if p_attendance_status not in (
    'present', 'absent', 'absent_excused', 'absent_unexcused',
    'not_submitted', 'exempt', 'not_evaluated'
  ) then
    raise exception 'Invalid attendance status';
  end if;
  if p_workflow_status not in ('draft', 'published') then
    raise exception 'Invalid workflow status';
  end if;

  if p_attendance_status <> 'present' then
    p_score := null;
    p_validation_value := null;
  elsif evaluation.grading_type = 'numeric' then
    p_validation_value := null;
    if p_score is not null and (
      p_score < evaluation.minimum_score
      or p_score > evaluation.maximum_score
      or p_score <> round(p_score, evaluation.decimal_places)
    ) then
      raise exception 'Score is outside the configured scale or precision';
    end if;
    if p_workflow_status = 'published' and p_score is null then
      raise exception 'A numeric score is required before publication';
    end if;
  else
    p_score := null;
    if p_validation_value is not null
       and p_validation_value not in ('validated', 'not_validated', 'review', 'not_evaluated') then
      raise exception 'Invalid validation value';
    end if;
    if p_workflow_status = 'published' and p_validation_value is null then
      raise exception 'A validation value is required before publication';
    end if;
  end if;

  if existing.id is not null and existing.workflow_status = 'published'
     and char_length(trim(coalesce(p_change_reason, ''))) < 3 then
    raise exception 'A change reason is required for a published grade';
  end if;

  if existing.id is null then
    if coalesce(p_expected_version, 0) <> 0 then
      raise exception 'Grade version conflict';
    end if;
    insert into public.manual_grades (
      evaluation_id, learner_id, score, validation_value, attendance_status,
      appreciation, workflow_status, published_at, locked_at, version,
      last_edited_by, last_change_reason
    )
    values (
      p_evaluation_id, p_learner_id, p_score, p_validation_value,
      p_attendance_status, trim(coalesce(p_appreciation, '')), p_workflow_status,
      case when p_workflow_status = 'published' then now() end,
      case when p_workflow_status = 'published' then now() end,
      1, auth.uid(), trim(coalesce(p_change_reason, ''))
    )
    returning * into result;
  else
    update public.manual_grades
    set score = p_score,
        validation_value = p_validation_value,
        attendance_status = p_attendance_status,
        appreciation = trim(coalesce(p_appreciation, '')),
        workflow_status = p_workflow_status,
        published_at = case
          when p_workflow_status = 'published' then coalesce(published_at, now())
          else null
        end,
        locked_at = case when p_workflow_status = 'published' then now() else null end,
        version = version + 1,
        last_edited_by = auth.uid(),
        last_change_reason = trim(coalesce(p_change_reason, ''))
    where id = existing.id and version = p_expected_version
    returning * into result;

    if result.id is null then raise exception 'Grade version conflict'; end if;
  end if;

  return result;
end;
$$;
```

- [ ] **Step 2: Apply and verify**

Run: `cd supabase && supabase db reset`
Expected: migration applies with no errors.

Then in `supabase db psql`:
```sql
\d share_groups          -- exists; \d groups fails (relation does not exist)
\d share_group_members   -- exists
select proname from pg_proc where prosrc ilike '%public.groups%' or prosrc ilike '%public.group_members%';
-- Expected: 0 rows (nothing still textually references the old names)
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260730140000_rename_share_groups.sql
git commit -m "refactor: rename groups/group_members to share_groups/share_group_members"
```

---

### Task 4: Update `sharingRepo.ts` for the renamed tables

**Files:**
- Modify: `apps/app/src/lib/sharing/sharingRepo.ts:55-243`

- [ ] **Step 1: Update the seven `.from()` call sites**

In `apps/app/src/lib/sharing/sharingRepo.ts`, replace every `.from('groups')` with `.from('share_groups')` (3 occurrences: `listGroups`, `createGroup`, `deleteGroup`) and every `.from('group_members')` with `.from('share_group_members')` (4 occurrences: `listGroupMembers`, `addGroupMemberByUserId`, `removeGroupMember`, `listSharedWithMe`). TypeScript type/function names (`Group`, `GroupMember`, `listGroups`, etc.) stay exactly as-is — only the string table names change.

```typescript
export async function listGroups(ownerId: string): Promise<Group[]> {
  const { data, error } = await supabase
    .from('share_groups')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createGroup(ownerId: string, name: string): Promise<Group> {
  const { data, error } = await supabase
    .from('share_groups')
    .insert({ owner_id: ownerId, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from('share_groups').delete().eq('id', groupId);
  if (error) throw error;
}

export async function listGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('share_group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addGroupMemberByUserId(groupId: string, userId: string): Promise<GroupMember> {
  const { data, error } = await supabase
    .from('share_group_members')
    .insert({ group_id: groupId, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

```typescript
export async function removeGroupMember(memberId: string): Promise<void> {
  const { error } = await supabase.from('share_group_members').delete().eq('id', memberId);
  if (error) throw error;
}
```

```typescript
  const { data: myGroups, error: groupsError } = await supabase
    .from('share_group_members')
    .select('group_id')
    .eq('user_id', userId);
```

(This last snippet is inside `listSharedWithMe` — replace only the `.from('group_members')` call there; the rest of that function is unchanged.)

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Run existing sharing tests**

Run: `cd apps/app && npx vitest run src/lib/sharing/__tests__/sharingRepo.test.ts`
Expected: PASS (that test file only exercises the pure `mergeSharedContentIds` helper, unaffected by the table rename, but confirms nothing else broke on import).

- [ ] **Step 4: Commit**

```bash
git add apps/app/src/lib/sharing/sharingRepo.ts
git commit -m "refactor: point sharingRepo at renamed share_groups tables"
```

---

### Task 5: `send-org-invitation` edge function

**Files:**
- Create: `supabase/functions/send-org-invitation/index.ts`

Mirrors `supabase/functions/send-welcome-email/index.ts` exactly: same Resend env vars, same no-op-when-unconfigured behavior, same "verify the caller-supplied data actually matches a real row" guard (here: the invitation id/token/email must match a real pending `org_invitations` row) instead of trusting arbitrary input.

- [ ] **Step 1: Write the edge function**

```typescript
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

interface Body {
  invitationId: string;
  inviteUrl: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const { invitationId, inviteUrl }: Body = await req.json();
    if (!invitationId || !inviteUrl) return jsonResponse({ error: "invalid_payload" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Bounds this endpoint the same way send-welcome-email bounds itself:
    // the caller must supply a real, pending invitation id, not an arbitrary
    // email to spam.
    const { data: invitation, error: invitationError } = await supabase
      .from("org_invitations")
      .select("email, role, status, organizations(name)")
      .eq("id", invitationId)
      .single();
    if (invitationError || !invitation || invitation.status !== "pending") {
      return jsonResponse({ error: "forbidden" }, 403);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return jsonResponse({ sent: false, reason: "resend_not_configured" });
    }

    const orgName = (invitation as { organizations: { name: string } | null }).organizations?.name ?? "Brivia";
    const roleLabels: Record<string, string> = {
      learner: "apprenant",
      trainer: "formateur",
      pedago: "responsable pédagogique",
      registrar: "gestionnaire de scolarité",
      admin: "administrateur",
    };

    const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "Brivia <onboarding@brivia.app>";
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: invitation.email,
        subject: `Invitation à rejoindre ${orgName} sur Brivia`,
        html: `<p>Bonjour,</p><p>Vous avez été invité(e) à rejoindre <strong>${orgName}</strong> sur Brivia en tant que <strong>${roleLabels[invitation.role] ?? invitation.role}</strong>.</p><p><a href="${inviteUrl}">Accepter l'invitation</a></p><p>Ce lien expire dans 7 jours.</p>`,
      }),
    });
    if (!resendResponse.ok) {
      console.error("[send-org-invitation] Resend error:", await resendResponse.text());
      return jsonResponse({ sent: false, reason: "resend_error" }, 502);
    }

    return jsonResponse({ sent: true });
  } catch (err) {
    console.error("[send-org-invitation] error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
```

- [ ] **Step 2: Verify locally**

Run: `cd supabase && supabase functions serve send-org-invitation --no-verify-jwt`
Then in another shell: `curl -s -X POST http://localhost:54321/functions/v1/send-org-invitation -H "Content-Type: application/json" -d '{"invitationId":"00000000-0000-0000-0000-000000000000","inviteUrl":"http://localhost/invite/x"}'`
Expected: `{"error":"forbidden"}` (no such invitation exists) — confirms the guard rejects made-up ids rather than sending mail to arbitrary addresses.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/send-org-invitation/index.ts
git commit -m "feat: send-org-invitation edge function"
```

---

### Task 6: `orgRepo.ts` — types, repo functions, slugify helper

**Files:**
- Create: `apps/app/src/lib/org/orgRepo.ts`
- Test: `apps/app/src/lib/org/__tests__/orgRepo.test.ts`

- [ ] **Step 1: Write the failing test for the pure `slugify` helper**

```typescript
import { describe, it, expect } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import { slugify } from '../orgRepo';

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Lycée Victor Hugo')).toBe('lycee-victor-hugo');
  });

  it('strips accents', () => {
    expect(slugify('Établissement Général')).toBe('etablissement-general');
  });

  it('collapses repeated separators', () => {
    expect(slugify('A   B---C')).toBe('a-b-c');
  });

  it('strips leading/trailing hyphens', () => {
    expect(slugify('-Test-')).toBe('test');
  });

  it('drops characters outside [a-z0-9-]', () => {
    expect(slugify("L'École & Cie !")).toBe('l-ecole-cie');
  });
});
```

Note the actual file needs `import { vi }` too — full import line: `import { describe, it, expect, vi } from 'vitest';`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && npx vitest run src/lib/org/__tests__/orgRepo.test.ts`
Expected: FAIL — `orgRepo` module not found.

- [ ] **Step 3: Write `orgRepo.ts`**

```typescript
import { supabase } from '@/lib/supabase';

export type OrgRole = 'learner' | 'trainer' | 'pedago' | 'registrar' | 'admin';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface OrgMembership {
  id: string;
  org_id: string;
  role: OrgRole;
  created_at: string;
  organizations: Organization;
}

export interface OrgInvitation {
  id: string;
  org_id: string;
  email: string;
  role: OrgRole;
  invited_by: string;
  token: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at: string;
  created_at: string;
}

export interface InvitationPreview {
  org_name: string;
  role: OrgRole;
  email: string;
  status: string;
}

/** Pure: turn a display name into a URL/DB-safe slug candidate. No I/O. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** All orgs (with role) the current user belongs to. */
export async function myOrgMemberships(): Promise<OrgMembership[]> {
  const { data, error } = await supabase
    .from('user_org_roles')
    .select('id, org_id, role, created_at, organizations(*)')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as OrgMembership[];
}

/** Atomic: creates the org and makes the caller its admin. */
export async function createOrganization(name: string, slug: string): Promise<Organization> {
  const { data, error } = await supabase.rpc('create_organization', { p_name: name, p_slug: slug });
  if (error) throw error;
  return data;
}

export async function listOrgInvitations(orgId: string): Promise<OrgInvitation[]> {
  const { data, error } = await supabase
    .from('org_invitations')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createOrgInvitation(
  orgId: string,
  email: string,
  role: OrgRole,
  invitedBy: string,
): Promise<OrgInvitation> {
  const { data, error } = await supabase
    .from('org_invitations')
    .insert({ org_id: orgId, email, role, invited_by: invitedBy })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function revokeOrgInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase
    .from('org_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId);
  if (error) throw error;
}

/** Fire-and-forget from the caller's side — mirrors register()'s welcome email. */
export async function sendOrgInvitationEmail(invitationId: string, inviteUrl: string): Promise<void> {
  await supabase.functions.invoke('send-org-invitation', { body: { invitationId, inviteUrl } });
}

/** Returns the org_id the caller was added to. Throws 'invitation_expired' / 'invitation_revoked' / 'invitation_accepted'. */
export async function acceptOrgInvitation(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_org_invitation', { p_token: token });
  if (error) throw error;
  return data;
}

/** Callable while logged out — the invite landing page's preview. */
export async function getInvitationPreview(token: string): Promise<InvitationPreview | null> {
  const { data, error } = await supabase.rpc('get_invitation_preview', { p_token: token });
  if (error) throw error;
  return data?.[0] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && npx vitest run src/lib/org/__tests__/orgRepo.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck**

Run: `cd apps/app && npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/lib/org/orgRepo.ts apps/app/src/lib/org/__tests__/orgRepo.test.ts
git commit -m "feat: org repo layer (memberships, invitations, slugify)"
```

---

### Task 7: Onboarding — create establishment

**Files:**
- Create: `apps/app/src/pages/OnboardingOrgPage.tsx`
- Modify: `apps/app/src/App.tsx` (add route)
- Modify: `apps/app/src/pages/AuthPage.tsx` (post-register redirect)

New signups with zero org memberships (i.e. not arriving via an invite link) land here to create their establishment. This is a local change to `AuthPage`'s post-register handling only — it doesn't touch global routing/redirect logic, so existing logged-in users (all already in the Brivia bootstrap org) never hit this path.

- [ ] **Step 1: Write `OnboardingOrgPage.tsx`**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showError } from "@/lib/errorTaxonomy";
import { createOrganization, slugify } from "@/lib/org/orgRepo";

export default function OnboardingOrgPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setBusy(true);
    try {
      await createOrganization(name.trim(), slug.trim());
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof Error && err.message.includes("slug_taken")) {
        toast.error("Cet identifiant est déjà utilisé, essayez-en un autre.");
      } else {
        showError(err);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">Créez votre établissement</h1>
        <p className="text-sm text-muted-foreground">
          Vous deviendrez administrateur de cet espace.
        </p>
        <div className="space-y-2">
          <Label htmlFor="org-name">Nom de l'établissement</Label>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Lycée Victor Hugo"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-slug">Identifiant</Label>
          <Input
            id="org-slug"
            value={slug}
            onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
            required
          />
        </div>
        <Button type="submit" loading={busy} className="w-full">
          Créer l'établissement
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Add the route**

In `apps/app/src/App.tsx`, add near the other top-level routes (e.g. right after `/auth`):

```tsx
              <Route path="/onboarding/org" element={<OnboardingOrgPage />} />
```

And add the import alongside the other page imports at the top of the file:

```tsx
import OnboardingOrgPage from "@/pages/OnboardingOrgPage";
```

- [ ] **Step 3: Wire post-register redirect in `AuthPage.tsx`**

`AuthPage.tsx` navigates via full-page reload (`window.location.href = "/"`, no `react-router` `navigate`), so the new logic follows the same style. Replace the register handler's `result.status === "ok"` branch (`apps/app/src/pages/AuthPage.tsx:124-126`):

```tsx
    if (result.status === "ok") {
      toast.success(t("registerSuccess"));
      window.location.href = "/";
```

with:

```tsx
    if (result.status === "ok") {
      toast.success(t("registerSuccess"));
      const inviteToken = new URLSearchParams(window.location.search).get("invite");
      if (inviteToken) {
        try {
          await acceptOrgInvitation(inviteToken);
        } catch {
          // Invitation may be stale/expired; the user still has an account —
          // fall through to onboarding rather than blocking signup on it.
        }
        window.location.href = "/";
        return;
      }
      let hasOrg = true;
      try {
        hasOrg = (await myOrgMemberships()).length > 0;
      } catch {
        // If the check itself fails, don't strand the user — send them
        // through the normal path rather than blocking on onboarding.
      }
      window.location.href = hasOrg ? "/" : "/onboarding/org";
```

(The rest of `handleRegister` — the `else if`/`else` branches for `confirm_email`, `email_in_use`, and the generic error — is unchanged.)

Add the new import at the top of `AuthPage.tsx`:

```tsx
import { acceptOrgInvitation, myOrgMemberships } from "@/lib/org/orgRepo";
```

- [ ] **Step 4: Typecheck and manual smoke test**

Run: `cd apps/app && npm run typecheck`
Expected: no errors.

Run: `cd apps/app && npm run dev`, register a brand-new account (no `?invite=` param) in the browser.
Expected: after registration, lands on `/onboarding/org`; submitting the form navigates to `/dashboard` and the new org appears via `myOrgMemberships()`.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/pages/OnboardingOrgPage.tsx apps/app/src/App.tsx apps/app/src/pages/AuthPage.tsx
git commit -m "feat: create-establishment onboarding for new signups"
```

---

### Task 8: Invite acceptance page

**Files:**
- Create: `apps/app/src/pages/InvitePage.tsx`
- Modify: `apps/app/src/App.tsx` (add route)

- [ ] **Step 1: Write `InvitePage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ui/skeletons/ListSkeleton";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import { acceptOrgInvitation, getInvitationPreview, type InvitationPreview } from "@/lib/org/orgRepo";

const roleLabels: Record<string, string> = {
  learner: "apprenant",
  trainer: "formateur",
  pedago: "responsable pédagogique",
  registrar: "gestionnaire de scolarité",
  admin: "administrateur",
};

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) return;
    getInvitationPreview(token)
      .then(setPreview)
      .catch(showError)
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      await acceptOrgInvitation(token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      showError(err);
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <ListSkeleton rows={2} withAvatar={false} />
      </div>
    );
  }

  if (!preview || preview.status !== "pending") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p>Cette invitation n'est plus valide.</p>
      </div>
    );
  }

  const user = getCurrentUser();

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center space-y-4">
      <h1 className="text-2xl font-semibold">Invitation à rejoindre {preview.org_name}</h1>
      <p className="text-sm text-muted-foreground">
        En tant que {roleLabels[preview.role] ?? preview.role}
      </p>
      {user ? (
        <Button onClick={handleAccept} loading={accepting}>
          Accepter l'invitation
        </Button>
      ) : (
        <Button onClick={() => navigate(`/auth?invite=${token}`)}>
          Se connecter ou créer un compte
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the route**

In `apps/app/src/App.tsx`, add:

```tsx
              <Route path="/invite/:token" element={<InvitePage />} />
```

And the import:

```tsx
import InvitePage from "@/pages/InvitePage";
```

- [ ] **Step 3: Wire invite carry-through on login (not just register) in `AuthPage.tsx`**

The register-path invite handling was added in Task 7. Login needs the same carry-through so an invited user who already has an account can log in from the invite page's "Se connecter ou créer un compte" button and still get the role attached. Replace the login handler's `result.status === "ok"` branch (`apps/app/src/pages/AuthPage.tsx:90-92`):

```tsx
    if (result.status === "ok") {
      toast.success(t("loginSuccess"));
      window.location.href = "/";
```

with:

```tsx
    if (result.status === "ok") {
      toast.success(t("loginSuccess"));
      const inviteToken = new URLSearchParams(window.location.search).get("invite");
      if (inviteToken) {
        try {
          await acceptOrgInvitation(inviteToken);
        } catch {
          // stale/expired invite — user is still logged in, proceed
        }
      }
      window.location.href = "/";
```

(The rest of `handleLogin` — `mfa_required`, `email_not_confirmed`, `invalid_credentials`, and the generic error branches — is unchanged. `acceptOrgInvitation` is already imported from Task 7's change to this file.)

- [ ] **Step 4: Typecheck and manual smoke test**

Run: `cd apps/app && npm run typecheck`
Expected: no errors.

Manual test: in `supabase db psql`, insert a test invitation row (`insert into org_invitations (org_id, email, role, invited_by) values ('<brivia-org-id>', 'test@example.com', 'trainer', '<any-existing-user-id>') returning token;`), then visit `/invite/<token>` in the browser while logged out.
Expected: preview shows "Invitation à rejoindre Brivia" / "En tant que formateur"; clicking through to login/register and back accepts it, and `user_org_roles` gains a `trainer` row for that user.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/pages/InvitePage.tsx apps/app/src/App.tsx apps/app/src/pages/AuthPage.tsx
git commit -m "feat: invite acceptance page and login carry-through"
```

---

### Task 9: Invite management screen (admin/pedago)

**Files:**
- Create: `apps/app/src/pages/OrgInvitations.tsx`
- Modify: `apps/app/src/App.tsx` (add route)
- Modify: `apps/app/src/components/AppSidebar.tsx` (nav entry)

- [ ] **Step 1: Write `OrgInvitations.tsx`**

```tsx
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/skeletons/ListSkeleton";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import {
  createOrgInvitation,
  listOrgInvitations,
  myOrgMemberships,
  revokeOrgInvitation,
  sendOrgInvitationEmail,
  type OrgInvitation,
  type OrgMembership,
  type OrgRole,
} from "@/lib/org/orgRepo";

const roleOptions: { value: OrgRole; label: string }[] = [
  { value: "learner", label: "Apprenant" },
  { value: "trainer", label: "Formateur" },
  { value: "pedago", label: "Responsable pédagogique" },
  { value: "registrar", label: "Gestionnaire de scolarité" },
  { value: "admin", label: "Administrateur" },
];

export default function OrgInvitations() {
  const user = getCurrentUser();
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("learner");
  const [sending, setSending] = useState(false);

  const managedOrgId = memberships.find((m) => m.role === "admin" || m.role === "pedago")?.org_id ?? null;

  useEffect(() => {
    myOrgMemberships()
      .then(setMemberships)
      .catch(showError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!managedOrgId) return;
    listOrgInvitations(managedOrgId).then(setInvitations).catch(showError);
  }, [managedOrgId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managedOrgId || !user || !email.trim()) return;
    setSending(true);
    try {
      const invitation = await createOrgInvitation(managedOrgId, email.trim(), role, user.id);
      const inviteUrl = `${window.location.origin}/invite/${invitation.token}`;
      await sendOrgInvitationEmail(invitation.id, inviteUrl);
      setInvitations((prev) => [invitation, ...prev]);
      setEmail("");
      toast.success("Invitation envoyée");
    } catch (err) {
      showError(err);
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (invitationId: string) => {
    try {
      await revokeOrgInvitation(invitationId);
      setInvitations((prev) =>
        prev.map((i) => (i.id === invitationId ? { ...i, status: "revoked" } : i)),
      );
    } catch (err) {
      showError(err);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (!managedOrgId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p>Vous devez être administrateur ou responsable pédagogique pour gérer les invitations.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Invitations</h1>
      <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] space-y-1">
          <label htmlFor="invite-email" className="text-sm font-medium">Email</label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as OrgRole)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {roleOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <Button type="submit" loading={sending}>Inviter</Button>
      </form>

      <ul className="space-y-2">
        {invitations.map((invitation) => (
          <li key={invitation.id} className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-medium">{invitation.email}</p>
              <p className="text-sm text-muted-foreground">
                {roleOptions.find((r) => r.value === invitation.role)?.label} · {invitation.status}
              </p>
            </div>
            {invitation.status === "pending" && (
              <Button variant="ghost" size="sm" onClick={() => handleRevoke(invitation.id)}>
                Révoquer
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Add the route**

In `apps/app/src/App.tsx`, add:

```tsx
              <Route path="/org/invitations" element={<OrgInvitations />} />
```

And the import:

```tsx
import OrgInvitations from "@/pages/OrgInvitations";
```

- [ ] **Step 3: Typecheck and manual smoke test**

Run: `cd apps/app && npm run typecheck`
Expected: no errors.

Manual test: log in as an existing (pre-migration, now bootstrap-admin) user, visit `/org/invitations`, send an invite to a test address, confirm it appears in the list with status `pending`, click Révoquer, confirm it flips to `revoked`.

- [ ] **Step 4: Commit**

```bash
git add apps/app/src/pages/OrgInvitations.tsx apps/app/src/App.tsx
git commit -m "feat: invite management screen for org admins/pedagos"
```

---

### Task 10: Org switcher

**Files:**
- Create: `apps/app/src/components/org/OrgSwitcher.tsx`
- Modify: `apps/app/src/components/AppSidebar.tsx:269-285`

Only ever renders when the user belongs to more than one org — today that's nobody (everyone is solely in Brivia until invites diversify membership), so this ships inert and safe.

- [ ] **Step 1: Write `OrgSwitcher.tsx`**

```tsx
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import { myOrgMemberships, type OrgMembership } from "@/lib/org/orgRepo";

const ACTIVE_ORG_KEY = "quiz_active_org_id";

export function useActiveOrgId(memberships: OrgMembership[]): [string | null, (id: string) => void] {
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(() => localStorage.getItem(ACTIVE_ORG_KEY));

  useEffect(() => {
    if (memberships.length === 0) return;
    if (!activeOrgId || !memberships.some((m) => m.org_id === activeOrgId)) {
      setActiveOrgIdState(memberships[0].org_id);
    }
  }, [memberships, activeOrgId]);

  const setActiveOrgId = (id: string) => {
    localStorage.setItem(ACTIVE_ORG_KEY, id);
    setActiveOrgIdState(id);
  };

  return [activeOrgId, setActiveOrgId];
}

export function OrgSwitcher() {
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [activeOrgId, setActiveOrgId] = useActiveOrgId(memberships);

  useEffect(() => {
    myOrgMemberships().then(setMemberships).catch(() => setMemberships([]));
  }, []);

  if (memberships.length <= 1) return null;

  const active = memberships.find((m) => m.org_id === activeOrgId) ?? memberships[0];

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton>
            <MaterialSymbol name="domain" size={20} />
            <span>{active.organizations.name}</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {memberships.map((m) => (
            <DropdownMenuItem key={m.org_id} onClick={() => setActiveOrgId(m.org_id)}>
              {m.organizations.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
```

- [ ] **Step 2: Mount it in `AppSidebar.tsx`**

In `apps/app/src/components/AppSidebar.tsx`, import it:

```tsx
import { OrgSwitcher } from "@/components/org/OrgSwitcher";
```

And render it as the first item inside the existing `SidebarFooter`'s `SidebarMenu`, right before the settings `SidebarMenuItem` (around line 272-282):

```tsx
      {user && (
        <SidebarFooter>
          <SidebarSeparator />
          <SidebarMenu>
            <OrgSwitcher />
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={location.pathname === "/profile"}
                onClick={() => navigate("/profile")}
                tooltip={t("settings")}
              >
                <MaterialSymbol name="settings" size={20} />
                <span>{t("settings")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/app && npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Run the app, confirm the sidebar renders unchanged for a normal (single-org) user — `OrgSwitcher` returns `null` and nothing else shifts. Then, using the invite flow from Task 8/9, add a second org membership to a test user and confirm the switcher now appears and switching updates `localStorage['quiz_active_org_id']`.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/components/org/OrgSwitcher.tsx apps/app/src/components/AppSidebar.tsx
git commit -m "feat: org switcher for multi-org users"
```

---

### Task 11: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full local DB reset and schema check**

Run: `cd supabase && supabase db reset`
Expected: all three new migrations (Tasks 1-3) apply cleanly on top of the full existing migration history with no errors.

- [ ] **Step 2: RLS cross-org isolation check**

In `supabase db psql`, as two different test users in two different orgs (create a second org via `create_organization` RPC under a second test auth user), confirm:
```sql
-- as user A (org A member): can see own org's content
select count(*) from content;  -- only org A rows

-- as user B (org B member, freshly created org, no content yet)
select count(*) from content;  -- 0 (org B has no content; RLS still allows read of is_public rows if any exist — expected, that's cross-org-public-by-design, not a leak)
```

- [ ] **Step 3: Full test suite and typecheck**

Run: `cd apps/app && npm test && npm run typecheck && npm run build`
Expected: all pass, build succeeds.

- [ ] **Step 4: End-to-end manual walkthrough**

1. Register a brand new user (no invite) → lands on `/onboarding/org` → create an org → redirected to `/dashboard`.
2. From that new admin account, visit `/org/invitations`, invite a second test email as `trainer`.
3. Open the invite link (from Resend dashboard or local no-op response) in an incognito window, register a new account through it → confirm `user_org_roles` has a `trainer` row for the new org, no `/onboarding/org` redirect happened.
4. Confirm an existing (pre-migration) user still logs in normally and their quizzes/exams/courses are all still visible and editable (bootstrap org backfill didn't break anything).
5. Confirm creating a new exam still works for that existing (bootstrap-admin) user.

Expected: every step succeeds with no console errors.

- [ ] **Step 5: Final commit (if any fixups were needed)**

```bash
git add -A
git commit -m "chore: org RBAC foundation verification fixups"
```

(Skip this commit if Steps 1-4 all passed clean with no changes needed.)
