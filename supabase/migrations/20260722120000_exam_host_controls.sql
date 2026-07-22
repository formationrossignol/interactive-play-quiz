-- Exam proctor (admin) live controls: remove a participant's attempt from
-- the live view/stats regardless of its current status, and push a live
-- message to one participant while they're taking the exam.
--
-- exam_attempts_update_own (20260721120000_exam_tables.sql) only allows an
-- update while the row's CURRENT status is 'in-progress' — fine for the
-- participant's own autosave/submit flow, but it blocks the host from
-- cancelling an already-submitted attempt (to strike a result from stats)
-- or writing a message onto it. Add a host-owns-the-exam policy instead;
-- same Tier 1 trust level the host already has via exam_attempts_host_read
-- (full row read, including answers/scores).

alter table public.exam_attempts add column host_message text;
alter table public.exam_attempts add column host_message_at timestamptz;

create policy exam_attempts_host_update on public.exam_attempts
  for update
  using (exists (select 1 from public.exams e where e.id = exam_id and e.host_id = auth.uid()))
  with check (exists (select 1 from public.exams e where e.id = exam_id and e.host_id = auth.uid()));
