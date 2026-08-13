-- Spec 07 completion: learner analytics, program rollups, psychometrics and
-- executable scheduled reports.  All projections are replayable and all
-- staff-facing reads pass through an organisation/cohort gate.

-- Per-item timing is captured by the assessment response writer when the
-- client supplies the elapsed time for that item.  It is deliberately
-- nullable: older attempts remain valid and are simply excluded from timing
-- statistics.
alter table public.assessment_responses
  add column if not exists duration_ms integer
  check (duration_ms is null or duration_ms >= 0);

-- A program is represented by a catalog offering in the current LMS model
-- (course_sessions are occurrences of that offering).  This keeps the
-- projection useful without inventing a second, competing program entity.
create table public.analytics_daily_program (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  offering_id uuid not null references public.course_offerings(id) on delete cascade,
  day date not null,
  active_learners integer not null default 0,
  started_count integer not null default 0,
  completed_count integer not null default 0,
  withdrawn_count integer not null default 0,
  waitlisted_count integer not null default 0,
  computed_at timestamptz not null default now(),
  unique (org_id, offering_id, day)
);
create index analytics_daily_program_org_day_idx on public.analytics_daily_program(org_id, day);
alter table public.analytics_daily_program enable row level security;

-- A richer, item-level snapshot used by the psychometrics screen.  The
-- option_counts map is intentionally aggregate-only; no answer text leaves
-- the database.
create table public.analytics_item_psychometrics (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  item_revision_id uuid not null references public.assessment_item_revisions(id) on delete cascade,
  day date not null,
  response_count integer not null default 0,
  omitted_count integer not null default 0,
  correct_rate numeric,
  median_response_time_ms numeric,
  difficulty numeric,
  discrimination numeric,
  option_counts jsonb not null default '{}'::jsonb,
  warning_codes text[] not null default '{}',
  computed_at timestamptz not null default now(),
  unique (org_id, item_revision_id, day)
);
create index analytics_item_psychometrics_org_day_idx on public.analytics_item_psychometrics(org_id, day);
alter table public.analytics_item_psychometrics enable row level security;

-- Report runs store the generated, pseudonymised snapshot in-app.  A storage
-- file can be attached later without changing the execution contract.
alter table public.report_runs add column if not exists payload jsonb;
alter table public.report_runs add column if not exists error_message text;

create policy analytics_daily_program_staff_read on public.analytics_daily_program
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));

create policy analytics_item_psychometrics_staff_read on public.analytics_item_psychometrics
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));

-- Learner-owned view: only the caller's own activity and assessment summary.
create or replace function public.get_my_learning_analytics(p_since date default current_date - 14)
returns table(day date, events_count bigint, attempts_count bigint, average_percentage numeric)
language sql stable security definer set search_path = public
as $$
  with activity as (
    select day as activity_day, sum(events_count)::bigint as events_count
    from public.analytics_daily_activity
    where learner_id = auth.uid() and day >= p_since
    group by day
  ), attempts as (
    select submitted_at::date as attempt_day, count(*)::bigint as attempts_count,
           avg(percentage) as average_percentage
    from public.assessment_attempts
    where learner_id = auth.uid() and status = 'submitted'
      and submitted_at::date >= p_since
    group by submitted_at::date
  )
  select coalesce(a.activity_day, t.attempt_day) as day,
         coalesce(a.events_count, 0), coalesce(t.attempts_count, 0),
         t.average_percentage
  from activity a full join attempts t on t.attempt_day = a.activity_day
  order by 1;
$$;
revoke all on function public.get_my_learning_analytics(date) from public;
grant execute on function public.get_my_learning_analytics(date) to authenticated;

