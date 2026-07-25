-- Course sharing: invite individual users or reusable groups to view a course
-- without making it fully public. Course creators only (type='course'),
-- view-only access for invitees — no editing.

-- ── profiles.username : public-safe identity for search/invites ────────────
-- Source of truth stays auth.users.user_metadata.username (set at signup, see
-- apps/app/src/lib/auth.ts signUp()); this column is a queryable mirror, since
-- RLS can never let a client read another user's raw profiles row (role/plan)
-- and auth.users is never client-readable at all.
alter table public.profiles add column username text;

-- Backfill existing users: prefer their auth metadata username, else the
-- email local-part, disambiguating any collisions (usernames were never
-- unique before this column existed) with a numeric suffix.
with candidates as (
  select
    u.id,
    coalesce(nullif(u.raw_user_meta_data->>'username', ''), split_part(u.email, '@', 1)) as base
  from auth.users u
),
numbered as (
  select id, base, row_number() over (partition by base order by id) as rn
  from candidates
)
update public.profiles p
set username = n.base || case when n.rn = 1 then '' else '-' || n.rn end
from numbered n
where p.id = n.id;

alter table public.profiles alter column username set not null;
alter table public.profiles add constraint profiles_username_unique unique (username);

-- ── groups : reusable named lists of users, owned by their creator ─────────
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index groups_owner_idx on public.groups(owner_id);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  pending_email text,
  created_at timestamptz not null default now(),
  check (num_nonnulls(user_id, pending_email) = 1),
  unique (group_id, user_id),
  unique (group_id, pending_email)
);
create index group_members_group_idx on public.group_members(group_id);
create index group_members_user_idx on public.group_members(user_id);

-- ── content_shares : grants view access to a course for a user or group ────
create table public.content_shares (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content(id) on delete cascade,
  shared_with_user_id uuid references auth.users(id) on delete cascade,
  shared_with_group_id uuid references public.groups(id) on delete cascade,
  pending_email text,
  created_at timestamptz not null default now(),
  check (num_nonnulls(shared_with_user_id, shared_with_group_id, pending_email) = 1),
  unique (content_id, shared_with_user_id),
  unique (content_id, shared_with_group_id),
  unique (content_id, pending_email)
);
create index content_shares_content_idx on public.content_shares(content_id);
create index content_shares_user_idx on public.content_shares(shared_with_user_id);
create index content_shares_group_idx on public.content_shares(shared_with_group_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.content_shares enable row level security;

create policy groups_owner on public.groups
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy group_members_owner on public.group_members
  for all using (
    exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );

create policy content_shares_owner on public.content_shares
  for all using (
    exists (select 1 from public.content c where c.id = content_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.content c where c.id = content_id and c.user_id = auth.uid())
  );

-- A shared user needs to see their own grant rows (SharedWithMe lists them),
-- which content_shares_owner alone doesn't cover — they aren't the course owner.
create policy content_shares_read_own on public.content_shares
  for select using (shared_with_user_id = auth.uid());

-- content: extend the existing public-read policy with a shared-access clause.
drop policy if exists content_public_read on public.content;
create policy content_public_read on public.content
  for select using (
    is_public = true or is_open = true
    or exists (
      select 1 from public.content_shares cs
      where cs.content_id = content.id
        and (cs.shared_with_user_id = auth.uid()
             or cs.shared_with_group_id in (select group_id from public.group_members where user_id = auth.uid()))
    )
  );

-- ── functions ────────────────────────────────────────────────────────────

-- Public-safe username search for invite autocomplete. security definer so it
-- can read all of `profiles`, but only ever returns id+username — never role/plan.
create or replace function public.search_profiles_by_username(prefix text)
returns table(id uuid, username text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.username
  from public.profiles p
  where p.username ilike prefix || '%'
    and p.id <> auth.uid()
  order by p.username
  limit 10;
$$;

-- Resolves a set of user ids to id+username, for the owner's share list to
-- display who a course is shared with (profiles_read_self alone wouldn't let
-- the owner read other users' rows).
create or replace function public.usernames_by_ids(ids uuid[])
returns table(id uuid, username text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.username
  from public.profiles p
  where p.id = any(ids);
$$;

-- Resolves an email to a user id (client can never query auth.users directly)
-- and inserts a content_shares row: resolved if the email has an account,
-- pending otherwise (resolved automatically by handle_new_user on signup).
-- Caller must own the content row.
create or replace function public.resolve_content_share(p_content_id uuid, p_email text)
returns public.content_shares
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  result public.content_shares;
begin
  if not exists (select 1 from public.content where id = p_content_id and user_id = auth.uid()) then
    raise exception 'Not the owner of this content';
  end if;

  select u.id into target_user_id from auth.users u where u.email = p_email;

  if target_user_id is not null then
    insert into public.content_shares (content_id, shared_with_user_id)
    values (p_content_id, target_user_id)
    on conflict (content_id, shared_with_user_id) do nothing
    returning * into result;
  else
    insert into public.content_shares (content_id, pending_email)
    values (p_content_id, p_email)
    on conflict (content_id, pending_email) do nothing
    returning * into result;
  end if;

  return result;
end;
$$;

-- Same shape as resolve_content_share, for group membership. Caller must own the group.
create or replace function public.resolve_group_member(p_group_id uuid, p_email text)
returns public.group_members
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  result public.group_members;
begin
  if not exists (select 1 from public.groups where id = p_group_id and owner_id = auth.uid()) then
    raise exception 'Not the owner of this group';
  end if;

  select u.id into target_user_id from auth.users u where u.email = p_email;

  if target_user_id is not null then
    insert into public.group_members (group_id, user_id)
    values (p_group_id, target_user_id)
    on conflict (group_id, user_id) do nothing
    returning * into result;
  else
    insert into public.group_members (group_id, pending_email)
    values (p_group_id, p_email)
    on conflict (group_id, pending_email) do nothing
    returning * into result;
  end if;

  return result;
end;
$$;

-- ── extend handle_new_user: backfill username, resolve pending invites ─────
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

  update public.group_members set user_id = new.id, pending_email = null where pending_email = new.email;
  update public.content_shares set shared_with_user_id = new.id, pending_email = null where pending_email = new.email;

  return new;
end;
$$;
