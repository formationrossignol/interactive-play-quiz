-- Spec 01 — Devoirs, remises et carnet de notes
-- (docs/product-specs/2026-08-10-lms-program/01-assignments-gradebook.md).
--
-- RESTE-A-FAIRE.md §01: "Double correction / correction anonyme (GRD-005)
-- — colonne is_anonymous posée, pas de flux de levée d'anonymat auditée."
-- GRD-005's own text: "Correction anonyme et double correction sont des
-- options de devoir. La levée d'anonymat est auditée." Two separate
-- options; the RESTE-A-FAIRE sentence ("colonne... flux") describes only
-- the anonymity half — submission_assessments.is_anonymous already exists
-- (default false, never read or written anywhere in the codebase today,
-- confirmed by grep). Double correction has no schema at all (no
-- second-grader column, no reconciliation table, nothing in the spec's own
-- indicative data model either) — a materially bigger, currently-undefined
-- design surface, left open rather than guessed here.
--
-- This migration builds only the anonymity half:
--   - assignments.policy (jsonb, already exists, always '{}' today) gets
--     one new key, {"anonymous_grading": true} — an assignment-level
--     option, not a new column, consistent with what that column was
--     already typed for.
--   - submission_anonymity_lifts: append-only audit log, same shape/
--     posture as accommodation_access_log (20260810190000) — the only
--     existing "audited reveal" precedent in this codebase. No reason
--     column: accommodation_access_log logs every read unconditionally
--     with no justification field either: staff role + audit trail is the
--     control, not a written reason.
--   - list_submissions_for_grading(): replaces the direct
--     `submissions.select('*')` GradingPanel used before — RLS on
--     submissions is column-blind (submissions_staff_read exposes every
--     column including learner_id unconditionally), so masking has to
--     happen in a function, not a policy. Returns learner_id = null and
--     anonymized = true for a submission under an anonymous assignment
--     until the calling actor has lifted it themselves (persists across
--     reloads — checked via exists(), not a session flag).
--   - lift_submission_anonymity(): the only way learner_id is ever
--     revealed for an anonymous assignment; logs before returning, mirrors
--     get_effective_accommodations()'s log-then-return shape exactly.
--   - publish_submission_grade(): now actually sets is_anonymous on the
--     submission_assessments row it inserts, from the assignment's own
--     policy at the moment of grading — a permanent historical record of
--     whether that specific grade was produced anonymously, independent
--     of whether the policy is later toggled off.

create table public.submission_anonymity_lifts (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  actor_id      uuid not null references auth.users(id),
  created_at    timestamptz not null default now()
);
create index submission_anonymity_lifts_submission_idx on public.submission_anonymity_lifts(submission_id, actor_id);

alter table public.submission_anonymity_lifts enable row level security;

-- Only org admin can browse the raw log (same posture as
-- accommodation_access_log_admin_read) — nobody writes directly, only
-- lift_submission_anonymity() (security definer) does.
create policy submission_anonymity_lifts_admin_read on public.submission_anonymity_lifts
  for select using (
    exists (
      select 1 from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.id = submission_id and public.has_org_role(a.org_id, array['admin'])
    )
  );

