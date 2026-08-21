-- Scalability audit remediation (database-only).
--
-- This migration deliberately amends deployed objects with CREATE OR REPLACE
-- and additive schema changes. Historical migrations remain untouched.

-- ---------------------------------------------------------------------------
-- Hot RLS and scheduled-job indexes
-- ---------------------------------------------------------------------------

-- user_org_roles_user_id_org_id_role_key, created by the deployed UNIQUE
-- (user_id, org_id, role), already covers has_org_role()'s complete lookup.
-- Do not add the redundant composite index suggested by the audit.

-- assignment_targets_assignment_target_uniq (20260812180000) already owns a
-- btree on exactly (assignment_id, target_type, target_id). Do not duplicate it.

create index if not exists competency_evidence_org_occurred_idx
  on public.competency_evidence(org_id, occurred_at, competency_id)
  where voided_at is null;

create index if not exists risk_signals_org_rule_created_idx
  on public.risk_signals(org_id, rule_code, created_at);

create index if not exists grade_results_item_published_idx
  on public.grade_results(grade_item_id, published_at)
  where status = 'graded' and published_at is not null;

create index if not exists competency_mastery_history_created_idx
  on public.competency_mastery_history(created_at, competency_id, learner_id);

-- ---------------------------------------------------------------------------
-- Pure/stable assignment deadline calculation
-- ---------------------------------------------------------------------------

-- effective_assignment_due_at() cannot itself be STABLE: its contractual
-- accommodation read audit writes accommodation_access_log. Split calculation
-- from auditing so set-based background jobs can use the pure function while
-- interactive calls retain the audit trail.
create or replace function public._effective_assignment_due_at_stable(
  p_assignment_id uuid,
  p_learner_id uuid
) returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_base timestamptz;
  v_profile_id uuid;
  v_no_limit jsonb;
  v_extended jsonb;
begin
  select coalesce(
    (select due_override
       from public.assignment_targets
      where assignment_id = p_assignment_id
        and target_type = 'learner'
        and target_id = p_learner_id
        and due_override is not null
      limit 1),
    (select due_at from public.assignments where id = p_assignment_id)
  ) into v_base;

  select id
    into v_profile_id
    from public.accommodation_profiles
   where learner_id = p_learner_id
     and status = 'active'
     and valid_from <= current_date
     and (valid_until is null or valid_until >= current_date)
   order by created_at desc
   limit 1;

  if v_profile_id is null then
    return v_base;
  end if;

  select coalesce(o.value, r.value)
    into v_no_limit
    from public.accommodation_rules r
    left join public.accommodation_overrides o
      on o.profile_id = r.profile_id
     and o.rule_type = r.rule_type
     and o.target_type = 'assignment'
     and o.target_id = p_assignment_id
   where r.profile_id = v_profile_id
     and r.rule_type = 'no_time_limit';

  if v_no_limit is not null
     and coalesce((v_no_limit->>'enabled')::boolean, true) then
    return null;
  end if;

  select coalesce(o.value, r.value)
    into v_extended
    from public.accommodation_rules r
    left join public.accommodation_overrides o
      on o.profile_id = r.profile_id
     and o.rule_type = r.rule_type
     and o.target_type = 'assignment'
     and o.target_id = p_assignment_id
   where r.profile_id = v_profile_id
     and r.rule_type = 'extended_deadline';

  if v_extended is not null and v_base is not null then
    return v_base + make_interval(
      days => coalesce((v_extended->>'extra_days')::integer, 0)
    );
  end if;

  return v_base;
end;
$$;

revoke all on function public._effective_assignment_due_at_stable(uuid, uuid) from public;

create or replace function public.effective_assignment_due_at(
  p_assignment_id uuid,
  p_learner_id uuid
) returns timestamptz
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_due timestamptz;
begin
  v_due := public._effective_assignment_due_at_stable(
    p_assignment_id,
    p_learner_id
  );

  select id
    into v_profile_id
    from public.accommodation_profiles
   where learner_id = p_learner_id
     and status = 'active'
     and valid_from <= current_date
     and (valid_until is null or valid_until >= current_date)
   order by created_at desc
   limit 1;

  if v_profile_id is not null then
    insert into public.accommodation_access_log(profile_id, actor_id, action)
    values (v_profile_id, coalesce(auth.uid(), p_learner_id), 'read');
  end if;

  return v_due;
