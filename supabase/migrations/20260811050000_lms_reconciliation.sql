-- LMS ↔ pre-existing systems reconciliation.
--
-- The LMS program (specs 01-10, 20260810150000-20260811040000) was built
-- from each spec's own "modèle de données indicatif" in isolation — several
-- pieces ended up disconnected from systems the app already had. Confirmed
-- by audit (grep across every 2026081* migration + the frontend):
--   - grade_items.source_type already lists 'assignment'/'quiz'/'exam'/
--     'manual'/'scorm'/'h5p', and 20260810160000's own header comment claims
--     manual_evaluations "becomes one grade_items.source_type" — but the
--     only writer is publish_submission_grade(), hard-coded to 'assignment'.
--     A learner's exam or manually-graded result was invisible to the
--     "unified" gradebook.
--   - notifications/notification_preferences already exist and are already
--     wired for manual grading (notify_manual_grade_publication()) — zero
--     LMS migration ever inserts into notifications.
--   - publish_content_version()/restore_content_version() (spec 10) never
--     wrote the snapshot back to content.data — "restore" didn't restore
--     anything a user would actually see. A real bug, not a missing feature.
--   - enrollments.source='group' and enrollment_group_sources exist with no
--     code ever expanding a share_group's members into enrollments.
--
-- Not addressed here (each needs its own design, not a bolt-on): the item
-- bank (assessment_items) has no link back to existing quiz questions;
-- certificates (course_id-text-keyed) has no link to completion/mastery;
-- grade_items vs competency_evidence source_type naming is inconsistent but
-- cosmetic; time-based reminders need a scheduler this repo doesn't have;
-- plan/Stripe gating vs org-role LMS access is a business-model question,
-- not something to silently resolve either way.

-- ── A. exam_attempts gets an optional learner identity ─────────────────────
-- Nullable: anonymous exam-taking (no login, join-code only) keeps working
-- exactly as today. Only attempts where we can resolve a real learner ever
-- reach the gradebook — never trust participant_email, which is
-- self-reported and unverified in the Tier-1 flow.
alter table public.exam_attempts add column learner_id uuid references auth.users(id) on delete set null;

create or replace function public.start_exam_attempt_atomic(
  p_exam_id uuid,
  p_participant_id text,
  p_participant_name text,
  p_participant_email text,
  p_max_attempts integer,
  p_max_participants integer,
  p_question_order jsonb,
  p_learner_id uuid default null
) returns jsonb
language plpgsql
as $$
declare
  active_row public.exam_attempts%rowtype;
  completed_count integer;
  distinct_count integer;
  new_row public.exam_attempts%rowtype;
begin
  perform 1 from public.exams where id = p_exam_id for update;

  select * into active_row from public.exam_attempts
    where exam_id = p_exam_id and participant_id = p_participant_id and status = 'in-progress'
    limit 1;
  if found then
    return jsonb_build_object('outcome', 'resumed', 'attempt', to_jsonb(active_row));
  end if;

  select count(*) into completed_count from public.exam_attempts
    where exam_id = p_exam_id and participant_id = p_participant_id and status <> 'in-progress';
  if completed_count >= p_max_attempts then
    return jsonb_build_object('outcome', 'exhausted');
  end if;

  if p_max_participants is not null and completed_count = 0 then
    select count(distinct participant_id) into distinct_count
      from public.exam_attempts where exam_id = p_exam_id;
    if distinct_count >= p_max_participants then
      return jsonb_build_object('outcome', 'full');
    end if;
  end if;

  insert into public.exam_attempts (
    exam_id, participant_id, participant_name, participant_email,
    question_order, answers, status, logs, learner_id
  ) values (
    p_exam_id, p_participant_id, p_participant_name, p_participant_email,
    p_question_order, '{}'::jsonb, 'in-progress',
    jsonb_build_array(jsonb_build_object('event', 'started', 'timestamp', now())),
    p_learner_id
  ) returning * into new_row;

  return jsonb_build_object('outcome', 'started', 'attempt', to_jsonb(new_row));
end;
$$;

-- ── sync_exam_attempt_to_gradebook() : exam results → grade_items/grade_results ─
-- Fires on the exact write submit-exam-attempt already does (score+percentage
-- +status set together in one UPDATE) — no scheduler, no polling. Exam
-- results are normalized as a 0-100 percentage (max_points=100): exams have
-- no fixed "raw max points" the way assignments do, this is the simplest
-- correct mapping. 'cancelled' attempts and attempts with no learner_id
-- never reach here.
create or replace function public.sync_exam_attempt_to_gradebook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam public.exams;
  v_grade_item public.grade_items;
  v_existing public.grade_results;
