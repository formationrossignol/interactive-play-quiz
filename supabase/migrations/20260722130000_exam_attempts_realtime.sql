-- exam_attempts was never added to the supabase_realtime publication when
-- it was created (20260721120000_exam_tables.sql) — RLS policies control
-- who can read/write, but Realtime delivery is a separate opt-in per table.
-- Without this, ExamAdmin's live-results subscription (`exam-attempts-
-- ${examId}`) and ExamRoom's proctor-controls subscription (host removal /
-- live message) both silently receive nothing: the writes succeed, no
-- postgres_changes event ever fires.
alter publication supabase_realtime add table public.exam_attempts;
