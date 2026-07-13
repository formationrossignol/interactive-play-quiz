-- Answer key for live quiz sessions. Holds the full quiz (including correct
-- answers) that submit-answer needs to validate a player's response.
-- RLS is enabled with zero policies: anon/authenticated get zero matching
-- rows (default deny), service_role bypasses RLS entirely (Supabase default)
-- and is the only caller — Edge Functions, never the browser directly.
create table if not exists session_quiz_answers (
  game_code text primary key,
  questions jsonb not null,
  created_at timestamptz not null default now()
);

alter table session_quiz_answers enable row level security;

-- Server-authoritative clock for the speed-bonus calculation: stamped by
-- advance-question when the host moves to a new question, read by
-- submit-answer to compute elapsed time — never trusts the client's own timer.
--
-- lock_timeout: session_state is a live table (real quiz sessions may be in
-- flight). ADD COLUMN needs a brief ACCESS EXCLUSIVE lock; if it can't get
-- one within 2s, fail fast and let the migration be retried rather than
-- queueing behind other queries and stalling them too.
set local lock_timeout = '2s';
alter table session_state add column if not exists question_started_at timestamptz;
