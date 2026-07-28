-- Exam scoring Tier 2 (docs/exam-scoring-hardening-tier2.md): moves exam
-- scoring, exam CRUD, and attempt read/write off direct client table access
-- and onto service-role Edge Functions, mirroring the live quiz's
-- submit-answer model. Closes:
--   - forgeable scores (client computed + wrote score/percentage/passed itself)
--   - correct answers shipped to the participant's browser before/during answering
--   - exams_public_read `using (true)` allowing an anon key to dump every
--     exam ever created (title/description/join_code/host_id), not just
--     look one up by its join code as the policy's comment intended
--   - exam_attempts_read_published allowing anyone holding an exam's
--     internal uuid to read every participant's name/email/answers/score,
--     for as long as the exam stays published
--
-- Sequenced after 20260728140000_exams_public_read_exclude_drafts.sql (a
-- narrower same-day fix from a separate branch that scoped exams_public_read
-- to `host_id = auth.uid() or status <> 'draft'` — better than the original
-- `using (true)` but still lets anyone enumerate every non-draft exam across
-- every host). That migration's own comment explicitly deferred the fuller
-- fix to this project. This migration's RLS section below supersedes it:
-- exams_public_read is dropped entirely, not narrowed, since participant
-- lookup no longer needs table-level access at all (get-exam-by-code).
-- Also supersedes 20260728150000_append_exam_attempt_log.sql's RPC, which
-- exam_attempts_update_own's tightened check (below) would otherwise still
-- allow — save_exam_answers replaces its only caller (saveAnswers) in one
-- atomic statement instead of two round trips. append_exam_attempt_log
-- itself is left in place (unused, harmless) rather than dropped here.

-- ── exam_answer_keys: private, service-role-only answer key ────────────────
-- Mirrors session_quiz_answers (20260712120000_session_quiz_answers.sql):
-- RLS enabled, zero policies, so only the service_role (Edge Functions) can
-- ever read or write it.
create table if not exists public.exam_answer_keys (
  exam_id uuid primary key references public.exams(id) on delete cascade,
  questions jsonb not null
);
alter table public.exam_answer_keys enable row level security;

-- ── exams.questions_public: correct-answer-stripped question snapshot ──────
-- What ExamRoom renders from during the taking phase, instead of reading the
-- full quiz (with correctAnswer) via the now-dropped content_exam_quiz_read.
-- Snapshotting at save time also fixes a latent bug: editing the source quiz
-- after an exam is already open/closed no longer changes grading or the
-- rendered questions retroactively.
alter table public.exams add column if not exists questions_public jsonb;

-- ── One-time backfill for exams created under Tier 1 ───────────────────────
-- Existing exams have no exam_answer_keys row and no questions_public yet;
-- derive both from the quiz they still reference via the `content` mirror.
-- Exams whose backing quiz was since deleted are left as-is (defensive:
-- save-exam going forward requires the quiz to exist, but we don't want this
-- migration to fail outright over old orphaned rows).
create or replace function public._strip_answer_key(q jsonb) returns jsonb
language plpgsql immutable as $$
declare
  result jsonb;
begin
  result := q - 'correctAnswer' - 'correctOrder' - 'correctMatches' - 'correctValue';
  if q ? 'blanks' then
    result := result || jsonb_build_object('blanks', (
      select coalesce(jsonb_agg(jsonb_build_object('id', b->'id')), '[]'::jsonb)
      from jsonb_array_elements(q->'blanks') b
    ));
  end if;
  return result;
end;
$$;

insert into public.exam_answer_keys (exam_id, questions)
select e.id, c.data->'questions'
from public.exams e
join public.content c
  on c.type = 'quiz' and c.source_id = e.quiz_id and c.user_id = e.host_id
where not exists (select 1 from public.exam_answer_keys k where k.exam_id = e.id)
  and c.data ? 'questions';

update public.exams e
set questions_public = (
  select coalesce(jsonb_agg(public._strip_answer_key(q)), '[]'::jsonb)
  from jsonb_array_elements(c.data->'questions') q
)
from public.content c
where c.type = 'quiz' and c.source_id = e.quiz_id and c.user_id = e.host_id
  and e.questions_public is null
  and c.data ? 'questions';

drop function public._strip_answer_key(jsonb);

