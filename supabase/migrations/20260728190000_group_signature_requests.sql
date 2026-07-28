-- Group-based signature requests.
--
-- A request is assigned to one or more reusable groups from the course
-- sharing feature. Group membership stays the source of truth: adding a user
-- to a group grants access to every open request assigned to that group,
-- while one response per user/request keeps the audit trail unambiguous.

create table public.signature_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  message text not null default '' check (char_length(message) <= 20000),
  status text not null default 'open' check (status in ('open', 'closed')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index signature_requests_owner_idx
  on public.signature_requests(owner_id, created_at desc);

create table public.signature_request_groups (
  request_id uuid not null references public.signature_requests(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, group_id)
);

create index signature_request_groups_group_idx
  on public.signature_request_groups(group_id, request_id);

create table public.signature_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.signature_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  typed_name text not null check (char_length(trim(typed_name)) between 2 and 160),
  signature_data text not null check (
    char_length(signature_data) between 32 and 500000
    and signature_data like 'data:image/png;base64,%'
  ),
  consented_at timestamptz not null default now(),
  user_agent text check (char_length(user_agent) <= 500),
  unique (request_id, user_id)
);

create index signature_responses_request_idx
  on public.signature_responses(request_id, consented_at desc);

create trigger signature_requests_touch_updated_at
  before update on public.signature_requests
  for each row execute function public.touch_updated_at();

alter table public.signature_requests enable row level security;
alter table public.signature_request_groups enable row level security;
alter table public.signature_responses enable row level security;

-- Kept in a SECURITY DEFINER helper to avoid circular RLS evaluation between
-- requests and their group assignments. It returns only a boolean and fixes
-- search_path, so it does not expose group membership data.
create or replace function public.can_access_signature_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.signature_requests sr
    where sr.id = p_request_id
      and (
        sr.owner_id = auth.uid()
        or exists (
          select 1
          from public.signature_request_groups srg
          join public.group_members gm on gm.group_id = srg.group_id
          where srg.request_id = sr.id
            and gm.user_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.can_access_signature_request(uuid) from public;
grant execute on function public.can_access_signature_request(uuid) to authenticated;

create policy signature_requests_read_visible on public.signature_requests
  for select using (public.can_access_signature_request(id));

create policy signature_requests_insert_owner on public.signature_requests
  for insert with check (owner_id = auth.uid());

create policy signature_requests_update_owner on public.signature_requests
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy signature_requests_delete_owner on public.signature_requests
  for delete using (owner_id = auth.uid());

create policy signature_request_groups_read_visible on public.signature_request_groups
  for select using (public.can_access_signature_request(request_id));

create policy signature_request_groups_insert_owner on public.signature_request_groups
  for insert with check (
    exists (
      select 1 from public.signature_requests sr
      where sr.id = request_id and sr.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.groups g
      where g.id = group_id and g.owner_id = auth.uid()
    )
  );

create policy signature_request_groups_delete_owner on public.signature_request_groups
  for delete using (
    exists (
      select 1 from public.signature_requests sr
      where sr.id = request_id and sr.owner_id = auth.uid()
    )
  );

create policy signature_responses_read_parties on public.signature_responses
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.signature_requests sr
      where sr.id = request_id and sr.owner_id = auth.uid()
    )
  );

create policy signature_responses_insert_self on public.signature_responses
  for insert with check (
    user_id = auth.uid()
    and public.can_access_signature_request(request_id)
    and exists (
      select 1
      from public.signature_requests sr
      where sr.id = request_id
        and sr.owner_id <> auth.uid()
        and sr.status = 'open'
        and (sr.due_at is null or sr.due_at >= now())
    )
  );

-- Atomic creation prevents an orphan request when one of the supplied groups
-- is invalid or no longer owned by the caller.
create or replace function public.create_group_signature_request(
  p_title text,
  p_message text,
  p_due_at timestamptz,
  p_group_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  new_request_id uuid;
  distinct_group_count integer;
  owned_group_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if char_length(trim(coalesce(p_title, ''))) not between 1 and 160 then
    raise exception 'Invalid title';
  end if;

  select count(*) into distinct_group_count
  from (select distinct unnest(coalesce(p_group_ids, array[]::uuid[])) as id) selected;

  if distinct_group_count = 0 then
    raise exception 'At least one group is required';
  end if;

  select count(*) into owned_group_count
  from public.groups
  where owner_id = auth.uid()
    and id in (select distinct unnest(p_group_ids));

  if owned_group_count <> distinct_group_count then
    raise exception 'One or more groups are not owned by the caller';
  end if;

  insert into public.signature_requests (owner_id, title, message, due_at)
  values (auth.uid(), trim(p_title), trim(coalesce(p_message, '')), p_due_at)
  returning id into new_request_id;

  insert into public.signature_request_groups (request_id, group_id)
  select new_request_id, id
  from (select distinct unnest(p_group_ids) as id) selected;

  return new_request_id;
end;
$$;

revoke all on function public.create_group_signature_request(text, text, timestamptz, uuid[]) from public;
grant execute on function public.create_group_signature_request(text, text, timestamptz, uuid[]) to authenticated;