-- Threshold-safe program totals; offering_id is retained because it is the
-- stable program key in the current catalog model.
create or replace function public.get_daily_program_totals(p_org_id uuid, p_since date)
returns table(day date, active_learners bigint, started_count bigint, completed_count bigint,
              withdrawn_count bigint, waitlisted_count bigint, suppressed boolean)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_org_role(p_org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  return query
    select p.day, sum(p.active_learners)::bigint, sum(p.started_count)::bigint,
           sum(p.completed_count)::bigint, sum(p.withdrawn_count)::bigint,
           sum(p.waitlisted_count)::bigint,
           (sum(p.active_learners) < public._get_min_cohort_size(p_org_id))
    from public.analytics_daily_program p
    where p.org_id = p_org_id and p.day >= p_since
    group by p.day order by p.day;
end;
$$;
revoke all on function public.get_daily_program_totals(uuid, date) from public;
grant execute on function public.get_daily_program_totals(uuid, date) to authenticated;

create or replace function public.get_item_psychometrics(p_org_id uuid, p_since date default current_date - 30)
returns table(item_revision_id uuid, day date, response_count bigint, omitted_count bigint,
              correct_rate numeric, median_response_time_ms numeric, difficulty numeric,
              discrimination numeric, option_counts jsonb, warning_codes text[])
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_org_role(p_org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  return query
    select p.item_revision_id, p.day, p.response_count::bigint, p.omitted_count::bigint,
           p.correct_rate, p.median_response_time_ms, p.difficulty, p.discrimination,
           p.option_counts, p.warning_codes
    from public.analytics_item_psychometrics p
    where p.org_id = p_org_id and p.day >= p_since
      and p.response_count >= public._get_min_cohort_size(p_org_id)
    order by p.day, p.item_revision_id;
end;
$$;
revoke all on function public.get_item_psychometrics(uuid, date) from public;
grant execute on function public.get_item_psychometrics(uuid, date) to authenticated;

-- Rebuild all spec-07 projections for one organisation/day.  The function is
-- internal and called by the existing pg_cron job.
create or replace function public._run_spec07_analytics_internal(p_org_id uuid, p_day date)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.analytics_daily_program
    (org_id, offering_id, day, active_learners, started_count, completed_count, withdrawn_count, waitlisted_count, computed_at)
  select e.org_id, s.offering_id, p_day,
         count(distinct e.learner_id) filter (where e.status in ('active','completed')),
         count(*) filter (where h.to_status = 'active' and h.from_status is distinct from 'active'),
         count(*) filter (where h.to_status = 'completed'),
         count(*) filter (where h.to_status in ('withdrawn','cancelled','expired')),
         count(*) filter (where h.to_status = 'waitlisted'), now()
  from public.course_sessions s
  join public.enrollments e on e.session_id = s.id and e.org_id = p_org_id
  left join public.enrollment_history h on h.enrollment_id = e.id and h.created_at::date = p_day
  where s.org_id = p_org_id
  group by e.org_id, s.offering_id
  on conflict (org_id, offering_id, day) do update set
    active_learners = excluded.active_learners, started_count = excluded.started_count,
    completed_count = excluded.completed_count, withdrawn_count = excluded.withdrawn_count,
    waitlisted_count = excluded.waitlisted_count, computed_at = excluded.computed_at;

  with base as (
    select a.org_id, r.item_revision_id, p_day as response_day, r.answered_at, r.duration_ms,
           r.is_correct, r.response, r.points_earned, r.max_points,
           att.percentage,
           ntile(4) over (partition by a.org_id, p_day order by coalesce(att.percentage, 0)) as quartile
    from public.assessment_responses r
    join public.assessment_attempts att on att.id = r.attempt_id and att.status = 'submitted'
    join public.assessments a on a.id = att.assessment_id
    where a.org_id = p_org_id
      and coalesce(r.answered_at, att.submitted_at)::date = p_day
  ), metrics as (
    select org_id, item_revision_id, response_day as day,
           count(*) filter (where answered_at is not null) response_count,
           count(*) filter (where answered_at is null) omitted_count,
           avg(case when answered_at is not null and is_correct then 1.0 when answered_at is not null then 0.0 end) correct_rate,
           percentile_cont(0.5) within group (order by duration_ms) filter (where duration_ms is not null) median_time,
           avg(case when quartile = 4 and is_correct then 1.0 when quartile = 4 then 0.0 end) -
             avg(case when quartile = 1 and is_correct then 1.0 when quartile = 1 then 0.0 end) discrimination
    from base
    group by org_id, item_revision_id, response_day
  ), selected_options as (
    select b.org_id, b.item_revision_id, b.response_day as day, jsonb_array_elements_text(coalesce(b.response->'optionIds', '[]'::jsonb)) option_id
    from base b
    union all
    select b.org_id, b.item_revision_id, b.response_day as day, b.response->>'optionId' option_id
    from base b where b.response->>'optionId' is not null
  ), option_counts as (
    select org_id, item_revision_id, day, option_id, count(*) option_count
    from selected_options group by org_id, item_revision_id, day, option_id
  ), options as (
    select org_id, item_revision_id, day,
           jsonb_object_agg(option_id, option_count) option_counts
    from option_counts group by org_id, item_revision_id, day
  ), grouped as (
    select m.*, o.option_counts from metrics m left join options o using (org_id, item_revision_id, day)
  )
  insert into public.analytics_item_psychometrics
    (org_id, item_revision_id, day, response_count, omitted_count, correct_rate, median_response_time_ms,
     difficulty, discrimination, option_counts, warning_codes, computed_at)
  select org_id, item_revision_id, day, response_count, omitted_count, correct_rate, median_time,
         correct_rate, discrimination, coalesce(option_counts, '{}'::jsonb),
         array_remove(array[
           case when response_count < public._get_min_cohort_size(p_org_id) then 'small_sample' end,
           case when correct_rate is not null and (correct_rate < 0.05 or correct_rate > 0.95) then 'extreme_difficulty' end,
           case when discrimination is not null and discrimination < 0.10 then 'low_discrimination' end
         ], null), now()
  from grouped
  on conflict (org_id, item_revision_id, day) do update set
    response_count = excluded.response_count, omitted_count = excluded.omitted_count,
    correct_rate = excluded.correct_rate, median_response_time_ms = excluded.median_response_time_ms,
    difficulty = excluded.difficulty, discrimination = excluded.discrimination,
    option_counts = excluded.option_counts, warning_codes = excluded.warning_codes, computed_at = excluded.computed_at;
end;
$$;
revoke all on function public._run_spec07_analytics_internal(uuid, date) from public;

/*
  The following block is intentionally kept as comments in the migration
  history: option distributions are built by selected_options/option_counts
  above, not by joining a per-row lateral aggregate (which would multiply
  response counts).
*/
/*
    from (
      select b.org_id, b.item_revision_id, b.day, jsonb_array_elements_text(coalesce(b.response->'optionIds', '[]'::jsonb)) option_id
      from base b
      union all
      select b.org_id, b.item_revision_id, b.day, b.response->>'optionId' option_id
      from base b where b.response->>'optionId' is not null
    ) raw
    join lateral (
      select raw.option_id, count(*) option_count
      from (select raw.option_id) one
      group by raw.option_id
    ) selected on true
    group by raw.org_id, raw.item_revision_id, raw.day
  )
*/

-- Execute due saved reports.  Payloads contain only aggregate counts and
-- pseudonymised labels, never learner ids, names or free-form answers.
create or replace function public._run_due_analytics_reports_internal(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = public as $$
declare s record; v_payload jsonb; v_count integer := 0;
begin
  for s in select rs.id schedule_id, rs.report_id, rs.frequency, r.org_id
           from public.report_schedules rs join public.saved_reports r on r.id = rs.report_id
           where rs.next_run_at is null or rs.next_run_at <= p_now
  loop
    begin
      select jsonb_build_object('generated_at', p_now, 'org_id', s.org_id,
        'activity', coalesce((select jsonb_agg(jsonb_build_object('day', d.day, 'events', d.events_count)) from
          (select day, sum(events_count)::bigint events_count from public.analytics_daily_activity
           where org_id = s.org_id and day >= p_now::date - 30 group by day order by day) d), '[]'::jsonb),
        'enrollments', coalesce((select jsonb_agg(jsonb_build_object('day', e.day,
          'started', e.started_count, 'completed', e.completed_count,
          'withdrawn', e.withdrawn_count, 'waitlisted', e.waitlisted_count)) from
          (select day, sum(started_count)::bigint started_count, sum(completed_count)::bigint completed_count,
                  sum(withdrawn_count)::bigint withdrawn_count, sum(waitlisted_count)::bigint waitlisted_count
           from public.analytics_daily_enrollment where org_id = s.org_id and day >= p_now::date - 30
           group by day order by day) e), '[]'::jsonb)) into v_payload;
      insert into public.report_runs(report_id, status, row_count, payload, generated_at)
      values (s.report_id, 'success', jsonb_array_length(coalesce(v_payload->'activity','[]'::jsonb)), v_payload, p_now);
      update public.report_schedules set next_run_at = case s.frequency
        when 'daily' then p_now + interval '1 day' when 'weekly' then p_now + interval '7 days'
        else p_now + interval '1 month' end where id = s.schedule_id;
      v_count := v_count + 1;
    exception when others then
      insert into public.report_runs(report_id, status, error_message, generated_at)
      values (s.report_id, 'failed', sqlerrm, p_now);
    end;
  end loop;
  return v_count;
end;
$$;
revoke all on function public._run_due_analytics_reports_internal(timestamptz) from public;

-- Add the spec-07 steps to the already scheduled, isolated job.
create or replace function public.run_scheduled_lms_analytics_jobs()
returns void language plpgsql security definer set search_path = public as $$
declare v_org record; v_day date := current_date - 1;
begin
  for v_org in select id from public.organizations loop
    begin perform public._run_daily_analytics_rollup_internal(v_org.id, v_day); exception when others then raise warning 'rollup failed for %: %', v_org.id, sqlerrm; end;
    begin perform public._generate_risk_signals_internal(v_org.id); exception when others then raise warning 'risk signals failed for %: %', v_org.id, sqlerrm; end;
    begin perform public._sweep_release_state_internal(v_org.id); exception when others then raise warning 'release sweep failed for %: %', v_org.id, sqlerrm; end;
    begin perform public._generate_assignment_due_reminders_internal(v_org.id); exception when others then raise warning 'due reminders failed for %: %', v_org.id, sqlerrm; end;
    begin perform public._run_automation_rules_internal(v_org.id, v_day); exception when others then raise warning 'automation failed for %: %', v_org.id, sqlerrm; end;
    begin perform public._sweep_enrollment_completion_internal(v_org.id); exception when others then raise warning 'completion sweep failed for %: %', v_org.id, sqlerrm; end;
    begin perform public._run_spec07_analytics_internal(v_org.id, v_day); exception when others then raise warning 'spec07 rollup failed for %: %', v_org.id, sqlerrm; end;
  end loop;
  begin perform public._run_due_analytics_reports_internal(now()); exception when others then raise warning 'scheduled reports failed: %', sqlerrm; end;
end;
$$;
revoke all on function public.run_scheduled_lms_analytics_jobs() from public;