-- ── start_exam_attempt_atomic: resume / cap-check / insert in one txn ──────
-- Fixes the TOCTOU race in the old client-side startAttempt (read caps, then
-- insert — two concurrent tabs could both pass the check before either
-- inserted). Locks the parent exams row for the duration so concurrent
-- start-exam-attempt calls for the same exam serialize, mirroring
-- create_session_atomic / upsert_session_player's "lock, then decide" shape.
-- outcome discriminates the result instead of throwing, since plpgsql has no
-- typed-exception equivalent of AudienceCapError/"exhausted" the caller needs
-- to distinguish: 'resumed' (existing in-progress attempt), 'exhausted'
-- (maxAttempts reached), 'full' (audience cap reached), 'started' (inserted).
create or replace function public.start_exam_attempt_atomic(
  p_exam_id uuid,
  p_participant_id text,
  p_participant_name text,
  p_participant_email text,
  p_max_attempts integer,
  p_max_participants integer,
  p_question_order jsonb
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

  -- Only brand-new participants (no prior attempt of any status for this
  -- exam) count against the audience cap — matches the old client logic's
  -- `existing.length === 0` gate, preserved here as `completed_count = 0`
  -- (equivalent at this point: any in-progress attempt already returned above).
  if p_max_participants is not null and completed_count = 0 then
    select count(distinct participant_id) into distinct_count
      from public.exam_attempts where exam_id = p_exam_id;
    if distinct_count >= p_max_participants then
      return jsonb_build_object('outcome', 'full');
    end if;
  end if;

  insert into public.exam_attempts (
    exam_id, participant_id, participant_name, participant_email,
    question_order, answers, status, logs
  ) values (
    p_exam_id, p_participant_id, p_participant_name, p_participant_email,
    p_question_order, '{}'::jsonb, 'in-progress',
    jsonb_build_array(jsonb_build_object('event', 'started', 'timestamp', now()))
  ) returning * into new_row;

  return jsonb_build_object('outcome', 'started', 'attempt', to_jsonb(new_row));
end;
$$;

-- ── save_exam_answers: autosave without a client-side SELECT ───────────────
-- Autosave (saveAnswers) stays a direct, anon, client-writable path per the
-- Tier 2 doc — but appending to `logs` needs the current array, and once
-- exam_attempts_read_published is dropped below there is no SELECT policy
-- left for an anon caller to read it first. Do the read-modify-write
-- server-side in one statement instead, under RLS as the calling (anon) role
-- (no `security definer` — same convention as create_session_atomic).
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
  where id = p_attempt_id and status = 'in-progress';
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

-- ── RLS: exams ──────────────────────────────────────────────────────────
-- exams_public_read was `using (true)` — unconditional, so an anon key could
-- `select * from exams` and dump every exam ever created (title, description,
-- join_code, host_id) across every host, not just look one up by a known
-- join_code as the original comment intended. Participant lookup-by-code now
-- goes through the get-exam-by-code Edge Function (service-role, filters by
-- the supplied code); the only remaining table-level read is the host's own.
drop policy if exists exams_public_read on public.exams;
drop policy if exists exams_owner_read on public.exams;
create policy exams_owner_read on public.exams for select using (host_id = auth.uid());

-- ── RLS: exam_attempts ──────────────────────────────────────────────────
-- No more direct client inserts (start-exam-attempt is service-role-only via
-- start_exam_attempt_atomic) — leaving this policy in place would let a
-- client bypass the atomic cap check entirely via a raw REST insert.
drop policy if exists exam_attempts_insert_open on public.exam_attempts;

-- Anyone-with-the-uuid, any-status, forever read is gone. Participant-side
-- reads (resume, retained-attempt, results) move to get-participant-attempts
-- / get-attempt-result (service-role, bypasses RLS entirely, filtered
-- server-side by the caller-supplied participant_id — something an RLS
-- policy can never do for an unauthenticated caller, since there is no
-- verifiable claim binding an anon request to a participant_id).
drop policy if exists exam_attempts_read_published on public.exam_attempts;

-- Autosave's RPC path only ever keeps status at 'in-progress' (it's not part
-- of the update payload), so requiring the post-image to still be
-- 'in-progress' is a no-op for that path — but it now also blocks the exact
-- thing Tier 1 accepted: a client directly setting status/score/percentage/
-- passed to anything else via a raw REST update.
alter policy exam_attempts_update_own on public.exam_attempts
  using (status = 'in-progress') with check (status = 'in-progress');

-- The host needs to be able to move an attempt to 'cancelled' (proctor
-- removal, ExamAdmin), which the tightened exam_attempts_update_own above no
-- longer allows (its check now pins status to 'in-progress'). Separate,
-- auth.uid()-verified policy for that one host action. `if exists` guards a
-- prior hand-applied policy of the same name outside any tracked migration
-- (discovered mid-deploy: prod already had one, definition unverified) —
-- dropping and recreating it here makes this migration's version the
-- authoritative one regardless of what existed before.
drop policy if exists exam_attempts_host_update on public.exam_attempts;
create policy exam_attempts_host_update on public.exam_attempts
  for update
  using (exists (select 1 from public.exams e where e.id = exam_id and e.host_id = auth.uid()))
  with check (true);

-- ── RLS: content ────────────────────────────────────────────────────────
-- No longer needed: ExamRoom renders from exams.questions_public now, never
-- the full quiz row. This was the policy exposing every correct answer to
-- any participant of a published exam at any time, including before
-- answering (the acute C-1-equivalent leak) — removing it is the actual
-- close of that hole; questions_public merely made it unnecessary first.
drop policy if exists content_exam_quiz_read on public.content;
