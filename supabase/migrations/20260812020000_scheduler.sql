-- Real scheduler infrastructure (pg_cron) — this repo has never had one.
-- Every "job" across all 10 LMS specs has so far been event-triggered or
-- manual-only (see RESTE-A-FAIRE.md's cross-cutting dependency note: "Aucun
-- ordonnanceur (cron/scheduler) n'existe dans ce repo"). This migration
-- wires the two RPCs spec 07's own VALIDATION-STATUS explicitly flags as
-- "RPC idempotentes prêtes à être appelées par un cron" and nothing else —
-- it does not attempt reminders (01/07), release_state's temporal sweep
-- (06), or SCIM/OneRoster sync (04): those need real business logic that
-- doesn't exist yet, not just a trigger. Scheduling them today would be
-- scheduling nothing.
--
-- public.run_daily_analytics_rollup(p_org_id, p_day) and
-- public.generate_risk_signals(p_org_id) both gate on
-- has_org_role(p_org_id, ['pedago','admin']) via auth.uid() — correct for
-- an interactive admin calling them by hand, meaningless for a pg_cron job
-- (runs with no JWT; auth.uid() is null; every call would raise
-- 'Not authorized', silently doing nothing every night). Rather than weaken
-- that check — which is real, tested security behavior per
-- VALIDATION-STATUS.md §07 ("un apprenant non-staff ... ne peut pas
-- exécuter les deux RPC") — each is split into the existing checked public
-- wrapper (signature and behavior unchanged; nothing in the app calls these
-- directly yet, so this is a behavior-preserving refactor) plus a new
-- unchecked internal function the scheduler calls directly. The internal
-- functions are never granted to authenticated/anon.

create extension if not exists pg_cron with schema extensions;

-- ── run_daily_analytics_rollup(): checked wrapper + unchecked internal ─────
create or replace function public._run_daily_analytics_rollup_internal(p_org_id uuid, p_day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.analytics_daily_activity (org_id, learner_id, day, events_count, event_names, last_event_at, computed_at)
  select p_org_id, actor_id, p_day, count(*), array_agg(distinct name), max(occurred_at), now()
  from public.learning_events
  where org_id = p_org_id and actor_id is not null and occurred_at::date = p_day
  group by actor_id
  on conflict (org_id, learner_id, day) do update set
    events_count = excluded.events_count,
    event_names = excluded.event_names,
    last_event_at = excluded.last_event_at,
    computed_at = excluded.computed_at;

  insert into public.analytics_daily_enrollment (org_id, session_id, day, started_count, completed_count, withdrawn_count, waitlisted_count, computed_at)
  select p_org_id, e.session_id, p_day,
    count(*) filter (where eh.to_status = 'active' and eh.from_status is distinct from 'active'),
    count(*) filter (where eh.to_status = 'completed'),
    count(*) filter (where eh.to_status in ('withdrawn','cancelled','expired')),
    count(*) filter (where eh.to_status = 'waitlisted'),
    now()
  from public.enrollment_history eh
  join public.enrollments e on e.id = eh.enrollment_id
  where e.org_id = p_org_id and eh.created_at::date = p_day
  group by e.session_id
  on conflict (org_id, session_id, day) do update set
    started_count = excluded.started_count,
    completed_count = excluded.completed_count,
    withdrawn_count = excluded.withdrawn_count,
    waitlisted_count = excluded.waitlisted_count,
    computed_at = excluded.computed_at;

  insert into public.analytics_daily_competency (org_id, competency_id, day, evidence_count, mastery_changed_count, avg_mastery_position, computed_at)
  select ev.org_id, ev.competency_id, p_day,
    count(*),
    (select count(*) from public.competency_mastery_history mh where mh.competency_id = ev.competency_id and mh.created_at::date = p_day),
    (select avg(msl.position) from public.competency_mastery cm
       join public.mastery_scale_levels msl on msl.scale_id = cm.scale_id and msl.code = cm.level_code
       where cm.competency_id = ev.competency_id),
    now()
  from public.competency_evidence ev
  where ev.org_id = p_org_id and ev.voided_at is null and ev.occurred_at::date = p_day
  group by ev.org_id, ev.competency_id
  on conflict (org_id, competency_id, day) do update set
    evidence_count = excluded.evidence_count,
    mastery_changed_count = excluded.mastery_changed_count,
    avg_mastery_position = excluded.avg_mastery_position,
    computed_at = excluded.computed_at;
end;
$$;

revoke all on function public._run_daily_analytics_rollup_internal(uuid, date) from public;

create or replace function public.run_daily_analytics_rollup(p_org_id uuid, p_day date default (current_date - 1))
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_org_role(p_org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  perform public._run_daily_analytics_rollup_internal(p_org_id, p_day);
end;
$$;

revoke all on function public.run_daily_analytics_rollup(uuid, date) from public;
grant execute on function public.run_daily_analytics_rollup(uuid, date) to authenticated;

-- ── generate_risk_signals(): checked wrapper + unchecked internal ──────────
-- Full body copied verbatim from the current definition
-- (20260811080000_blocking_prereq_signal.sql, all 5 ANA-013 rules), minus
-- the has_org_role check.
create or replace function public._generate_risk_signals_internal(p_org_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
  v_count integer;
begin
  -- ANA-013 rule: inactivity
  with settings as (
    select
      coalesce((select enabled from public.risk_signal_settings where org_id = p_org_id and rule_code = 'inactivity'), true) as enabled,
      coalesce((select (params->>'days')::int from public.risk_signal_settings where org_id = p_org_id and rule_code = 'inactivity'), 14) as days
  ),
  candidates as (
    select e.learner_id,
           e.effective_start_at as baseline,
           le.last_event_at
    from public.enrollments e
    left join lateral (
      select max(occurred_at) as last_event_at
      from public.learning_events
      where org_id = p_org_id and actor_id = e.learner_id
    ) le on true
    where e.org_id = p_org_id and e.status = 'active'
  )
  insert into public.risk_signals (org_id, learner_id, rule_code, factors, window_start, window_end)
  select p_org_id, c.learner_id, 'inactivity',
    jsonb_build_object(
      'days_inactive', extract(day from now() - coalesce(c.last_event_at, c.baseline))::int,
      'last_event_at', c.last_event_at
    ),
    coalesce(c.last_event_at, c.baseline)::date, current_date
  from candidates c, settings s
  where s.enabled
    and coalesce(c.last_event_at, c.baseline) < now() - (s.days || ' days')::interval
    and not exists (
      select 1 from public.risk_signals rs
      where rs.org_id = p_org_id and rs.learner_id = c.learner_id and rs.rule_code = 'inactivity' and rs.status = 'open'
    );
  get diagnostics v_count = row_count;
  v_inserted := v_inserted + v_count;

  -- ANA-013 rule: overdue (assignment past its *accommodation-aware* due
  -- date, no submission or still a draft)
  with settings as (
    select
      coalesce((select enabled from public.risk_signal_settings where org_id = p_org_id and rule_code = 'overdue'), true) as enabled,
      coalesce((select (params->>'grace_days')::int from public.risk_signal_settings where org_id = p_org_id and rule_code = 'overdue'), 0) as grace_days
  ),
  target_learners as (
    select t.assignment_id, t.target_id as learner_id
    from public.assignment_targets t
    where t.target_type = 'learner'
    union
    select t.assignment_id, gm.user_id
    from public.assignment_targets t
    join public.share_group_members gm on gm.group_id = t.target_id
    where t.target_type = 'group'
    union
    select t.assignment_id, e.learner_id
    from public.assignment_targets t
    join public.enrollments e on e.session_id = t.target_id and e.status = 'active'
    where t.target_type = 'session'
  ),
  missing as (
    select a.id as assignment_id, a.title, tl.learner_id,
           public.effective_assignment_due_at(a.id, tl.learner_id) as effective_due_at
    from public.assignments a
    join target_learners tl on tl.assignment_id = a.id
    left join public.submissions s on s.assignment_id = a.id and s.learner_id = tl.learner_id
    where a.org_id = p_org_id and a.status = 'published'
      and (s.id is null or s.status = 'draft')
  )
  insert into public.risk_signals (org_id, learner_id, rule_code, factors, window_start, window_end)
  select p_org_id, m.learner_id, 'overdue',
    jsonb_build_object(
      'assignment_id', m.assignment_id,
      'assignment_title', m.title,
      'due_at', m.effective_due_at,
      'days_overdue', extract(day from now() - m.effective_due_at)::int
    ),
    m.effective_due_at::date, current_date
  from missing m, settings s
  where s.enabled
    and m.effective_due_at is not null
    and m.effective_due_at < now() - (s.grace_days || ' days')::interval
    and not exists (
      select 1 from public.risk_signals rs
      where rs.org_id = p_org_id and rs.learner_id = m.learner_id and rs.rule_code = 'overdue'
        and rs.status = 'open' and (rs.factors->>'assignment_id') = m.assignment_id::text
    );
  get diagnostics v_count = row_count;
  v_inserted := v_inserted + v_count;

  -- ANA-013 rule: repeated_failure (consecutive graded results below pass_ratio)
  with settings as (
    select
      coalesce((select enabled from public.risk_signal_settings where org_id = p_org_id and rule_code = 'repeated_failure'), true) as enabled,
      coalesce((select (params->>'min_consecutive')::int from public.risk_signal_settings where org_id = p_org_id and rule_code = 'repeated_failure'), 3) as min_consecutive,
      coalesce((select (params->>'pass_ratio')::numeric from public.risk_signal_settings where org_id = p_org_id and rule_code = 'repeated_failure'), 0.5) as pass_ratio
  ),
  graded as (
    select gr.learner_id, gr.published_at, gr.points, gi.max_points, gi.title,
      (gr.points < gi.max_points * s.pass_ratio) as failed,
      row_number() over (partition by gr.learner_id order by gr.published_at desc) as rn
    from public.grade_results gr
    join public.grade_items gi on gi.id = gr.grade_item_id
    cross join settings s
    where gi.org_id = p_org_id and gr.status = 'graded' and gr.published_at is not null and gr.points is not null
  ),
  streaks as (
    select learner_id, count(*) as total_count, min(rn) filter (where not failed) as first_pass_rn
    from graded
    group by learner_id
  ),
  recent_failures as (
    select g.learner_id,
      jsonb_agg(jsonb_build_object('title', g.title, 'points', g.points, 'max_points', g.max_points, 'published_at', g.published_at) order by g.rn) as items,
      min(g.published_at) as earliest_at
    from graded g
    join streaks st on st.learner_id = g.learner_id
    where g.rn <= coalesce(st.first_pass_rn - 1, st.total_count)
    group by g.learner_id
  )
  insert into public.risk_signals (org_id, learner_id, rule_code, factors, window_start, window_end)
  select p_org_id, st.learner_id, 'repeated_failure',
    jsonb_build_object('consecutive_failed', coalesce(st.first_pass_rn - 1, st.total_count), 'items', rf.items),
    rf.earliest_at::date, current_date
  from streaks st
  join recent_failures rf on rf.learner_id = st.learner_id
  cross join settings s
  where s.enabled
    and coalesce(st.first_pass_rn - 1, st.total_count) >= s.min_consecutive
    and not exists (
      select 1 from public.risk_signals rs
      where rs.org_id = p_org_id and rs.learner_id = st.learner_id and rs.rule_code = 'repeated_failure' and rs.status = 'open'
    );
  get diagnostics v_count = row_count;
  v_inserted := v_inserted + v_count;

  -- ANA-013 rule: progress_drop (last 7d activity vs prior 7d baseline)
  with settings as (
    select
      coalesce((select enabled from public.risk_signal_settings where org_id = p_org_id and rule_code = 'progress_drop'), true) as enabled,
      coalesce((select (params->>'drop_ratio')::numeric from public.risk_signal_settings where org_id = p_org_id and rule_code = 'progress_drop'), 0.5) as drop_ratio,
      coalesce((select (params->>'min_baseline_events')::int from public.risk_signal_settings where org_id = p_org_id and rule_code = 'progress_drop'), 3) as min_baseline_events
  ),
  recent as (
    select actor_id as learner_id, count(*) as recent_count
    from public.learning_events
    where org_id = p_org_id and occurred_at >= now() - interval '7 days'
    group by actor_id
  ),
  baseline as (
    select actor_id as learner_id, count(*) as baseline_count
    from public.learning_events
    where org_id = p_org_id and occurred_at >= now() - interval '14 days' and occurred_at < now() - interval '7 days'
    group by actor_id
  ),
  enrolled as (
    select distinct learner_id from public.enrollments where org_id = p_org_id and status = 'active'
  )
  insert into public.risk_signals (org_id, learner_id, rule_code, factors, window_start, window_end)
  select p_org_id, en.learner_id, 'progress_drop',
    jsonb_build_object(
      'recent_count', coalesce(r.recent_count, 0),
      'baseline_count', b.baseline_count,
      'drop_ratio', round(1 - (coalesce(r.recent_count, 0)::numeric / b.baseline_count), 2)
    ),
    (current_date - 13), current_date
  from enrolled en
  join baseline b on b.learner_id = en.learner_id
  left join recent r on r.learner_id = en.learner_id
  cross join settings s
  where s.enabled
    and b.baseline_count >= s.min_baseline_events
    and coalesce(r.recent_count, 0) <= b.baseline_count * (1 - s.drop_ratio)
    and not exists (
      select 1 from public.risk_signals rs
      where rs.org_id = p_org_id and rs.learner_id = en.learner_id and rs.rule_code = 'progress_drop' and rs.status = 'open'
    );
  get diagnostics v_count = row_count;
  v_inserted := v_inserted + v_count;

  -- ANA-013 rule: blocking_prereq
  with settings as (
    select coalesce((select enabled from public.risk_signal_settings where org_id = p_org_id and rule_code = 'blocking_prereq'), true) as enabled
  ),
  locked as (
    select rs.learner_id, rs.target_type, rs.target_id, rs.reason, rs.computed_at
    from public.release_state rs
    join public.enrollments e on e.learner_id = rs.learner_id and e.org_id = rs.org_id and e.status = 'active'
    where rs.org_id = p_org_id and rs.effect = 'locked'
  )
  insert into public.risk_signals (org_id, learner_id, rule_code, factors, window_start, window_end)
  select p_org_id, l.learner_id, 'blocking_prereq',
    jsonb_build_object('target_type', l.target_type, 'target_id', l.target_id, 'reason', l.reason),
    l.computed_at::date, current_date
  from locked l, settings s
  where s.enabled
    and not exists (
      select 1 from public.risk_signals rs
      where rs.org_id = p_org_id and rs.learner_id = l.learner_id and rs.rule_code = 'blocking_prereq'
        and rs.status = 'open' and (rs.factors->>'target_id') = l.target_id::text
    );
  get diagnostics v_count = row_count;
  v_inserted := v_inserted + v_count;

  return v_inserted;
end;
$$;

revoke all on function public._generate_risk_signals_internal(uuid) from public;

create or replace function public.generate_risk_signals(p_org_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_org_role(p_org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  return public._generate_risk_signals_internal(p_org_id);
end;
$$;

revoke all on function public.generate_risk_signals(uuid) from public;
grant execute on function public.generate_risk_signals(uuid) to authenticated;

-- ── scheduled entry point ────────────────────────────────────────────────
-- One org's failure (bad data, an unexpected null) must not abort every
-- other org's nightly run — each org is isolated in its own sub-transaction
-- via the exception handler, matching the "idempotent, replayable" shape
-- these two RPCs were already built with.
create or replace function public.run_scheduled_lms_analytics_jobs()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org record;
  v_yesterday date := current_date - 1;
begin
  for v_org in select id from public.organizations loop
    begin
      perform public._run_daily_analytics_rollup_internal(v_org.id, v_yesterday);
    exception when others then
      raise warning 'run_scheduled_lms_analytics_jobs: rollup failed for org %: %', v_org.id, sqlerrm;
    end;

    begin
      perform public._generate_risk_signals_internal(v_org.id);
    exception when others then
      raise warning 'run_scheduled_lms_analytics_jobs: risk signals failed for org %: %', v_org.id, sqlerrm;
    end;
  end loop;
end;
$$;

-- Not granted to authenticated/anon at all — same "service-role/scheduler
-- only" posture as lti_login_states (RLS enabled, zero client policies).
revoke all on function public.run_scheduled_lms_analytics_jobs() from public;

select cron.schedule(
  'lms-daily-analytics-and-risk-signals',
  '0 3 * * *',
  $$select public.run_scheduled_lms_analytics_jobs();$$
);