begin
  if new.learner_id is null or new.percentage is null then
    return new;
  end if;
  if new.status not in ('submitted', 'auto-submitted') then
    return new;
  end if;

  select * into v_exam from public.exams where id = new.exam_id;
  if v_exam.id is null or v_exam.org_id is null then
    return new;
  end if;

  insert into public.grade_items (org_id, source_type, source_id, title, max_points)
  values (v_exam.org_id, 'exam', v_exam.id, v_exam.title, 100)
  on conflict (source_type, source_id) do update set title = excluded.title
  returning * into v_grade_item;

  select * into v_existing from public.grade_results
  where grade_item_id = v_grade_item.id and learner_id = new.learner_id;

  if v_existing.id is null then
    insert into public.grade_results (grade_item_id, learner_id, status, points, published_at)
    values (v_grade_item.id, new.learner_id, 'graded', new.percentage, coalesce(new.submitted_at, now()));
  elsif v_exam.score_retention_policy = 'last' or coalesce(new.percentage, 0) > coalesce(v_existing.points, 0) then
    update public.grade_results
    set points = new.percentage, published_at = coalesce(new.submitted_at, now())
    where id = v_existing.id;
  end if;

  return new;
end;
$$;

drop trigger if exists exam_attempt_sync_gradebook on public.exam_attempts;
create trigger exam_attempt_sync_gradebook after insert or update on public.exam_attempts
  for each row execute function public.sync_exam_attempt_to_gradebook();

