-- Org member management screen: list members + grant/revoke roles + remove
-- a member. user_org_roles has no client insert/update/delete RLS policy
-- (by design, see 20260730120000_org_rbac_foundation.sql) — every write here
-- goes through a SECURITY DEFINER function that checks the caller is an
-- admin of the target org, mirroring create_organization()/accept_org_invitation().

-- ── list_org_members() : full roster for the management screen ────────────
-- profiles.username + auth.users.email aren't otherwise client-readable
-- together, so this is admin-gated read access via a security definer,
-- same shape as get_invitation_preview().
create or replace function public.list_org_members(p_org_id uuid)
returns table(user_id uuid, email text, username text, roles text[], joined_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_org_role(p_org_id, array['admin']) then
    raise exception 'Not an admin of this organization';
  end if;

  return query
  select
    r.user_id,
    u.email::text,
    p.username,
    array_agg(r.role order by r.role),
    min(r.created_at)
  from public.user_org_roles r
  join auth.users u on u.id = r.user_id
  left join public.profiles p on p.id = r.user_id
  where r.org_id = p_org_id
  group by r.user_id, u.email, p.username
  order by min(r.created_at);
end;
$$;

revoke all on function public.list_org_members(uuid) from public;
grant execute on function public.list_org_members(uuid) to authenticated;

-- ── admin_grant_org_role() ──────────────────────────────────────────────────
create or replace function public.admin_grant_org_role(p_org_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_org_role(p_org_id, array['admin']) then
    raise exception 'Not an admin of this organization';
  end if;
  if p_role not in ('learner','trainer','pedago','registrar','admin') then
    raise exception 'Invalid role';
  end if;

  insert into public.user_org_roles (user_id, org_id, role)
  values (p_user_id, p_org_id, p_role)
  on conflict (user_id, org_id, role) do nothing;
end;
$$;

revoke all on function public.admin_grant_org_role(uuid, uuid, text) from public;
grant execute on function public.admin_grant_org_role(uuid, uuid, text) to authenticated;

-- ── admin_revoke_org_role() : blocks removing the org's last admin ────────
create or replace function public.admin_revoke_org_role(p_org_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_admins int;
begin
  if not public.has_org_role(p_org_id, array['admin']) then
    raise exception 'Not an admin of this organization';
  end if;

  if p_role = 'admin' then
    select count(*) into remaining_admins
    from public.user_org_roles
    where org_id = p_org_id and role = 'admin' and user_id <> p_user_id;
    if remaining_admins = 0 then
      raise exception 'last_admin';
    end if;
  end if;

  delete from public.user_org_roles
  where org_id = p_org_id and user_id = p_user_id and role = p_role;
end;
$$;

revoke all on function public.admin_revoke_org_role(uuid, uuid, text) from public;
grant execute on function public.admin_revoke_org_role(uuid, uuid, text) to authenticated;

-- ── admin_remove_org_member() : drops every role the user holds in the org ─
create or replace function public.admin_remove_org_member(p_org_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_admins int;
  target_is_admin boolean;
begin
  if not public.has_org_role(p_org_id, array['admin']) then
    raise exception 'Not an admin of this organization';
  end if;

  select exists (
    select 1 from public.user_org_roles
    where org_id = p_org_id and user_id = p_user_id and role = 'admin'
  ) into target_is_admin;

  if target_is_admin then
    select count(*) into remaining_admins
    from public.user_org_roles
    where org_id = p_org_id and role = 'admin' and user_id <> p_user_id;
    if remaining_admins = 0 then
      raise exception 'last_admin';
    end if;
  end if;

  delete from public.user_org_roles where org_id = p_org_id and user_id = p_user_id;
end;
$$;

revoke all on function public.admin_remove_org_member(uuid, uuid) from public;
grant execute on function public.admin_remove_org_member(uuid, uuid) to authenticated;
