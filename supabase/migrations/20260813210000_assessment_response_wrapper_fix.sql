-- Fix the single-row return contract of submit_assessment_response().
-- RETURN QUERY is only valid for SETOF/table functions.
create or replace function public.submit_assessment_response(p_response_id uuid, p_response jsonb)
returns public.assessment_responses language plpgsql security definer set search_path = public as $$
declare v public.assessment_responses; a public.assessment_attempts; kind text; result public.assessment_responses;
begin
  select * into v from public.assessment_responses where id = p_response_id;
  if v.id is null then raise exception 'Response not found'; end if;
  select * into a from public.assessment_attempts where id = v.attempt_id;
  if a.learner_id <> auth.uid() then raise exception 'Not authorized'; end if;
  if a.status <> 'in_progress' then raise exception 'attempt_already_submitted'; end if;
  select i.item_type into kind from public.assessment_item_revisions r join public.assessment_items i on i.id = r.item_id where r.id = v.item_revision_id;
  if kind in ('ranking','matching','cloze','drag_drop','hotspot','interactive_video','drawing','math_graph','code','free_text','slider') then
    update public.assessment_responses set response=p_response, grading_status='pending_review', answered_at=now(), is_correct=null, points_earned=null where id=v.id returning * into result;
    return result;
  end if;
  select * into result from public.submit_assessment_response_auto(p_response_id, p_response);
  return result;
end;
$$;
revoke all on function public.submit_assessment_response(uuid,jsonb) from public;
grant execute on function public.submit_assessment_response(uuid,jsonb) to authenticated;
