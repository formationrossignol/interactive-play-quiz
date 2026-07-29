-- Fix list_org_members(): auth.users.email is character varying(255), not
-- text, and PL/pgSQL's RETURN QUERY requires an exact type match against the
-- function's declared OUT columns (raised 42804 "structure of query does not
-- match function result type" through PostgREST as a 400 on every call).

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
