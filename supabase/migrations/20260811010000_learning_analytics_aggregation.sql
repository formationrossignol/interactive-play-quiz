-- Spec 07 — Analytics pédagogiques, psychométrie et signaux de risque
-- (docs/product-specs/2026-08-10-lms-program/07-learning-analytics.md).
--
-- Follow-up to 20260810210000_learning_analytics.sql, which laid down the
-- definition/report layer but left "la couche d'agrégation" entirely
-- unbuilt (see VALIDATION-STATUS.md §07). This migration adds:
--   - daily projections for activité/inscription/compétence (ANA
--     "Architecture des données"), computed by run_daily_analytics_rollup()
--   - rule-based risk signal generation (ANA-013) via generate_risk_signals()
--   - risk_signal_settings (ANA-016): per-org enable/threshold per rule
--
-- Not covered here, and not faked:
--   - item/programme projections — item-level analytics (ANA-009/010) needs
--     an actual answer-scoring engine reading item_answer_keys, which spec
--     08's own reste-à-faire says does not exist yet. Building a projection
--     shape for data nobody produces would just be guessing a schema.
--   - the 'blocking_prereq' risk rule — depends on 06's release_state,
--     which is "posée, jamais calculée" per VALIDATION-STATUS §06. Left out
--     of generate_risk_signals() rather than stubbed.
--   - an actual scheduler. Like every other "job" left as reste-à-faire
--     across this program, these are idempotent, replayable SQL functions
--     a cron/edge function can call — no pg_cron wiring exists anywhere in
--     this codebase yet, so none is invented here either.

-- ── risk_signal_settings : ANA-016 per-org enable/threshold ────────────────
create table public.risk_signal_settings (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  rule_code  text not null check (rule_code in ('inactivity','overdue','repeated_failure','progress_drop','blocking_prereq')),
  enabled    boolean not null default true,
  params     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (org_id, rule_code)
);
create trigger risk_signal_settings_touch before update on public.risk_signal_settings
  for each row execute function public.touch_updated_at();

alter table public.risk_signal_settings enable row level security;
create policy risk_signal_settings_read on public.risk_signal_settings
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));
create policy risk_signal_settings_manage on public.risk_signal_settings
  for all using (public.has_org_role(org_id, array['pedago','admin']))
  with check (public.has_org_role(org_id, array['pedago','admin']));

-- ── daily projections ────────────────────────────────────────────────────
-- Sparse by design: a row exists only for a (subject, day) that actually had
-- activity. Recomputable — run_daily_analytics_rollup() upserts, so a
-- replayed rollup for the same day never double-counts (ANA acceptance:
-- "les événements rejoués ne gonflent pas les agrégats").

create table public.analytics_daily_activity (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  learner_id   uuid not null references auth.users(id) on delete cascade,
  day          date not null,
  events_count integer not null default 0,
  event_names  text[] not null default '{}',
  last_event_at timestamptz,
  computed_at  timestamptz not null default now(),
  unique (org_id, learner_id, day)
);
create index analytics_daily_activity_org_day_idx on public.analytics_daily_activity(org_id, day);
create index analytics_daily_activity_learner_idx on public.analytics_daily_activity(learner_id, day desc);

-- Transitions of the day, not a point-in-time snapshot: "active as of this
-- day" would need a full enrollment_history replay per session per day,
-- which belongs in the eventual dashboard query, not baked into a
-- projection table.
create table public.analytics_daily_enrollment (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  session_id      uuid not null references public.course_sessions(id) on delete cascade,
  day             date not null,
  started_count   integer not null default 0,
  completed_count integer not null default 0,
  withdrawn_count integer not null default 0,
  waitlisted_count integer not null default 0,
  computed_at     timestamptz not null default now(),
  unique (org_id, session_id, day)
);
create index analytics_daily_enrollment_org_day_idx on public.analytics_daily_enrollment(org_id, day);

-- avg_mastery_position is the *current* mastery snapshot at rollup time
-- (joined via mastery_scale_levels.position), not a historical reading for
-- that specific day — competency_mastery has no history-by-day granularity
-- to reconstruct from, only competency_mastery_history's individual jumps.
create table public.analytics_daily_competency (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations(id) on delete cascade,
  competency_id         uuid not null references public.competencies(id) on delete cascade,
  day                   date not null,
  evidence_count        integer not null default 0,
  mastery_changed_count integer not null default 0,
  avg_mastery_position  numeric,
  computed_at           timestamptz not null default now(),
  unique (org_id, competency_id, day)
);
create index analytics_daily_competency_org_day_idx on public.analytics_daily_competency(org_id, day);

alter table public.analytics_daily_activity enable row level security;
alter table public.analytics_daily_enrollment enable row level security;
alter table public.analytics_daily_competency enable row level security;

-- No client insert/update/delete: only run_daily_analytics_rollup() (security
-- definer) writes.
create policy analytics_daily_activity_staff_read on public.analytics_daily_activity
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));
create policy analytics_daily_enrollment_staff_read on public.analytics_daily_enrollment
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));
create policy analytics_daily_competency_staff_read on public.analytics_daily_competency
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));

-- ── run_daily_analytics_rollup() ────────────────────────────────────────────
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

revoke all on function public.run_daily_analytics_rollup(uuid, date) from public;
grant execute on function public.run_daily_analytics_rollup(uuid, date) to authenticated;

-- ── generate_risk_signals() ─────────────────────────────────────────────────
-- One open signal per (learner, rule) at a time, except 'overdue' which is
-- per (learner, assignment) since several assignments can be overdue at
-- once. Re-running never duplicates an already-open signal; once staff
-- resolve it via resolve_risk_signal(), the next run can open a fresh one
-- if the condition still holds — same "idempotent, replayable" shape as
-- record_automation_run() in spec 06.
create or replace function public.generate_risk_signals(p_org_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
  v_count integer;
begin
  if not public.has_org_role(p_org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;

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

  -- ANA-013 rule: overdue (assignment past due, no submission or still a draft)
  with settings as (
    select
      coalesce((select enabled from public.risk_signal_settings where org_id = p_org_id and rule_code = 'overdue'), true) as enabled,
      coalesce((select (params->>'grace_days')::int from public.risk_signal_settings where org_id = p_org_id and rule_code = 'overdue'), 0) as grace_days
  ),
  target_learners as (
    select t.assignment_id, t.target_id as learner_id, t.due_override
    from public.assignment_targets t
    where t.target_type = 'learner'
    union
    select t.assignment_id, gm.user_id, t.due_override
    from public.assignment_targets t
    join public.share_group_members gm on gm.group_id = t.target_id
    where t.target_type = 'group'
    union
    select t.assignment_id, e.learner_id, t.due_override
    from public.assignment_targets t
    join public.enrollments e on e.session_id = t.target_id and e.status = 'active'
    where t.target_type = 'session'
  ),
  missing as (
    select a.id as assignment_id, a.title, tl.learner_id,
           coalesce(tl.due_override, a.due_at) as effective_due_at
    from public.assignments a
    join target_learners tl on tl.assignment_id = a.id
    left join public.submissions s on s.assignment_id = a.id and s.learner_id = tl.learner_id
    where a.org_id = p_org_id and a.status = 'published' and a.due_at is not null
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

  return v_inserted;
end;
$$;

revoke all on function public.generate_risk_signals(uuid) from public;
grant execute on function public.generate_risk_signals(uuid) to authenticated;
