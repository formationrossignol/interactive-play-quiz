-- Scalability follow-up for Edge-function hot paths identified by the
-- 2026-08-21 x100 audit. Keep bulk work in PostgreSQL so large directories,
-- rosters and proctoring streams do not turn into one network round-trip per
-- row from an Edge function.

-- SCIM user listing/search -------------------------------------------------

create or replace function public._list_scim_users_service(
  p_client_id uuid,
  p_offset integer default 0,
  p_limit integer default 100
) returns table(
  id uuid,
  user_id uuid,
  external_id text,
  active boolean,
  email text,
  name text,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    su.id,
    su.user_id,
    su.external_id,
    su.active,
    u.email::text,
    u.raw_user_meta_data ->> 'name',
    count(*) over ()
  from public.scim_users su
  join auth.users u on u.id = su.user_id
  where su.client_id = p_client_id
  order by su.created_at, su.id
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;
revoke all on function public._list_scim_users_service(uuid, integer, integer) from public;
grant execute on function public._list_scim_users_service(uuid, integer, integer) to service_role;

create or replace function public._find_auth_user_by_email_service(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from auth.users u
  where u.email = lower(trim(p_email))
  limit 1;
$$;
revoke all on function public._find_auth_user_by_email_service(text) from public;
grant execute on function public._find_auth_user_by_email_service(text) to service_role;

-- LTI NRPS bulk reconciliation --------------------------------------------

create or replace function public._commit_lti_nrps_members_service(
  p_sync_run_id uuid,
  p_members jsonb
) returns table(matched_count integer, unmatched_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration_id uuid;
  v_org_id uuid;
begin
  if jsonb_typeof(p_members) <> 'array' then
    raise exception 'p_members must be a JSON array';
  end if;

  select c.registration_id, r.org_id
    into v_registration_id, v_org_id
  from public.lti_nrps_sync_runs sr
  join public.lti_contexts c on c.id = sr.context_id
  join public.lti_registrations r on r.id = c.registration_id
  where sr.id = p_sync_run_id
    and sr.status = 'running';

  if v_registration_id is null then
    raise exception 'Unknown or completed NRPS sync run';
  end if;

  -- A malicious service caller must not be able to smuggle arbitrary role
  -- strings through the JSON payload. This allowlist mirrors
  -- mapLtiRolesToBriviaRoles() and deliberately excludes admin.
  insert into public.user_org_roles (org_id, user_id, role)
  select distinct v_org_id, em.internal_id, role_value
  from jsonb_to_recordset(p_members) as m(
    external_subject text,
    applied_roles jsonb
  )
  join public.external_mappings em
    on em.system = 'lti'
   and em.object_type = 'user'
   and em.external_id = v_registration_id::text || ':' || m.external_subject
   and em.org_id = v_org_id
  cross join lateral jsonb_array_elements_text(coalesce(m.applied_roles, '[]'::jsonb)) as roles(role_value)
  where role_value in ('learner', 'trainer', 'pedago', 'registrar')
  on conflict (user_id, org_id, role) do nothing;

  insert into public.lti_nrps_sync_members (
    sync_run_id,
    external_subject,
    name,
    email,
    lti_roles,
    matched_user_id,
    applied_roles
  )
  select
    p_sync_run_id,
    m.external_subject,
    m.name,
    m.email,
    coalesce(m.lti_roles, '[]'::jsonb),
    em.internal_id,
    case when em.internal_id is null then '[]'::jsonb else coalesce(m.applied_roles, '[]'::jsonb) end
  from jsonb_to_recordset(p_members) as m(
    external_subject text,
    name text,
    email text,
    lti_roles jsonb,
    applied_roles jsonb
  )
  left join public.external_mappings em
    on em.system = 'lti'
   and em.object_type = 'user'
   and em.external_id = v_registration_id::text || ':' || m.external_subject
   and em.org_id = v_org_id;

  return query
  with resolved as (
    select em.internal_id
    from jsonb_to_recordset(p_members) as m(external_subject text)
    left join public.external_mappings em
      on em.system = 'lti'
     and em.object_type = 'user'
     and em.external_id = v_registration_id::text || ':' || m.external_subject
     and em.org_id = v_org_id
  )
  select
    count(*) filter (where internal_id is not null)::integer,
    count(*) filter (where internal_id is null)::integer
  from resolved;
end;
$$;
revoke all on function public._commit_lti_nrps_members_service(uuid, jsonb) from public;
grant execute on function public._commit_lti_nrps_members_service(uuid, jsonb) to service_role;

-- Proctoring report counters ----------------------------------------------

alter table public.exam_proctoring_reports
  add column if not exists focus_lost_milliseconds bigint not null default 0;
update public.exam_proctoring_reports
set focus_lost_milliseconds = focus_lost_seconds::bigint * 1000
where focus_lost_milliseconds = 0 and focus_lost_seconds > 0;

create or replace function public._increment_proctoring_report_service(
  p_exam_id uuid,
  p_attempt_id uuid,
  p_expires_at timestamptz,
  p_event_type text default null,
  p_duration_ms integer default null,
  p_alert_severity text default null,
  p_capture_delta integer default 0
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.exam_proctoring_reports (
    exam_id,
    attempt_id,
    decision,
    event_count,
    alert_count,
    capture_count,
    tab_switch_count,
    fullscreen_exit_count,
    focus_lost_seconds,
    focus_lost_milliseconds,
    generated_at,
    expires_at
  ) values (
    p_exam_id,
    p_attempt_id,
    case when p_alert_severity = 'critical' then 'review' else 'compliant' end,
    case when p_event_type is null then 0 else 1 end,
    case when p_alert_severity is null then 0 else 1 end,
    greatest(coalesce(p_capture_delta, 0), 0),
    case when p_event_type = 'tab_hidden' then 1 else 0 end,
    case when p_event_type = 'fullscreen_exited' then 1 else 0 end,
    case when p_event_type = 'focus_lost' then round(greatest(coalesce(p_duration_ms, 0), 0) / 1000.0)::integer else 0 end,
    case when p_event_type = 'focus_lost' then greatest(coalesce(p_duration_ms, 0), 0)::bigint else 0 end,
    now(),
    p_expires_at
  )
  on conflict (attempt_id) do update set
    decision = case
      when public.exam_proctoring_reports.decision = 'non-compliant' then 'non-compliant'
      when p_alert_severity = 'critical'
        or public.exam_proctoring_reports.alert_count + case when p_alert_severity is null then 0 else 1 end >= 3
        then 'review'
      else public.exam_proctoring_reports.decision
    end,
    event_count = public.exam_proctoring_reports.event_count + case when p_event_type is null then 0 else 1 end,
    alert_count = public.exam_proctoring_reports.alert_count + case when p_alert_severity is null then 0 else 1 end,
    capture_count = public.exam_proctoring_reports.capture_count + greatest(coalesce(p_capture_delta, 0), 0),
    tab_switch_count = public.exam_proctoring_reports.tab_switch_count + case when p_event_type = 'tab_hidden' then 1 else 0 end,
    fullscreen_exit_count = public.exam_proctoring_reports.fullscreen_exit_count + case when p_event_type = 'fullscreen_exited' then 1 else 0 end,
    focus_lost_milliseconds = public.exam_proctoring_reports.focus_lost_milliseconds
      + case when p_event_type = 'focus_lost' then greatest(coalesce(p_duration_ms, 0), 0)::bigint else 0 end,
    focus_lost_seconds = round((
      public.exam_proctoring_reports.focus_lost_milliseconds
      + case when p_event_type = 'focus_lost' then greatest(coalesce(p_duration_ms, 0), 0)::bigint else 0 end
    ) / 1000.0)::integer,
    generated_at = now(),
    expires_at = greatest(public.exam_proctoring_reports.expires_at, excluded.expires_at);
end;
$$;
revoke all on function public._increment_proctoring_report_service(uuid, uuid, timestamptz, text, integer, text, integer) from public;
grant execute on function public._increment_proctoring_report_service(uuid, uuid, timestamptz, text, integer, text, integer) to service_role;

create or replace function public._increment_proctoring_report_from_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._increment_proctoring_report_service(
    new.exam_id, new.attempt_id, new.expires_at,
    new.event_type, new.duration_ms, null, 0
  );
  return new;
end;
$$;

create or replace function public._increment_proctoring_report_from_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._increment_proctoring_report_service(
    new.exam_id, new.attempt_id, new.expires_at,
    null, null, new.severity, 0
  );
  return new;
end;
$$;

create or replace function public._increment_proctoring_report_from_capture()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._increment_proctoring_report_service(
    new.exam_id, new.attempt_id, new.expires_at,
    null, null, null, 1
  );
  return new;
end;
$$;

drop trigger if exists increment_proctoring_report_on_event on public.exam_proctoring_events;
create trigger increment_proctoring_report_on_event
  after insert on public.exam_proctoring_events
  for each row execute function public._increment_proctoring_report_from_event();

drop trigger if exists increment_proctoring_report_on_alert on public.exam_proctoring_alerts;
create trigger increment_proctoring_report_on_alert
  after insert on public.exam_proctoring_alerts
  for each row execute function public._increment_proctoring_report_from_alert();

drop trigger if exists increment_proctoring_report_on_capture on public.exam_proctoring_captures;
create trigger increment_proctoring_report_on_capture
  after insert on public.exam_proctoring_captures
  for each row execute function public._increment_proctoring_report_from_capture();

revoke all on function public._increment_proctoring_report_from_event() from public;
revoke all on function public._increment_proctoring_report_from_alert() from public;
revoke all on function public._increment_proctoring_report_from_capture() from public;

-- Platform-admin summary --------------------------------------------------

create or replace function public._admin_profile_plan_counts_service()
returns table(plan text, user_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.plan, 'starter'), count(*)
  from public.profiles p
  group by coalesce(p.plan, 'starter')
  order by coalesce(p.plan, 'starter');
$$;
revoke all on function public._admin_profile_plan_counts_service() from public;
grant execute on function public._admin_profile_plan_counts_service() to service_role;
