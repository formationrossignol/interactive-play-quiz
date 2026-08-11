-- Spec 07 — Analytics pédagogiques, psychométrie et signaux de risque
-- (docs/product-specs/2026-08-10-lms-program/07-learning-analytics.md).
--
-- generate_risk_signals() (20260811010000, amended 20260811040000) shipped
-- with 4 of the 5 ANA-013 rules; 'blocking_prereq' was explicitly left out
-- because it depends on release_state, which spec 06 had "posée, jamais
-- calculée" until 20260811070000_release_state_engine.sql made it real.
-- That dependency is now satisfied — this migration adds the 5th rule.
-- Same full-body replacement pattern as the prior amendment (the other 4
-- rules are unchanged, copied verbatim).
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

  -- ANA-013 rule: blocking_prereq — a locked release_state row is exactly
  -- what "prérequis bloquant" means; no aging threshold like the other
  -- rules (this isn't about elapsed time, it's about being blocked right
  -- now). Deduped per (learner, target) since a learner can be blocked on
  -- several different targets simultaneously, same shape as 'overdue'.
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

revoke all on function public.generate_risk_signals(uuid) from public;
grant execute on function public.generate_risk_signals(uuid) to authenticated;
