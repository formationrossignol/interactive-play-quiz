-- Bug-hunt audit: saveAnswers (30s autosave) and submitAttempt both did a
-- client-side read-then-overwrite of exam_attempts.logs. When autosave and
-- submit raced, whichever write landed second silently dropped the other's
-- appended entry — most importantly the 'submitted'/'auto-submitted' event
-- could be lost if a stale autosave write landed after it. This function
-- appends atomically at the DB level instead, closing the race without
-- touching the answers/time_used_seconds/score fields those two callers
-- still write independently (that part of the trade-off is the same
-- accepted Tier 1 model documented in docs/exam-scoring-hardening-tier2.md).
create or replace function public.append_exam_attempt_log(p_attempt_id uuid, p_entry jsonb)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.exam_attempts
  set logs = logs || jsonb_build_array(p_entry)
  where id = p_attempt_id;
$$;
