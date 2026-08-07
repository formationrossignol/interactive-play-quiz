-- Admin user management screen: full account roster (email/plan/subscription
-- state), read-only. profiles.username + auth.users.email/last_sign_in_at
-- aren't otherwise client-readable together, so this is a platform-admin-
-- gated security definer, same shape as list_org_members() (org-scoped
-- version, 20260730160000_org_member_management.sql) but gated by
-- public.is_admin() instead of has_org_role() since this spans every org.

create or replace function public.admin_list_users()
returns table(
  user_id uuid,
  email text,
  username text,
  role text,
  plan text,
  subscription_status text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not an admin';
  end if;

  return query
  select
    p.id,
    u.email::text,
    p.username,
    p.role,
    p.plan,
    p.subscription_status,
    p.created_at,
    u.last_sign_in_at
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;