-- ── list_submissions_for_grading(): masking read path ───────────────────
create or replace function public.list_submissions_for_grading(p_assignment_id uuid)
returns table(
  id uuid, assignment_id uuid, learner_id uuid, status text, active_version integer,
  created_at timestamptz, updated_at timestamptz,
  plagiarism_check_status text, plagiarism_check_note text, plagiarism_checked_by uuid, plagiarism_checked_at timestamptz,
  anonymized boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_anonymous boolean;
begin
  select a.org_id, coalesce((a.policy->>'anonymous_grading')::boolean, false)
    into v_org_id, v_anonymous
  from public.assignments a where a.id = p_assignment_id;

  if v_org_id is null then
    raise exception 'assignment_not_found';
  end if;
  if not public.has_org_role(v_org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  return query
    select
      s.id, s.assignment_id,
      case when v_anonymous and not exists (
        select 1 from public.submission_anonymity_lifts l where l.submission_id = s.id and l.actor_id = auth.uid()
      ) then null::uuid else s.learner_id end,
      s.status, s.active_version, s.created_at, s.updated_at,
      s.plagiarism_check_status, s.plagiarism_check_note, s.plagiarism_checked_by, s.plagiarism_checked_at,
      (v_anonymous and not exists (
        select 1 from public.submission_anonymity_lifts l where l.submission_id = s.id and l.actor_id = auth.uid()
      ))
    from public.submissions s
    where s.assignment_id = p_assignment_id;
end;
$$;

revoke all on function public.list_submissions_for_grading(uuid) from public;
grant execute on function public.list_submissions_for_grading(uuid) to authenticated;

-- ── lift_submission_anonymity(): the only way identity is revealed ──────
create or replace function public.lift_submission_anonymity(p_submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_learner_id uuid;
begin
  select a.org_id, s.learner_id into v_org_id, v_learner_id
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where s.id = p_submission_id;

  if v_org_id is null then
    raise exception 'submission_not_found';
  end if;
  if not public.has_org_role(v_org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  insert into public.submission_anonymity_lifts (submission_id, actor_id) values (p_submission_id, auth.uid());

  return v_learner_id;
end;
$$;

revoke all on function public.lift_submission_anonymity(uuid) from public;
grant execute on function public.lift_submission_anonymity(uuid) to authenticated;

-- ── publish_submission_grade(): set is_anonymous from the assignment's
-- policy at grading time ────────────────────────────────────────────────
-- Full body from 20260810160000_assignments_gradebook.sql, verbatim,
-- except the insert into submission_assessments now sets is_anonymous.
create or replace function public.publish_submission_grade(
  p_submission_id uuid,
  p_score numeric,
  p_feedback text default '',
  p_rubric_id uuid default null,
  p_rubric_ratings jsonb default '[]'::jsonb,
  p_reason text default null
)
returns public.submission_assessments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.submissions;
  v_assignment public.assignments;
  v_assessment public.submission_assessments;
  v_grade_item public.grade_items;
  v_existing_result public.grade_results;
  v_rating jsonb;
begin
  select * into v_submission from public.submissions where id = p_submission_id for update;
  if v_submission.id is null then
    raise exception 'Submission not found';
  end if;
  select * into v_assignment from public.assignments where id = v_submission.assignment_id;
  if not public.has_org_role(v_assignment.org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  insert into public.submission_assessments (submission_id, submission_version_id, grader_id, rubric_id, score, feedback, status, is_anonymous, published_at)
  values (
    p_submission_id, (select id from public.submission_versions where submission_id = p_submission_id order by version desc limit 1),
    auth.uid(), p_rubric_id, p_score, p_feedback, 'published',
    coalesce((v_assignment.policy->>'anonymous_grading')::boolean, false), now()
  )
  returning * into v_assessment;

  for v_rating in select * from jsonb_array_elements(coalesce(p_rubric_ratings, '[]'::jsonb))
  loop
    insert into public.rubric_ratings (assessment_id, criterion_id, level_id, points, comment)
    values (v_assessment.id, (v_rating->>'criterion_id')::uuid, nullif(v_rating->>'level_id','')::uuid, coalesce((v_rating->>'points')::numeric, 0), coalesce(v_rating->>'comment',''));
  end loop;

  insert into public.grade_items (org_id, session_id, source_type, source_id, title, max_points)
  values (v_assignment.org_id, v_assignment.session_id, 'assignment', v_assignment.id, v_assignment.title, v_assignment.max_points)
  on conflict (source_type, source_id) do update set title = excluded.title
  returning * into v_grade_item;

  select * into v_existing_result from public.grade_results where grade_item_id = v_grade_item.id and learner_id = v_submission.learner_id;

  if v_existing_result.id is not null then
    if v_existing_result.published_at is not null and p_reason is null then
      raise exception 'reason_required_for_grade_revision';
    end if;
    insert into public.grade_revisions (grade_result_id, previous_points, new_points, previous_status, new_status, reason, author_id)
    values (v_existing_result.id, v_existing_result.points, p_score, v_existing_result.status, 'graded', coalesce(p_reason, 'initial publication'), auth.uid());
    update public.grade_results set status = 'graded', points = p_score, published_at = now() where id = v_existing_result.id;
  else
    insert into public.grade_results (grade_item_id, learner_id, status, points, published_at)
    values (v_grade_item.id, v_submission.learner_id, 'graded', p_score, now());
  end if;

  update public.submissions set status = 'graded' where id = p_submission_id;

  perform public.emit_learning_event('grade.published', v_assignment.org_id, v_submission.learner_id, 'submission', p_submission_id, jsonb_build_object('grade_item_id', v_grade_item.id, 'score', p_score));

  return v_assessment;
end;
$$;

revoke all on function public.publish_submission_grade(uuid, numeric, text, uuid, jsonb, text) from public;
grant execute on function public.publish_submission_grade(uuid, numeric, text, uuid, jsonb, text) to authenticated;
