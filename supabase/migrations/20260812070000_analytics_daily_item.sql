-- Spec 07 — Analytics pédagogiques, psychométrie et signaux de risque
-- (docs/product-specs/2026-08-10-lms-program/07-learning-analytics.md).
--
-- RESTE-A-FAIRE.md §07: "Projection journalière item — n'était bloquée que
-- par l'absence de moteur de correction (spec 08, fait).
-- assessment_responses porte maintenant is_correct/points_earned par
-- item_revision_id : la matière première existe, la projection/l'agrégat
-- lui-même reste à écrire." This migration writes that aggregate.
--
-- Scope, stated explicitly like the correction engine migration before it:
--   - Covers ANA-009's response count, correct-answer rate and omission
--     rate, plus an average score ratio (useful for the partial-credit mcq
--     case the correction engine already supports).
--   - "Temps médian" (also ANA-009) is NOT covered: assessment_responses has
--     no per-item timing column at all (only answered_at, a point in time,
--     not a duration — the correction engine migration never added one).
--     Adding a duration column here to serve one field would be guessing a
--     capture mechanism (client-reported? server request-to-request?) that
--     spec 08 itself never defined.
--   - ANA-010 (distractor attractivity by performance group), ANA-011
--     (difficulty/discrimination) and ANA-012 (psychometric warnings) are
--     NOT covered — those need a performance-group split (top/bottom
--     quartile by attempt score) and per-option response distributions,
--     a materially bigger aggregate than a daily rollup row. Left as
--     reste-à-faire, not stubbed.
--   - Day bucketing mirrors analytics_daily_activity/enrollment/competency:
--     an item-response event counts on the day it was answered
--     (answered_at), or — if left blank — the day the attempt that left it
--     blank was finalized (submitted_at). A response belonging to an
--     attempt still in_progress is neither answered nor omitted yet; it
--     contributes to no day until one of those two things happens.

create table public.analytics_daily_item (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  item_revision_id uuid not null references public.assessment_item_revisions(id) on delete cascade,
  day              date not null,
  responses_count  integer not null default 0,
  correct_count    integer not null default 0,
  omitted_count    integer not null default 0,
  avg_score_ratio  numeric,
  computed_at      timestamptz not null default now(),
  unique (org_id, item_revision_id, day)
);
create index analytics_daily_item_org_day_idx on public.analytics_daily_item(org_id, day);
create index analytics_daily_item_revision_idx on public.analytics_daily_item(item_revision_id, day desc);

alter table public.analytics_daily_item enable row level security;

-- No client insert/update/delete: only the rollup internal (security
-- definer) writes — same posture as the other three daily projections.
create policy analytics_daily_item_staff_read on public.analytics_daily_item
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));

-- ── _run_daily_analytics_rollup_internal(): add the item block ─────────────
-- Full body of 20260812020000_scheduler.sql's version, verbatim, plus the
-- new insert into analytics_daily_item at the end. Everything above the new
-- block is unchanged.
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

  -- ANA-009 (partial: no median time, see migration header)
  insert into public.analytics_daily_item (org_id, item_revision_id, day, responses_count, correct_count, omitted_count, avg_score_ratio, computed_at)
  select a.org_id, r.item_revision_id, p_day,
    count(*) filter (where r.answered_at is not null),
    count(*) filter (where r.is_correct),
    count(*) filter (where r.answered_at is null),
    avg(r.points_earned / nullif(r.max_points, 0)) filter (where r.answered_at is not null),
    now()
  from public.assessment_responses r
  join public.assessment_attempts att on att.id = r.attempt_id
  join public.assessments a on a.id = att.assessment_id
  where a.org_id = p_org_id
    and (
      (r.answered_at is not null and r.answered_at::date = p_day)
      or (r.answered_at is null and att.status = 'submitted' and att.submitted_at::date = p_day)
    )
  group by a.org_id, r.item_revision_id
  on conflict (org_id, item_revision_id, day) do update set
    responses_count = excluded.responses_count,
    correct_count = excluded.correct_count,
    omitted_count = excluded.omitted_count,
    avg_score_ratio = excluded.avg_score_ratio,
    computed_at = excluded.computed_at;
end;
$$;

revoke all on function public._run_daily_analytics_rollup_internal(uuid, date) from public;
