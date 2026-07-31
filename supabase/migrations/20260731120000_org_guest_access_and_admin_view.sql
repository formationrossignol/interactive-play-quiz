-- Guest access toggle + site super-admin cross-org read.
-- organizations has no client write RLS by design (see
-- organizations_member_read comment in 20260730120000_org_rbac_foundation.sql)
-- — every write goes through a SECURITY DEFINER function, same pattern as
-- create_organization() / admin_grant_org_role().

alter table public.organizations
  add column guest_access_enabled boolean not null default false;

-- ── update_org_guest_access() : org admin/pedago, or site super-admin ─────
create or replace function public.update_org_guest_access(p_org_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.has_org_role(p_org_id, array['admin','pedago']) or public.is_admin()) then
    raise exception 'Not authorized';
  end if;
  update public.organizations set guest_access_enabled = p_enabled where id = p_org_id;
end;
$$;

revoke all on function public.update_org_guest_access(uuid, boolean) from public;
grant execute on function public.update_org_guest_access(uuid, boolean) to authenticated;

-- ── admin_list_all_orgs() : site super-admin cross-org roster, read-only ──
-- organizations_member_read only lets a user read orgs they belong to, so a
-- site super-admin who isn't a member of every org needs a bypass, same
-- shape as list_org_members()'s security-definer read.
create or replace function public.admin_list_all_orgs()
returns table(id uuid, name text, slug text, member_count bigint, guest_access_enabled boolean, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  return query
    select o.id, o.name, o.slug, count(distinct r.user_id), o.guest_access_enabled, o.created_at
    from public.organizations o
    left join public.user_org_roles r on r.org_id = o.id
    group by o.id
    order by o.created_at desc;
end;
$$;

revoke all on function public.admin_list_all_orgs() from public;
grant execute on function public.admin_list_all_orgs() to authenticated;

-- ── list_org_members() : loosen so a site super-admin can drill into any org ─
-- read-only reuse; admin_grant_org_role/admin_revoke_org_role/
-- admin_remove_org_member stay org-scoped-admin-only (unchanged, on purpose).
create or replace function public.list_org_members(p_org_id uuid)
returns table(user_id uuid, email text, username text, roles text[], joined_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.has_org_role(p_org_id, array['admin']) or public.is_admin()) then
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
