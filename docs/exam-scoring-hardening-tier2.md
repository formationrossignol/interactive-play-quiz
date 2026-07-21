# Exam scoring hardening — Tier 2 (deferred)

Tier 1 (shipped in `fix/exam-cross-device-supabase`) moved exam join/take/attempts
off `localStorage` onto Supabase (`exams` + `exam_attempts` tables), fixing the
"Code introuvable" bug for participants not on the host's own browser. It
deliberately kept today's trust model: the client still computes its own score
and writes it straight to `exam_attempts`, exactly like the old localStorage
version did. This doc describes the follow-up hardening pass that closes the
gaps Tier 1 explicitly accepted — not implemented yet.

## What Tier 1 accepts (and why it's not a regression)

- A participant's browser computes `score`/`percentage`/`passed` and writes them
  directly to `exam_attempts` (RLS: `exam_attempts_update_own` only requires
  `status = 'in-progress'` before the write, not `submitted`/`auto-submitted` —
  the client picks the final status itself). Someone comfortable with devtools
  could submit a fabricated 100%.
- `content_exam_quiz_read` and `exam_attempts_read_published` (see
  `supabase/migrations/20260721120000_exam_tables.sql`) grant read access gated
  on the exam's internal UUID + "has this exam ever opened" — not on
  participant identity. Anyone who obtains that UUID (not the 6-char join
  code, which is the only thing actually shared) can read every attempt
  (names, emails, answers, scores) and the quiz's correct answers for that
  exam, for as long as it stays published.

Both of these already matched the localStorage version's actual security
level (the client always had the correct answers in its own memory to compute
a score; nothing enforced attempt integrity there either) — Tier 1 made the
*existence* of the exam reachable over the network, which was the point, but
carried the pre-existing trust model forward rather than fixing it. Tier 2 is
where that trust model actually gets tightened, past what localStorage ever
provided.

## The fix: server-authoritative scoring, mirroring the live quiz's `submit-answer`

The live quiz feature already solved this exact problem for real-time play
(`supabase/functions/submit-answer`, service-role, never trusts the client for
scoring). Tier 2 applies the same shape to exams.

### 1. Private answer key — `exam_answer_keys` table

```sql
create table public.exam_answer_keys (
  exam_id uuid primary key references public.exams(id) on delete cascade,
  questions jsonb not null   -- [{ id, type, correctAnswer, points }], snapshot at publish time
);
alter table public.exam_answer_keys enable row level security;
-- zero policies: anon and authenticated have no access at all, only service_role
-- (mirrors session_quiz_answers in 20260712120000_session_quiz_answers.sql).
```

Snapshotting at publish time (rather than reading the live quiz row every
time) also fixes a latent bug Tier 1 inherits from the original localStorage
version: editing the source quiz after an exam is already open/closed
currently changes grading retroactively. A snapshot decouples them.

### 2. `save-exam` Edge Function replaces the direct client insert/update on `exams`

Service-role function, called from `ExamBuilder.tsx` instead of today's direct
`createExam`/`updateExam` table writes:
- Authenticates the host via the forwarded `Authorization` header (same
  pattern as `create-checkout-session`).
- Reads the source quiz from `content` via service-role (bypasses RLS, so it
  works regardless of the quiz's public/open state).
- Splits the quiz's questions: strips `correctAnswer`/`points` into the public
  `exams` row (still needed by `ExamRoom` to render the question text/options),
  writes the full question set (with `correctAnswer`) into
  `exam_answer_keys`.
- Once this exists, `content_exam_quiz_read` (the Tier 1 policy exposing the
  full quiz row, correct answers included, to anyone with the exam's open
  UUID) can be dropped entirely — participants never need to read the quiz's
  `content` row anymore, `exams.questions_public` covers it.

### 3. Atomic attempt start — `start-exam-attempt` + `start_exam_attempt_atomic`

Tier 1's `startAttempt` does a best-effort read-then-check-then-insert for
`maxAttempts`/`maxParticipants` — the same TOCTOU race the original
localStorage version had (two tabs starting at once could both slip past the
cap). Mirror `create_session_atomic`
(`supabase/migrations/20260712130000_create_session_atomic.sql`): a single
`plpgsql` function that checks both caps and inserts the attempt row in one
transaction, called only from a service-role Edge Function.

### 4. Server-side scoring — `submit-exam-attempt` Edge Function

The only path that can move an attempt to `submitted`/`auto-submitted`.
Receives `{ attemptId, answers, timeUsedSeconds, mode }`, reads
`exam_answer_keys` (service-role), computes the score with a Deno-ported
`calculateScore` (same algorithm as `examStorage.ts`, mirrors the existing
`supabase/functions/_shared/scoring.ts` used by `submit-answer`), and writes
the final `score`/`percentage`/`passed`/`status` via service-role UPDATE
(bypasses RLS — the client-writable `exam_attempts_update_own` policy would
then be restricted to `with check (status = 'in-progress')` on **both** sides,
i.e. a client can save answers but literally cannot set the terminal fields
itself anymore).

### 5. Attempt reads move behind the same trust boundary

Once scoring is server-only, `exam_attempts_read_published` (today: anyone
with the exam UUID can read all attempts while published) can be replaced
with host-only reads (`exam_attempts_host_read` already exists and is fine
as-is) plus participants getting their own result back as the
`submit-exam-attempt` response body — never via a direct table read. This
finally makes exam data no more exposed over the network than it would be
sitting on a single host's laptop.

## Rough sequencing

1. `exam_answer_keys` table + migration to backfill it from existing `exams`
   rows' referenced quizzes (one-time, service-role script).
2. `save-exam` Edge Function; switch `ExamBuilder.tsx` to call it.
3. `start-exam-attempt` + atomic RPC; switch `ExamRoom.tsx`'s `startAttempt`.
4. `submit-exam-attempt`; switch `ExamRoom.tsx`'s `submitAttempt`/auto-submit.
5. Drop `content_exam_quiz_read`; tighten `exam_attempts_read_published` to
   host-only.

Each step is independently shippable and testable — this doesn't have to land
as one PR.