end;
$$;

revoke all on function public.effective_assignment_due_at(uuid, uuid) from public;
grant execute on function public.effective_assignment_due_at(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Trigger-specific automation candidate queries
-- ---------------------------------------------------------------------------

create or replace function public._automation_enrollment_candidates(
  p_org_id uuid,
  p_day date
) returns table(learner_id uuid, instance_key text)
language sql stable security definer set search_path = public
as $$
  select le.actor_id, le.id::text
    from public.learning_events le
   where le.org_id = p_org_id
     and le.name = 'enrollment.started'
     and le.occurred_at >= p_day::timestamptz
     and le.occurred_at < (p_day + 1)::timestamptz
     and le.actor_id is not null;
$$;

create or replace function public._automation_due_candidates(
  p_org_id uuid,
  p_overdue boolean
) returns table(learner_id uuid, instance_key text)
language sql stable security definer set search_path = public
as $$
  select tl.learner_id, a.id::text
    from public.assignments a
    join public.assignment_targets t on t.assignment_id = a.id
    join lateral (
      select t.target_id as learner_id where t.target_type = 'learner'
      union all
      select gm.user_id
        from public.share_group_members gm
       where t.target_type = 'group'
         and gm.group_id = t.target_id
         and gm.user_id is not null
      union all
      select e.learner_id
        from public.enrollments e
       where t.target_type = 'session'
         and e.session_id = t.target_id
         and e.status = 'active'
    ) tl on true
    left join public.submissions s
      on s.assignment_id = a.id and s.learner_id = tl.learner_id
    cross join lateral (
      -- OFFSET 0 is an intentional planner barrier: the stable calculation
      -- remains one call per candidate even though due_at is used twice.
      select public._effective_assignment_due_at_stable(
        a.id,
        tl.learner_id
      ) as due_at
      offset 0
    ) effective
   where a.org_id = p_org_id
     and a.status = 'published'
     and a.due_at is not null
     and (s.id is null or s.status = 'draft')
     and effective.due_at is not null
     and (
       (p_overdue and effective.due_at < statement_timestamp())
       or
       (not p_overdue
        and effective.due_at >= current_date::timestamptz
        and effective.due_at < (current_date + 8)::timestamptz)
     );
$$;

create or replace function public._automation_risk_candidates(
  p_org_id uuid,
  p_rule_code text,
  p_day date
) returns table(learner_id uuid, instance_key text)
language sql stable security definer set search_path = public
as $$
  select rs.learner_id, rs.id::text
    from public.risk_signals rs
   where rs.org_id = p_org_id
     and rs.rule_code = p_rule_code
     and rs.created_at >= p_day::timestamptz
     and rs.created_at < (p_day + 1)::timestamptz;
$$;

create or replace function public._automation_completion_candidates(
  p_org_id uuid,
  p_day date
) returns table(learner_id uuid, instance_key text)
language sql stable security definer set search_path = public
as $$
  select gr.learner_id, gr.id::text
    from public.grade_items gi
    join public.grade_results gr on gr.grade_item_id = gi.id
   where gi.org_id = p_org_id
     and gr.status = 'graded'
     and gr.published_at >= p_day::timestamptz
     and gr.published_at < (p_day + 1)::timestamptz;
$$;

create or replace function public._automation_mastery_candidates(
  p_org_id uuid,
  p_day date,
  p_expired boolean
) returns table(learner_id uuid, instance_key text)
language sql stable security definer set search_path = public
as $$
  select cmh.learner_id, cmh.id::text
    from public.competency_mastery_history cmh
    join public.competencies c on c.id = cmh.competency_id
    join public.competency_frameworks f on f.id = c.framework_id
   where f.org_id = p_org_id
     and cmh.created_at >= p_day::timestamptz
     and cmh.created_at < (p_day + 1)::timestamptz
     and (
       (p_expired
        and cmh.to_level = 'not_assessed'
        and cmh.from_level is distinct from 'not_assessed')
       or
       (not p_expired
        and cmh.to_level is distinct from cmh.from_level
        and cmh.to_level <> 'not_assessed')
     );
$$;

revoke all on function public._automation_enrollment_candidates(uuid, date) from public;
revoke all on function public._automation_due_candidates(uuid, boolean) from public;
revoke all on function public._automation_risk_candidates(uuid, text, date) from public;
revoke all on function public._automation_completion_candidates(uuid, date) from public;
revoke all on function public._automation_mastery_candidates(uuid, date, boolean) from public;

-- A PL/pgSQL router prevents PostgreSQL from planning/executing seven
-- irrelevant UNION branches for every rule.
create or replace function public._automation_trigger_candidates(
  p_org_id uuid,
  p_trigger_type text,
  p_day date
) returns table(learner_id uuid, instance_key text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  case p_trigger_type
    when 'enrollment' then
      return query select * from public._automation_enrollment_candidates(p_org_id, p_day);
    when 'due_soon' then
      return query select * from public._automation_due_candidates(p_org_id, false);
    when 'overdue' then
      return query select * from public._automation_due_candidates(p_org_id, true);
    when 'inactivity' then
      return query select * from public._automation_risk_candidates(p_org_id, 'inactivity', p_day);
    when 'failure' then
      return query select * from public._automation_risk_candidates(p_org_id, 'repeated_failure', p_day);
    when 'completion' then
      return query select * from public._automation_completion_candidates(p_org_id, p_day);
    when 'mastery_gained' then
      return query select * from public._automation_mastery_candidates(p_org_id, p_day, false);
    when 'mastery_expired' then
      return query select * from public._automation_mastery_candidates(p_org_id, p_day, true);
    else
      return;
  end case;
end;
$$;

revoke all on function public._automation_trigger_candidates(uuid, text, date) from public;

-- ---------------------------------------------------------------------------
-- Sargable daily analytics rollup
-- ---------------------------------------------------------------------------

create or replace function public._run_daily_analytics_rollup_internal(
  p_org_id uuid,
  p_day date
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.analytics_daily_activity(
    org_id, learner_id, day, events_count, event_names, last_event_at, computed_at
  )
  select p_org_id, actor_id, p_day, count(*), array_agg(distinct name), max(occurred_at), now()
    from public.learning_events
   where org_id = p_org_id
     and actor_id is not null
     and occurred_at >= p_day::timestamptz
     and occurred_at < (p_day + 1)::timestamptz
   group by actor_id
  on conflict (org_id, learner_id, day) do update set
    events_count = excluded.events_count,
    event_names = excluded.event_names,
    last_event_at = excluded.last_event_at,
    computed_at = excluded.computed_at;

  insert into public.analytics_daily_enrollment(
    org_id, session_id, day, started_count, completed_count,
    withdrawn_count, waitlisted_count, computed_at
  )
  select p_org_id, e.session_id, p_day,
    count(*) filter (where eh.to_status = 'active' and eh.from_status is distinct from 'active'),
    count(*) filter (where eh.to_status = 'completed'),
    count(*) filter (where eh.to_status in ('withdrawn','cancelled','expired')),
    count(*) filter (where eh.to_status = 'waitlisted'),
    now()
    from public.enrollments e
    join public.enrollment_history eh on eh.enrollment_id = e.id
   where e.org_id = p_org_id
     and eh.created_at >= p_day::timestamptz
     and eh.created_at < (p_day + 1)::timestamptz
   group by e.session_id
  on conflict (org_id, session_id, day) do update set
    started_count = excluded.started_count,
    completed_count = excluded.completed_count,
    withdrawn_count = excluded.withdrawn_count,
    waitlisted_count = excluded.waitlisted_count,
    computed_at = excluded.computed_at;

  insert into public.analytics_daily_competency(
    org_id, competency_id, day, evidence_count, mastery_changed_count,
    avg_mastery_position, computed_at
  )
  select ev.org_id, ev.competency_id, p_day,
    count(*),
    (select count(*)
       from public.competency_mastery_history mh
      where mh.competency_id = ev.competency_id
        and mh.created_at >= p_day::timestamptz
        and mh.created_at < (p_day + 1)::timestamptz),
    (select avg(msl.position)
       from public.competency_mastery cm
       join public.mastery_scale_levels msl
         on msl.scale_id = cm.scale_id and msl.code = cm.level_code
      where cm.competency_id = ev.competency_id),
    now()
    from public.competency_evidence ev
   where ev.org_id = p_org_id
     and ev.voided_at is null
     and ev.occurred_at >= p_day::timestamptz
     and ev.occurred_at < (p_day + 1)::timestamptz
   group by ev.org_id, ev.competency_id
  on conflict (org_id, competency_id, day) do update set
    evidence_count = excluded.evidence_count,
    mastery_changed_count = excluded.mastery_changed_count,
    avg_mastery_position = excluded.avg_mastery_position,
    computed_at = excluded.computed_at;
end;
$$;

revoke all on function public._run_daily_analytics_rollup_internal(uuid, date) from public;

-- ---------------------------------------------------------------------------
-- Cross-tick queue for per-organization nightly work
-- ---------------------------------------------------------------------------

create table public.lms_daily_job_queue (
  org_id uuid not null references public.organizations(id) on delete cascade,
  day date not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  primary key (org_id, day)
);

create index lms_daily_job_queue_pending_idx
  on public.lms_daily_job_queue(next_attempt_at, day, org_id)
  where status in ('pending', 'failed');

alter table public.lms_daily_job_queue enable row level security;
revoke all on table public.lms_daily_job_queue from public, anon, authenticated;

create or replace function public.enqueue_scheduled_lms_analytics_jobs(
  p_day date default (current_date - 1)
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.lms_daily_job_queue(org_id, day)
  select id, p_day from public.organizations
  on conflict (org_id, day) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.enqueue_scheduled_lms_analytics_jobs(date) from public;

create or replace function public.run_scheduled_lms_analytics_jobs_batch(
  p_batch_size integer default 10
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job record;
  v_processed integer := 0;
begin
  if p_batch_size < 1 or p_batch_size > 100 then
    raise exception 'p_batch_size must be between 1 and 100';
  end if;

  for v_job in
    select q.org_id, q.day
      from public.lms_daily_job_queue q
     where q.status in ('pending', 'failed')
       and q.next_attempt_at <= statement_timestamp()
       and q.attempt_count < 5
     order by q.day, q.org_id
     limit p_batch_size
     for update skip locked
  loop
    update public.lms_daily_job_queue
       set status = 'processing',
           attempt_count = attempt_count + 1,
           started_at = clock_timestamp(),
           last_error = null
     where org_id = v_job.org_id and day = v_job.day;

    begin
      perform public._run_daily_analytics_rollup_internal(v_job.org_id, v_job.day);
      perform public._generate_risk_signals_internal(v_job.org_id);
      perform public._sweep_release_state_internal(v_job.org_id);
      perform public._generate_assignment_due_reminders_internal(v_job.org_id);
      perform public._run_automation_rules_internal(v_job.org_id, v_job.day);

      update public.lms_daily_job_queue
         set status = 'completed', completed_at = clock_timestamp()
       where org_id = v_job.org_id and day = v_job.day;
    exception when others then
      update public.lms_daily_job_queue
         set status = 'failed',
             last_error = left(sqlerrm, 2000),
             next_attempt_at = clock_timestamp()
               + make_interval(mins => least(60, 5 * attempt_count))
       where org_id = v_job.org_id and day = v_job.day;
    end;

    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end;
$$;

revoke all on function public.run_scheduled_lms_analytics_jobs_batch(integer) from public;

-- Preserve the existing zero-argument scheduler entry point, but bound each
-- transaction to ten organizations. pg_cron invokes it once per minute.
create or replace function public.run_scheduled_lms_analytics_jobs()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.run_scheduled_lms_analytics_jobs_batch(10);
end;
$$;

revoke all on function public.run_scheduled_lms_analytics_jobs() from public;

-- ---------------------------------------------------------------------------
-- Bounded, configurable retention
-- ---------------------------------------------------------------------------

create table public.data_retention_policies (
  table_name regclass primary key,
  timestamp_column name not null,
  retention_period interval not null check (retention_period > interval '0'),
  terminal_predicate text not null default 'true',
  batch_size integer not null default 5000 check (batch_size between 1 and 100000),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.data_retention_policies enable row level security;
revoke all on table public.data_retention_policies from public, anon, authenticated;

insert into public.data_retention_policies(
  table_name, timestamp_column, retention_period, terminal_predicate, batch_size
) values
  ('public.learning_events', 'occurred_at', interval '400 days', 'true', 10000),
  ('public.enrollment_history', 'created_at', interval '7 years', 'true', 5000),
  ('public.competency_mastery_history', 'created_at', interval '7 years', 'true', 5000),
  ('public.manual_grade_history', 'changed_at', interval '7 years', 'true', 5000),
  ('public.lti_launches', 'launched_at', interval '400 days', 'true', 5000),
  ('public.accommodation_access_log', 'created_at', interval '7 years', 'true', 5000),
  ('public.attendance_events', 'occurred_on', interval '7 years', 'true', 5000),
  ('public.live_events', 'created_at', interval '2 years', $$status = 'closed'$$, 1000),
  ('public.planning_events', 'ends_at', interval '2 years', 'true', 5000),
  ('public.webhook_deliveries', 'created_at', interval '180 days', $$status in ('delivered', 'failed')$$, 10000),
  ('public.lms_daily_job_queue', 'day', interval '90 days', $$status in ('completed', 'failed')$$, 5000),
  ('public.automation_runs', 'ran_at', interval '400 days', 'true', 5000),
  ('public.report_runs', 'generated_at', interval '400 days', $$status in ('success', 'failed')$$, 5000)
on conflict (table_name) do update set
  timestamp_column = excluded.timestamp_column,
  retention_period = excluded.retention_period,
  terminal_predicate = excluded.terminal_predicate,
  batch_size = excluded.batch_size,
  enabled = true,
  updated_at = now();

-- Global time indexes make each oldest-first purge sargable. Partial indexes
-- avoid indexing rows that retention must preserve indefinitely.
create index if not exists learning_events_retention_idx on public.learning_events(occurred_at);
create index if not exists enrollment_history_retention_idx on public.enrollment_history(created_at);
create index if not exists manual_grade_history_retention_idx on public.manual_grade_history(changed_at);
create index if not exists lti_launches_retention_idx on public.lti_launches(launched_at);
create index if not exists accommodation_access_log_retention_idx on public.accommodation_access_log(created_at);
create index if not exists attendance_events_retention_idx on public.attendance_events(occurred_on);
create index if not exists live_events_retention_idx on public.live_events(created_at) where status = 'closed';
create index if not exists planning_events_retention_idx on public.planning_events(ends_at);
create index if not exists webhook_deliveries_retention_idx on public.webhook_deliveries(created_at)
  where status in ('delivered', 'failed');
create index if not exists lms_daily_job_queue_retention_idx on public.lms_daily_job_queue(day)
  where status in ('completed', 'failed');
create index if not exists automation_runs_retention_idx on public.automation_runs(ran_at);
create index if not exists report_runs_retention_idx on public.report_runs(generated_at)
  where status in ('success', 'failed');

create or replace function public.purge_expired_operational_data()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy record;
  v_deleted integer;
  v_total integer := 0;
begin
  for v_policy in
    select table_name, timestamp_column, retention_period,
           terminal_predicate, batch_size
      from public.data_retention_policies
     where enabled
     order by table_name::text
  loop
    -- Policy rows are owner-only configuration. Identifiers are quoted and
    -- values remain bind parameters; terminal_predicate is trusted migration
    -- configuration and is never client-writable.
    execute format(
      'delete from %1$s where ctid in (' ||
      'select ctid from %1$s ' ||
      'where %2$I < statement_timestamp() - $1 and (%3$s) ' ||
      'order by %2$I limit $2 for update skip locked)',
      v_policy.table_name,
      v_policy.timestamp_column,
      v_policy.terminal_predicate
    ) using v_policy.retention_period, v_policy.batch_size;

    get diagnostics v_deleted = row_count;
    v_total := v_total + v_deleted;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.purge_expired_operational_data() from public;

-- Replace the monolithic nightly cron with a daily enqueue plus small,
-- independently committed worker ticks. Unscheduling by job id is safe on
-- installations where the original named job is absent.
do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job
     where jobname in (
       'lms-daily-analytics-and-risk-signals',
       'lms-daily-job-enqueue',
       'lms-daily-job-worker',
       'operational-data-retention'
     )
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'lms-daily-job-enqueue',
  '0 3 * * *',
  $$select public.enqueue_scheduled_lms_analytics_jobs();$$
);

select cron.schedule(
  'lms-daily-job-worker',
  '* * * * *',
  $$select public.run_scheduled_lms_analytics_jobs();$$
);

select cron.schedule(
  'operational-data-retention',
  '*/5 * * * *',
  $$select public.purge_expired_operational_data();$$
);
