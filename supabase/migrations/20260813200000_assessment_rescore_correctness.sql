-- Rescore correctness fix: a changed correctness flag must be audited and
-- counted even when the numeric score stays identical.
create or replace function public.execute_rescore(p_item_revision_id uuid, p_reason text)
returns public.rescore_jobs language plpgsql security definer set search_path = public as $$
declare v_org_id uuid; v_item_type text; v_key public.item_answer_keys; v_job public.rescore_jobs; v_row record; v_scored record; v_count integer := 0; v_affected_attempts uuid[] := '{}'; v_attempt_id uuid;
begin
  if p_reason is null or char_length(trim(p_reason)) = 0 then raise exception 'reason_required'; end if;
  select i.org_id, i.item_type into v_org_id, v_item_type from public.assessment_item_revisions r join public.assessment_items i on i.id = r.item_id where r.id = p_item_revision_id;
  if v_org_id is null then raise exception 'Item revision not found'; end if;
  if not public.has_org_role(v_org_id, array['pedago','admin']) then raise exception 'Not authorized'; end if;
  if v_item_type in ('audio_video','file') then raise exception 'manually_graded_item_type_not_rescorable'; end if;
  select * into v_key from public.item_answer_keys where item_revision_id = p_item_revision_id;
  if v_key.item_revision_id is null then raise exception 'item_missing_answer_key'; end if;
  insert into public.rescore_jobs(org_id,item_revision_id,status,created_by) values(v_org_id,p_item_revision_id,'running',auth.uid()) returning * into v_job;
  for v_row in select resp.id response_id, resp.attempt_id, resp.response, resp.points_earned previous_points, resp.is_correct previous_is_correct from public.assessment_responses resp join public.assessment_attempts att on att.id=resp.attempt_id where resp.item_revision_id=p_item_revision_id and att.status='submitted' and resp.response is not null loop
    select * into v_scored from public._score_assessment_response(v_item_type,v_row.response,v_key.correct_answer,v_key.scoring_rules);
    if v_row.previous_points is distinct from v_scored.points_earned or v_row.previous_is_correct is distinct from v_scored.is_correct then
      update public.assessment_responses set is_correct=v_scored.is_correct, points_earned=v_scored.points_earned, max_points=v_scored.max_points where id=v_row.response_id;
      insert into public.score_adjustments(attempt_ref,item_revision_id,previous_score,new_score,reason,author_id) values(v_row.attempt_id,p_item_revision_id,v_row.previous_points,v_scored.points_earned,p_reason,auth.uid());
      v_count := v_count + 1;
      if not (v_row.attempt_id = any(v_affected_attempts)) then v_affected_attempts := array_append(v_affected_attempts,v_row.attempt_id); end if;
    end if;
  end loop;
  foreach v_attempt_id in array v_affected_attempts loop
    update public.assessment_attempts att set total_points=s.total,max_points=s.max,percentage=case when s.max>0 then round(s.total/s.max*100,2) else 0 end from (select coalesce(sum(points_earned),0) total,coalesce(sum(max_points),0) max from public.assessment_responses where attempt_id=v_attempt_id) s where att.id=v_attempt_id;
  end loop;
  update public.rescore_jobs set status='completed',affected_count=v_count,completed_at=now() where id=v_job.id returning * into v_job;
  return v_job;
end;
$$;
revoke all on function public.execute_rescore(uuid,text) from public;
grant execute on function public.execute_rescore(uuid,text) to authenticated;
