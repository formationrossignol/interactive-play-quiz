-- Spec 05 — Accessibilité, inclusion et aménagements individuels
-- (docs/product-specs/2026-08-10-lms-program/05-accessibility-accommodations.md).
--
-- ACC-002/003 config existed (accommodation_rules.rule_type already accepts
-- 'extra_time'/'no_time_limit'/'extended_deadline') but nothing computed an
-- actual effect from it — see VALIDATION-STATUS.md §05. This migration wires
-- the one part of that which has a genuinely server-authoritative surface to
-- hook into: assignment due dates (spec 01's submit_assignment() already
-- computes lateness server-side). `no_time_limit` lifts the deadline
-- entirely; `extended_deadline` pushes it out by `value->>'extra_days'`.
--
-- Deliberately NOT covered here: `extra_time` for timed quiz/exam attempts.
-- The only timed-attempt system in this codebase (exams/exam_attempts,
-- 20260721120000_exam_tables.sql) is explicitly documented as Tier-1/
-- client-trusted — "the client still computes the score... server-side
-- tamper-proof scoring is deliberately deferred" — and the LMS's own
-- assessment engine (spec 08) has no scoring/attempt runner yet either
-- (VALIDATION-STATUS §08: "aucune fonction ne lit encore item_answer_keys").
-- There is no server-authoritative timed session to extend. Computing
-- "temps supplémentaire" against a client-trusted timer would be
-- security theater, not the acceptance criterion's "calculé côté serveur" —
-- so it stays unimplemented rather than faked.

-- ── effective_assignment_due_at() : ACC-004 merge applied to a real deadline ─
create or replace function public.effective_assignment_due_at(p_assignment_id uuid, p_learner_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base timestamptz;
  v_profile public.accommodation_profiles;
  v_no_limit jsonb;
  v_extended jsonb;
begin
  -- ASG-004 base resolution (per-learner target override, else assignment default).
  select coalesce(
    (select due_override from public.assignment_targets
     where assignment_id = p_assignment_id and target_type = 'learner' and target_id = p_learner_id and due_override is not null
     limit 1),
    (select due_at from public.assignments where id = p_assignment_id)
  ) into v_base;

  select * into v_profile
  from public.accommodation_profiles
  where learner_id = p_learner_id and status = 'active'
    and valid_from <= current_date and (valid_until is null or valid_until >= current_date)
  order by created_at desc
  limit 1;

  if v_profile.id is null then
    return v_base;
  end if;

  -- "Toute lecture... d'un profil d'aménagement est auditée" — same log
  -- get_effective_accommodations() writes to, so a due-date computation
  -- shows up in the same trail as an explicit accommodation lookup.
  insert into public.accommodation_access_log (profile_id, actor_id, action)
  values (v_profile.id, coalesce(auth.uid(), p_learner_id), 'read');

  -- ACC-004: an activity-scoped override (accommodation_overrides for this
  -- exact assignment) beats the standing profile-level rule.
  select coalesce(o.value, r.value) into v_no_limit
  from public.accommodation_rules r
  left join public.accommodation_overrides o
    on o.profile_id = r.profile_id and o.rule_type = r.rule_type
    and o.target_type = 'assignment' and o.target_id = p_assignment_id
  where r.profile_id = v_profile.id and r.rule_type = 'no_time_limit';

  if v_no_limit is not null and coalesce((v_no_limit->>'enabled')::boolean, true) then
    return null;
  end if;

  select coalesce(o.value, r.value) into v_extended
  from public.accommodation_rules r
  left join public.accommodation_overrides o
    on o.profile_id = r.profile_id and o.rule_type = r.rule_type
    and o.target_type = 'assignment' and o.target_id = p_assignment_id
  where r.profile_id = v_profile.id and r.rule_type = 'extended_deadline';

  if v_extended is not null and v_base is not null then
    return v_base + make_interval(days => coalesce((v_extended->>'extra_days')::int, 0));
  end if;

  return v_base;
end;
$$;

revoke all on function public.effective_assignment_due_at(uuid, uuid) from public;
grant execute on function public.effective_assignment_due_at(uuid, uuid) to authenticated;

-- ── submit_assignment() : lateness now accommodation-aware ─────────────────
create or replace function public.submit_assignment(
  p_assignment_id uuid,
  p_kind text,
  p_text_content text default null,
  p_url text default null,
  p_finalize boolean default true
)
returns public.submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.assignments;
  v_submission public.submissions;
  v_due timestamptz;
  v_next_version integer;
  v_is_late boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_assignment from public.assignments where id = p_assignment_id and status = 'published';
  if v_assignment.id is null then
    raise exception 'Assignment not found';
  end if;
  if not public.assignment_visible_to_learner(p_assignment_id, auth.uid()) then
    raise exception 'Not authorized';
  end if;

  insert into public.submissions (assignment_id, learner_id, status)
  values (p_assignment_id, auth.uid(), 'draft')
  on conflict (assignment_id, learner_id) do update set assignment_id = excluded.assignment_id
  returning * into v_submission;

  if v_submission.status in ('graded','void') then
    raise exception 'submission_locked';
  end if;

  v_due := public.effective_assignment_due_at(p_assignment_id, auth.uid());

  if p_finalize then
    v_is_late := v_due is not null and now() > v_due;
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version from public.submission_versions where submission_id = v_submission.id;

  insert into public.submission_versions (submission_id, version, kind, text_content, url, is_draft, is_late, submitted_at)
  values (v_submission.id, v_next_version, p_kind, p_text_content, p_url, not p_finalize, v_is_late, now());

  update public.submissions
  set active_version = v_next_version,
      status = case when not p_finalize then 'draft' when v_is_late then 'late' else 'submitted' end
  where id = v_submission.id
  returning * into v_submission;

  if p_finalize then
    perform public.emit_learning_event('submission.submitted', v_assignment.org_id, auth.uid(), 'submission', v_submission.id, jsonb_build_object('assignment_id', p_assignment_id, 'late', v_is_late));
  end if;

  return v_submission;
end;
$$;

revoke all on function public.submit_assignment(uuid, text, text, text, boolean) from public;
grant execute on function public.submit_assignment(uuid, text, text, text, boolean) to authenticated;

-- ── generate_risk_signals() : 'overdue' rule now accommodation-aware ───────
-- Otherwise a learner with an extended_deadline/no_time_limit accommodation
-- would get incorrectly flagged "overdue" by the very rule this migration
-- exists to make honest — same full-body replacement as
-- 20260811010000_learning_analytics_aggregation.sql, only the effective-due
-- resolution in the 'overdue' block changed (see that migration for the
-- other three rules' rationale, unchanged here).
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

  return v_inserted;
end;
$$;

revoke all on function public.generate_risk_signals(uuid) from public;
grant execute on function public.generate_risk_signals(uuid) to authenticated;
