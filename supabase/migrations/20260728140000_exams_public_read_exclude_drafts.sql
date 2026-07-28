-- Bug-hunt audit: exams_public_read (20260721120000_exam_tables.sql) was
-- `using (true)` with no predicate at all. The policy's own comment says the
-- intent is "anyone can look up by join_code" (join codes were never secret,
-- same exposure as the old localStorage version) — but as written it also
-- exposes every OTHER host's draft exams (title, host_id, dates, join_code)
-- to full unauthenticated table enumeration, which was never the intent.
--
-- This does not touch exam_attempts_read_published / exam_attempts_update_own
-- / content_exam_quiz_read — those are the accepted, explicitly documented
-- Tier 1 trade-offs tracked in docs/exam-scoring-hardening-tier2.md (a
-- larger, already-scoped server-authoritative-scoring project), not
-- unintentional bugs; re-litigating them here would half-implement that plan
-- without its private-answer-key table or service-role functions.
drop policy if exists exams_public_read on public.exams;
create policy exams_public_read on public.exams
  for select using (host_id = auth.uid() or status <> 'draft');
