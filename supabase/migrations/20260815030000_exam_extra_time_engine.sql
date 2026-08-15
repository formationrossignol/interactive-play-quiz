-- Spec 05 — extra_time réel (docs/product-specs/2026-08-10-lms-program/
-- RESTE-A-FAIRE.md §05). Previously deliberately unimplemented
-- (20260811040000_accommodation_effective_dates.sql's header comment):
-- "the only timed-attempt system in this codebase (exams/exam_attempts) is
-- explicitly documented as Tier-1/client-trusted... there is no
-- server-authoritative timed session to extend."
--
-- That's no longer true: 20260728160000_exam_scoring_tier2.sql already moved
-- start/submit behind service-role Edge Functions and exam_attempts now
-- carries learner_id (20260811050000_lms_reconciliation.sql, for gradebook
-- sync) — a real hook to resolve an accommodation profile against. What was
-- still missing, checked directly against the client code before writing
-- this: ExamRoom.tsx's countdown computed its own deadline from
-- `exam.durationMinutes` (a plain client-held number) + `attempt.startedAt`,
-- and submit-exam-attempt/index.ts trusted `body.timeUsedSeconds` outright —
-- extra_time had nothing server-side to extend and nothing server-side would
-- have enforced it even if it had. This migration makes exam_attempts carry
-- its own server-computed deadline and makes both the autosave and submit
-- paths honor it, instead of adding a client-side percentage bump that any
-- participant could just as easily apply to themselves.

-- ── exam_attempts.expires_at: server-computed deadline, fixed at start ─────
-- null = no time limit (mirrors exams.duration_minutes = null and the
-- no_time_limit accommodation, both collapse to the same "no deadline").
alter table public.exam_attempts add column if not exists expires_at timestamptz;

-- ── _effective_exam_duration_minutes: ACC-002 extra_time / no_time_limit ───
-- Same override-beats-profile precedence as effective_assignment_due_at
-- (ACC-004), same value shape the existing StaffAccommodations.tsx UI
-- already writes (`{percent}` — Accessibility.tsx:352, handleSetExtraTime).
-- Anonymous join-code takers (no learner_id — Tier 1's untracked path,
-- preserved by 20260811050000's `learnerId` being optional) have no
-- accommodation profile to resolve against and get the exam's plain
-- duration, same as before this migration.
create or replace function public._effective_exam_duration_minutes(
  p_org_id uuid,
  p_exam_id uuid,
  p_duration_minutes integer,
  p_learner_id uuid
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.accommodation_profiles;
  v_no_limit jsonb;
  v_extra jsonb;
  v_percent numeric;
begin
  if p_duration_minutes is null or p_learner_id is null then
    return p_duration_minutes;
  end if;

  select * into v_profile
  from public.accommodation_profiles
  where org_id = p_org_id and learner_id = p_learner_id and status = 'active'
    and valid_from <= current_date and (valid_until is null or valid_until >= current_date)
  order by created_at desc
  limit 1;

  if v_profile.id is null then
    return p_duration_minutes;
  end if;

  -- Same audit trail as effective_assignment_due_at's read: this resolution
  -- runs at attempt start, unauthenticated by definition (service-role edge
  -- function, no caller JWT) — actor is the learner it was resolved for.
  insert into public.accommodation_access_log (profile_id, actor_id, action)
  values (v_profile.id, p_learner_id, 'read');

  select coalesce(o.value, r.value) into v_no_limit
  from public.accommodation_rules r
  left join public.accommodation_overrides o
    on o.profile_id = r.profile_id and o.rule_type = r.rule_type
    and o.target_type = 'exam' and o.target_id = p_exam_id
  where r.profile_id = v_profile.id and r.rule_type = 'no_time_limit';

  if v_no_limit is not null and coalesce((v_no_limit->>'enabled')::boolean, true) then
    return null;
  end if;

  select coalesce(o.value, r.value) into v_extra
  from public.accommodation_rules r
  left join public.accommodation_overrides o
    on o.profile_id = r.profile_id and o.rule_type = r.rule_type
    and o.target_type = 'exam' and o.target_id = p_exam_id
  where r.profile_id = v_profile.id and r.rule_type = 'extra_time';

  if v_extra is not null then
    v_percent := (v_extra->>'percent')::numeric;
  end if;
  if v_percent is null or v_percent <= 0 then
    return p_duration_minutes;
  end if;

  return ceil(p_duration_minutes * (1 + v_percent / 100.0))::integer;
end;
$$;

-- ── start_exam_attempt_atomic: stamp expires_at on brand-new attempts ──────
-- A resumed attempt (outcome 'resumed') keeps whatever expires_at it was
-- given at its real start — recomputing on every resume would let a
-- profile edited mid-attempt silently move an already-running deadline.
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
  v_org_id uuid;
  v_duration_minutes integer;
  v_effective_minutes integer;
  v_expires_at timestamptz;
begin
  select org_id, duration_minutes into v_org_id, v_duration_minutes
  from public.exams where id = p_exam_id for update;

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

  v_effective_minutes := public._effective_exam_duration_minutes(v_org_id, p_exam_id, v_duration_minutes, p_learner_id);
  if v_effective_minutes is not null then
    v_expires_at := now() + (v_effective_minutes || ' minutes')::interval;
  end if;

  insert into public.exam_attempts (
    exam_id, participant_id, participant_name, participant_email,
    question_order, answers, status, logs, learner_id, expires_at
  ) values (
    p_exam_id, p_participant_id, p_participant_name, p_participant_email,
    p_question_order, '{}'::jsonb, 'in-progress',
    jsonb_build_array(jsonb_build_object('event', 'started', 'timestamp', now())),
    p_learner_id, v_expires_at
  ) returning * into new_row;

  return jsonb_build_object('outcome', 'started', 'attempt', to_jsonb(new_row));
end;
$$;

-- ── save_exam_answers: refuse to persist edits past the deadline ──────────
-- Without this, a participant past expires_at could keep autosaving
-- (ExamRoom.tsx's 30s interval doesn't stop on its own) and a subsequent
-- submit would still find those late edits sitting in `answers` — the
-- deadline would exist on paper but enforce nothing. No-op (returns false)
-- rather than raising: ExamRoom's autosave already ignores a false return.
create or replace function public.save_exam_answers(
  p_attempt_id uuid,
  p_answers jsonb,
  p_time_used_seconds integer
) returns boolean
language plpgsql
as $$
declare
  affected integer;
begin
  update public.exam_attempts
  set answers = p_answers,
      time_used_seconds = p_time_used_seconds,
      logs = logs || jsonb_build_array(jsonb_build_object('event', 'saved', 'timestamp', now()))
  where id = p_attempt_id and status = 'in-progress'
    and (expires_at is null or now() <= expires_at);
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;
