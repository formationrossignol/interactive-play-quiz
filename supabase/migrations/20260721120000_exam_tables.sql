-- Async exams: dedicated Supabase tables for the join/take/admin flow.
-- Everything about exams (definitions + attempts) was localStorage-only,
-- so a participant not sharing the host's exact browser (private tab,
-- another device) could never join, code or no code. These tables are the
-- source of truth for that participant-facing path; the generic `content`
-- table (content_and_folders.sql) stays as-is, purely for the host's own
-- library/organization view (folders, favorites, trash).
--
-- Tier 1 scope: match today's trust model — the client still computes the
-- score, exactly like the current localStorage version. Server-side
-- tamper-proof scoring (private answer keys, service-role Edge Functions)
-- is deliberately deferred; see docs/exam-scoring-hardening-tier2.md.

create table public.exams (
  id uuid primary key,                     -- client-generated (genExamId()), same id as the `content` mirror's source_id
  host_id uuid not null references auth.users(id) on delete cascade,
  quiz_id text not null,                   -- matches content.source_id for the backing quiz row
  title text not null,
  description text not null default '',
  open_at timestamptz not null,
  close_at timestamptz not null,
  duration_minutes integer,
  max_attempts integer not null default 1,
  shuffle_questions boolean not null default false,
  shuffle_answers boolean not null default false,
  passing_score integer not null default 70,
  show_results_policy text not null default 'immediately',
  show_detail_policy text not null default 'score-correction',
  score_retention_policy text not null default 'best',
  -- only 'draft'/'archived' are ever persisted; 'scheduled'/'open'/'closed'
  -- are computed client-side from open_at/close_at (computeExamStatus).
  status text not null default 'draft' check (status in ('draft','archived','scheduled','open','closed')),
  join_code text not null unique,
  max_participants integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index exams_host_idx on public.exams(host_id);

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  -- client-generated uuid (ExamRoom's sessionStorage participant id), NOT
  -- auth.uid() — same trust level as the live quiz's JoinQuiz playerId.
  participant_id text not null,
  participant_name text not null,
  participant_email text not null default '',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  time_used_seconds integer not null default 0,
  question_order jsonb not null default '[]',
  answers jsonb not null default '{}',
  score integer,
  percentage integer,
  passed boolean,
  submission_mode text,
  status text not null default 'in-progress',
  logs jsonb not null default '[]'
);
create index exam_attempts_exam_idx on public.exam_attempts(exam_id);
create index exam_attempts_participant_idx on public.exam_attempts(exam_id, participant_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.exams enable row level security;
alter table public.exam_attempts enable row level security;

-- exams: anyone can look up by join_code — that's the whole point, join
-- codes were never secret, just unshared (same exposure as today). Only the
-- host writes.
create policy exams_public_read on public.exams for select using (true);
create policy exams_owner_insert on public.exams for insert with check (host_id = auth.uid());
create policy exams_owner_update on public.exams for update using (host_id = auth.uid()) with check (host_id = auth.uid());

-- exam_attempts: anon insert only once the exam has actually opened (mirrors
-- poll_responses_insert_open in content_and_folders.sql).
create policy exam_attempts_insert_open on public.exam_attempts
  for insert with check (
    exists (select 1 from public.exams e where e.id = exam_id
            and now() >= e.open_at and now() < e.close_at
            and e.status not in ('draft','archived'))
  );

-- resuming/autosave: a row may only move through 'in-progress' by direct
-- client write; final submitted/auto-submitted is still client-set here
-- (Tier 1 trust model — Tier 2 moves this behind a service-role function).
create policy exam_attempts_update_own on public.exam_attempts
  for update using (status = 'in-progress') with check (true);

-- host dashboard: full read of all attempts for exams they own, any time.
create policy exam_attempts_host_read on public.exam_attempts
  for select using (exists (select 1 from public.exams e where e.id = exam_id and e.host_id = auth.uid()));

-- participant-side read: anyone with the exam's (unguessable) internal uuid
-- can read attempts once the exam has opened at least once — not just while
-- still "open", because a participant must still be able to view their own
-- results/correction after close (showResultsPolicy: 'after-close'). See
-- docs/exam-scoring-hardening-tier2.md for the accepted trade-off this
-- implies and how Tier 2 closes it (service-role-only attempt access).
create policy exam_attempts_read_published on public.exam_attempts
  for select using (
    exists (select 1 from public.exams e where e.id = exam_id
            and now() >= e.open_at and e.status not in ('draft','archived'))
  );

-- content: let an exam participant read the backing quiz's mirrored row
-- (questions + correct answers — Tier 1 keeps scoring client-side, so this
-- is required and no more exposed than today's localStorage version already
-- was to its own browser). Same "published, not just open" window as above,
-- so post-close correction viewing keeps working.
create policy content_exam_quiz_read on public.content
  for select using (
    type = 'quiz' and exists (
      select 1 from public.exams e
      where e.quiz_id = content.source_id
        and e.host_id = content.user_id
        and now() >= e.open_at
        and e.status not in ('draft','archived')
    )
  );

create trigger exams_touch before update on public.exams
  for each row execute function public.touch_updated_at();
