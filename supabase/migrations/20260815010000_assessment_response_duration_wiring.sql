-- Spec 07 — Analytics pédagogiques, psychométrie et signaux de risque.
--
-- ANA-009 ("temps médian de réponse par item") was marked done in
-- RESTE-A-FAIRE on the strength of assessment_responses.duration_ms
-- existing and _run_spec07_analytics_internal() computing
-- percentile_cont(0.5) over it (20260813170000_spec07_analytics_completion.sql)
-- — but nothing anywhere ever wrote that column. submit_assessment_response()/
-- submit_assessment_response_auto() never took a duration parameter, and no
-- frontend code measured one. median_response_time_ms was structurally
-- guaranteed to be null forever. This migration is the missing write side;
-- the read side (already correct) is untouched.
create or replace function public.submit_assessment_response(
  p_response_id uuid,
  p_response jsonb,
  p_duration_ms integer default null
)
returns public.assessment_responses
language plpgsql security definer set search_path = public
as $$
declare
  v public.assessment_responses;
  a public.assessment_attempts;
  kind text;
  result public.assessment_responses;
begin
  select * into v from public.assessment_responses where id = p_response_id;
  if v.id is null then raise exception 'Response not found'; end if;
  select * into a from public.assessment_attempts where id = v.attempt_id;
  if a.learner_id <> auth.uid() then raise exception 'Not authorized'; end if;
  if a.status <> 'in_progress' then raise exception 'attempt_already_submitted'; end if;
  select i.item_type into kind from public.assessment_item_revisions r join public.assessment_items i on i.id = r.item_id where r.id = v.item_revision_id;
  if kind in ('ranking','matching','cloze','drag_drop','hotspot','interactive_video','drawing','math_graph','code','free_text','slider') then
    update public.assessment_responses
    set response = p_response, grading_status = 'pending_review', answered_at = now(),
        is_correct = null, points_earned = null, duration_ms = coalesce(p_duration_ms, duration_ms)
    where id = v.id
    returning * into result;
    return result;
  end if;
  select * into result from public.submit_assessment_response_auto(p_response_id, p_response, p_duration_ms);
  return result;
end;
$$;

create or replace function public.submit_assessment_response_auto(
  p_response_id uuid,
  p_response jsonb,
  p_duration_ms integer default null
)
returns public.assessment_responses
language plpgsql security definer set search_path = public
as $$
declare
  v public.assessment_responses;
  a public.assessment_attempts;
  kind text;
  k public.item_answer_keys;
  scored record;
  result public.assessment_responses;
begin
  select * into v from public.assessment_responses where id = p_response_id; if v.id is null then raise exception 'Response not found'; end if;
  select * into a from public.assessment_attempts where id = v.attempt_id; if a.learner_id <> auth.uid() then raise exception 'Not authorized'; end if;
  if a.status <> 'in_progress' then raise exception 'attempt_already_submitted'; end if;
  select i.item_type into kind from public.assessment_item_revisions r join public.assessment_items i on i.id = r.item_id where r.id = v.item_revision_id;
  select * into k from public.item_answer_keys where item_revision_id = v.item_revision_id; if k.item_revision_id is null then raise exception 'item_missing_answer_key'; end if;
  select * into scored from public._score_assessment_response(kind, p_response, k.correct_answer, k.scoring_rules);
  update public.assessment_responses
  set response = p_response, is_correct = scored.is_correct, points_earned = scored.points_earned,
      max_points = scored.max_points, grading_status = 'auto', answered_at = now(),
      duration_ms = coalesce(p_duration_ms, duration_ms)
  where id = v.id
  returning * into result;
  return result;
end;
$$;

revoke all on function public.submit_assessment_response(uuid, jsonb, integer) from public;
grant execute on function public.submit_assessment_response(uuid, jsonb, integer) to authenticated;
revoke all on function public.submit_assessment_response_auto(uuid, jsonb, integer) from public;

-- The old 2-arg overloads are no longer reachable from any client after
-- this migration's TakeAssessment.tsx change ships, but PostgREST resolves
-- overloads by argument count/name at call time — dropping them removes
-- any stale cached schema cache entry from ever routing to a signature
-- that silently drops duration.
drop function if exists public.submit_assessment_response(uuid, jsonb);
drop function if exists public.submit_assessment_response_auto(uuid, jsonb);