-- ── sync_manual_grade_to_gradebook() : manual grades → grade_items/grade_results ─
-- Numeric grading_type only: 'validation' evaluations ("Validé"/"Non
-- validé"/"À revoir") have no numeric score and aren't force-mapped into a
-- points-based gradebook.
create or replace function public.sync_manual_grade_to_gradebook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evaluation public.manual_evaluations;
  v_grade_item public.grade_items;
  v_org_id uuid;
begin
  if new.workflow_status <> 'published' or new.score is null then
    return new;
  end if;

  select * into v_evaluation from public.manual_evaluations where id = new.evaluation_id;
  if v_evaluation.id is null or v_evaluation.grading_type <> 'numeric' then
    return new;
  end if;

  select org_id into v_org_id from public.content where id = v_evaluation.content_id;
  if v_org_id is null then
    select org_id into v_org_id from public.user_org_roles where user_id = v_evaluation.owner_id order by created_at limit 1;
  end if;
  if v_org_id is null then
    return new;
  end if;

  insert into public.grade_items (org_id, source_type, source_id, title, max_points)
  values (v_org_id, 'manual', v_evaluation.id, v_evaluation.name, v_evaluation.maximum_score)
  on conflict (source_type, source_id) do update set title = excluded.title, max_points = excluded.max_points
  returning * into v_grade_item;

  insert into public.grade_results (grade_item_id, learner_id, status, points, published_at)
  values (v_grade_item.id, new.learner_id, 'graded', new.score, coalesce(new.published_at, now()))
  on conflict (grade_item_id, learner_id) do update
    set points = excluded.points, published_at = excluded.published_at, status = 'graded';

  return new;
end;
$$;

drop trigger if exists manual_grade_sync_gradebook on public.manual_grades;
create trigger manual_grade_sync_gradebook after insert or update on public.manual_grades
  for each row execute function public.sync_manual_grade_to_gradebook();

-- ── B. notify_lms_grade_publication() : grade_results → learner's inbox ────
-- Same shape as notify_manual_grade_publication() (20260729120000), reusing
-- the existing 'system' category and notification_category_enabled() gate —
-- no schema change needed, 'system' already defaults to enabled.
--
-- Skips source_type='manual': manual_grades already has its own
-- notify_manual_grade_publication() trigger, and sync_manual_grade_to_gradebook()
-- (above) writes to grade_results as a side effect of that same publish —
-- without this guard a manual grade publish fires two notifications for one
-- event (caught by testing this migration, not by inspection).
create or replace function public.notify_lms_grade_publication()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text;
  v_source_type text;
begin
  if new.status <> 'graded' or new.points is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.points is not distinct from new.points and old.status = new.status then
    return new;
  end if;
  if not public.notification_category_enabled(new.learner_id, 'system') then
    return new;
  end if;

  select title, source_type into v_title, v_source_type from public.grade_items where id = new.grade_item_id;
  if v_source_type = 'manual' then
    return new;
  end if;

  insert into public.notifications (user_id, category, title, body, action_url, metadata)
  values (
    new.learner_id,
    'system',
    case when tg_op = 'UPDATE' then 'Une note a été révisée' else 'Une nouvelle note est disponible' end,
    coalesce(v_title, ''),
    '/lms/assignments',
    jsonb_build_object('grade_item_id', new.grade_item_id, 'grade_result_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists grade_results_notify on public.grade_results;
create trigger grade_results_notify after insert or update on public.grade_results
  for each row execute function public.notify_lms_grade_publication();

-- ── C. publish_content_version() / restore_content_version() : real writes ─
-- Previously bookkeeping-only — "restore" never restored anything a user
-- would see. Now both actually update the live content.data.
create or replace function public.publish_content_version(
  p_content_id uuid,
  p_expected_version integer,
  p_snapshot jsonb,
  p_changelog text default null
)
returns public.content_versions
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_content public.content;
  v_current_max integer;
  v_result public.content_versions;
begin
  select * into v_content from public.content where id = p_content_id for update;
  if v_content.id is null then
    raise exception 'Content not found';
  end if;
  if v_content.user_id <> auth.uid() and not public.has_org_role(v_content.org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  select coalesce(max(version), 0) into v_current_max from public.content_versions where content_id = p_content_id;
  if v_current_max <> p_expected_version then
    raise exception 'version_conflict';
  end if;

  insert into public.content_versions (content_id, version, snapshot, hash, changelog, status, approved_by)
  values (p_content_id, v_current_max + 1, p_snapshot, encode(digest(p_snapshot::text, 'sha256'), 'hex'), p_changelog, 'published', auth.uid())
  returning * into v_result;

  update public.content set data = p_snapshot, updated_at = now() where id = p_content_id;

  perform public.emit_learning_event('content.published', v_content.org_id, auth.uid(), 'content', p_content_id, jsonb_build_object('version', v_result.version));

  return v_result;
end;
$$;

create or replace function public.restore_content_version(p_content_id uuid, p_from_version integer)
returns public.content_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.content_versions;
  v_current_max integer;
  v_result public.content_versions;
  v_org_id uuid;
  v_owner uuid;
begin
  select user_id, org_id into v_owner, v_org_id from public.content where id = p_content_id;
  if v_owner is null then
    raise exception 'Content not found';
  end if;
  if v_owner <> auth.uid() and not public.has_org_role(v_org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  select * into v_source from public.content_versions where content_id = p_content_id and version = p_from_version;
  if v_source.id is null then
    raise exception 'Version not found';
  end if;

  select max(version) into v_current_max from public.content_versions where content_id = p_content_id;

  insert into public.content_versions (content_id, version, snapshot, schema_version, hash, changelog, status, approved_by)
  values (p_content_id, v_current_max + 1, v_source.snapshot, v_source.schema_version, v_source.hash, format('Restored from v%s', p_from_version), 'published', auth.uid())
  returning * into v_result;

  update public.content set data = v_source.snapshot, updated_at = now() where id = p_content_id;

  return v_result;
end;
$$;

-- ── D. enroll_group_in_session() : activate the dormant source='group' path ─
create or replace function public.enroll_group_in_session(p_session_id uuid, p_group_id uuid)
returns table(learner_id uuid, outcome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.course_sessions;
  v_member record;
  v_enrollment public.enrollments;
begin
  select * into v_session from public.course_sessions where id = p_session_id;
  if v_session.id is null then
    raise exception 'Session not found';
  end if;
  if not public.has_org_role(v_session.org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  for v_member in select gm.user_id from public.share_group_members gm where gm.group_id = p_group_id and gm.user_id is not null
  loop
    begin
      v_enrollment := public.enroll_in_session(p_session_id, v_member.user_id, 'group');
      insert into public.enrollment_group_sources (enrollment_id, group_id) values (v_enrollment.id, p_group_id)
      on conflict do nothing;
      learner_id := v_member.user_id;
      outcome := v_enrollment.status;
      return next;
    exception when others then
      learner_id := v_member.user_id;
      outcome := 'error';
      return next;
    end;
  end loop;

  return;
end;
$$;

revoke all on function public.enroll_group_in_session(uuid, uuid) from public;
grant execute on function public.enroll_group_in_session(uuid, uuid) to authenticated;
