-- Spec 08: randomised pools, legacy quiz linkage and safe manual grading for
-- the remaining interaction families. No AI generation is included.

create table public.assessment_legacy_question_links (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  item_revision_id uuid not null references public.assessment_item_revisions(id) on delete cascade,
  content_id uuid not null references public.content(id) on delete cascade,
  legacy_question_id text not null,
  created_at timestamptz not null default now(),
  unique (content_id, legacy_question_id),
  unique (assessment_id, item_revision_id)
);
alter table public.assessment_legacy_question_links enable row level security;
create policy assessment_legacy_question_links_owner on public.assessment_legacy_question_links
  for all using (exists (select 1 from public.assessments a where a.id = assessment_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from public.assessments a where a.id = assessment_id and a.owner_id = auth.uid()));

-- Draw fixed refs plus a random sample from each pool rule. The sample is
-- frozen by the caller into assessment_responses, so retries return the same
-- attempt and never redraw.
create or replace function public._draw_assessment_items(p_assessment_id uuid)
returns table(item_revision_id uuid, max_points numeric, item_position integer)
language sql stable security definer set search_path = public
as $$
  with fixed as (
    select s.position section_position, ref.position item_position,
           ref.item_revision_id, coalesce((k.scoring_rules->>'points')::numeric, 1) max_points
    from public.assessment_sections s
    join public.assessment_item_refs ref on ref.section_id = s.id
    left join public.item_answer_keys k on k.item_revision_id = ref.item_revision_id
    where s.assessment_id = p_assessment_id and s.selection_mode = 'fixed'
  ), candidates as (
    select s.position section_position, pr.count draw_count, m.position member_position,
           m.item_id, r.id item_revision_id, coalesce((k.scoring_rules->>'points')::numeric, 1) max_points,
           row_number() over (partition by s.id, pr.id order by random()) as random_position,
           i.item_type, r.difficulty, pr.filter
    from public.assessment_sections s
    join public.assessment_pool_rules pr on pr.section_id = s.id
    join public.item_collection_members m on m.collection_id = pr.collection_id
    join public.assessment_items i on i.id = m.item_id
    join lateral (select r.* from public.assessment_item_revisions r where r.item_id = i.id order by r.version desc limit 1) r on true
    left join public.item_answer_keys k on k.item_revision_id = r.id
    where s.assessment_id = p_assessment_id and s.selection_mode = 'pool'
      and i.status in ('approved','published') and i.item_type <> 'passage'
      and (pr.filter = '{}'::jsonb or pr.filter->>'item_type' is null or pr.filter->>'item_type' = i.item_type)
      and (pr.filter->>'difficulty' is null or pr.filter->>'difficulty' = r.difficulty)
  ), pooled as (
    select section_position, member_position item_position, item_revision_id, max_points
    from candidates where random_position <= draw_count
  ), all_items as (
    select * from fixed union all select * from pooled
  ), deduped as (
    select distinct on (item_revision_id) item_revision_id, max_points, section_position, item_position
    from all_items order by item_revision_id, section_position, item_position
  )
  select item_revision_id, greatest(max_points, 0.0001),
         row_number() over (order by section_position, item_position)::integer
  from deduped order by 3;
$$;
revoke all on function public._draw_assessment_items(uuid) from public;

-- Replace the previous fail-closed pool rejection with a frozen draw. The
-- whitelist is intentionally broad: auto-scored items use the comparator;
-- media and rich interactions are captured as pending human grading.
create or replace function public.start_assessment_attempt(p_assessment_id uuid)
returns table(attempt_id uuid, response_id uuid, item_revision_id uuid, item_type text,
              prompt jsonb, response jsonb, item_position integer)
language plpgsql security definer set search_path = public
as $$
declare a public.assessments; existing_id uuid; new_id uuid; d record;
begin
  select * into a from public.assessments where id = p_assessment_id;
  if a.id is null then raise exception 'Assessment not found'; end if;
  if a.status <> 'published' then raise exception 'assessment_not_published'; end if;
  if not public.has_org_role(a.org_id, array['learner','trainer','pedago','registrar','admin']) then raise exception 'Not authorized'; end if;
  select id into existing_id from public.assessment_attempts where assessment_id = a.id and learner_id = auth.uid() and status = 'in_progress' limit 1;
  if existing_id is null then
    if not exists (select 1 from public.assessment_sections where assessment_id = a.id) then raise exception 'assessment_has_no_items'; end if;
    if exists (select 1 from public.assessment_sections s join public.assessment_item_refs ref on ref.section_id = s.id left join public.item_answer_keys k on k.item_revision_id = ref.item_revision_id where s.assessment_id = a.id and s.selection_mode = 'fixed' and k.item_revision_id is null) then raise exception 'item_missing_answer_key'; end if;
    insert into public.assessment_attempts(assessment_id, assessment_version, learner_id) values (a.id, a.published_version, auth.uid()) returning id into new_id;
    for d in select * from public._draw_assessment_items(a.id) loop
      insert into public.assessment_responses(attempt_id, item_revision_id, position, max_points) values (new_id, d.item_revision_id, d.item_position, d.max_points);
    end loop;
    if not exists (select 1 from public.assessment_responses where attempt_id = new_id) then raise exception 'assessment_has_no_items'; end if;
  else new_id := existing_id;
  end if;
  return query select new_id, resp.id, resp.item_revision_id, i.item_type, r.prompt, resp.response, resp.position
    from public.assessment_responses resp join public.assessment_item_revisions r on r.id = resp.item_revision_id join public.assessment_items i on i.id = r.item_id
    where resp.attempt_id = new_id order by resp.position;
end;
$$;
revoke all on function public.start_assessment_attempt(uuid) from public;
grant execute on function public.start_assessment_attempt(uuid) to authenticated;

-- Rich interactions that do not yet have an automatic comparator are still
-- answerable. They enter the existing human-review queue instead of failing
-- the whole attempt or inventing a score.
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
    update public.assessment_responses set response = p_response, grading_status = 'pending_review', answered_at = now(), is_correct = null, points_earned = null where id = v.id returning * into result;
    return result;
  end if;
  return query select * from public.submit_assessment_response_auto(p_response_id, p_response);
end;
$$;
-- Internal alias preserves the previously deployed comparator implementation.
create or replace function public.submit_assessment_response_auto(p_response_id uuid, p_response jsonb)
returns public.assessment_responses language plpgsql security definer set search_path = public as $$
declare v public.assessment_responses; a public.assessment_attempts; kind text; k public.item_answer_keys; scored record; result public.assessment_responses;
begin
  select * into v from public.assessment_responses where id = p_response_id; if v.id is null then raise exception 'Response not found'; end if;
  select * into a from public.assessment_attempts where id = v.attempt_id; if a.learner_id <> auth.uid() then raise exception 'Not authorized'; end if;
  if a.status <> 'in_progress' then raise exception 'attempt_already_submitted'; end if;
  select i.item_type into kind from public.assessment_item_revisions r join public.assessment_items i on i.id = r.item_id where r.id = v.item_revision_id;
  select * into k from public.item_answer_keys where item_revision_id = v.item_revision_id; if k.item_revision_id is null then raise exception 'item_missing_answer_key'; end if;
  select * into scored from public._score_assessment_response(kind, p_response, k.correct_answer, k.scoring_rules);
  update public.assessment_responses set response=p_response,is_correct=scored.is_correct,points_earned=scored.points_earned,max_points=scored.max_points,grading_status='auto',answered_at=now() where id=v.id returning * into result;
  return result;
end;
$$;
revoke all on function public.submit_assessment_response_auto(uuid,jsonb) from public;
revoke all on function public.submit_assessment_response(uuid,jsonb) from public;
grant execute on function public.submit_assessment_response(uuid,jsonb) to authenticated;

-- Import a legacy content.quiz into the versioned assessment bank. The source
-- remains untouched; each imported revision is immutable and linked back to
-- the original question for traceability.
create or replace function public.import_legacy_quiz_as_assessment(p_content_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.content; a_id uuid; section_id uuid; q jsonb; q_id text; item_id uuid; rev_id uuid; kind text; opts jsonb; correct jsonb; idx integer := 0; v_org_id uuid;
begin
  select * into c from public.content where id = p_content_id and user_id = auth.uid() and type = 'quiz';
  if c.id is null then raise exception 'Quiz not found'; end if;
  select org_id into v_org_id from public.user_org_roles where user_id = auth.uid() order by created_at limit 1;
  if v_org_id is null then raise exception 'User has no LMS organisation'; end if;
  insert into public.assessments(org_id, owner_id, title) values (v_org_id, auth.uid(), coalesce(c.data->>'title','Quiz importé')) returning id into a_id;
  insert into public.assessment_sections(assessment_id,title,position,selection_mode) values (a_id,'Questions',0,'fixed') returning id into section_id;
  for q in select value from jsonb_array_elements(coalesce(c.data->'questions','[]'::jsonb)) loop
    idx := idx + 1; q_id := coalesce(q->>'id', idx::text); kind := case q->>'type' when 'multiple-choice' then 'single_choice' when 'true-false' then 'true_false' when 'short-answer' then 'short_answer' when 'ranking' then 'ranking' when 'matching' then 'matching' when 'fill-blank' then 'cloze' else 'free_text' end;
    insert into public.assessment_items(org_id,item_type,owner_id,status) values (v_org_id,kind,auth.uid(),'draft') returning id into item_id;
    opts := coalesce(q->'answers','[]'::jsonb);
    insert into public.assessment_item_revisions(item_id,version,prompt,created_by) values (item_id,1,jsonb_build_object('text',coalesce(q->>'question',''),'options',(select jsonb_agg(jsonb_build_object('id','a'||(n-1),'label',value)) from jsonb_array_elements_text(opts) with ordinality t(value,n)), 'legacyQuestionId',q_id),auth.uid()) returning id into rev_id;
    correct := case when kind='single_choice' then jsonb_build_object('optionId','a'||coalesce((q->>'correctAnswer')::int,0)) when kind='true_false' then to_jsonb(lower(coalesce(q->>'correctAnswer','true'))='true') when kind='short_answer' then jsonb_build_object('equivalents',jsonb_build_array(coalesce(q->>'correctAnswer',''))) else '{}'::jsonb end;
    insert into public.item_answer_keys(item_revision_id,correct_answer,scoring_rules) values (rev_id,correct,jsonb_build_object('points',coalesce((q->>'points')::numeric,1)));
    insert into public.assessment_item_refs(section_id,item_revision_id,position) values (section_id,rev_id,idx);
    insert into public.assessment_legacy_question_links(assessment_id,item_revision_id,content_id,legacy_question_id) values (a_id,rev_id,c.id,q_id);
  end loop;
  return a_id;
end;
$$;
revoke all on function public.import_legacy_quiz_as_assessment(uuid) from public;
grant execute on function public.import_legacy_quiz_as_assessment(uuid) to authenticated;

-- Pool sections are publishable when they contain at least one rule; the
-- immutable snapshot records the rule and its collection for auditability.
create or replace function public.publish_assessment(p_assessment_id uuid)
returns public.assessments language plpgsql security definer set search_path = public as $$
declare a public.assessments; next_version integer; structure jsonb; result public.assessments;
begin
  select * into a from public.assessments where id = p_assessment_id;
  if a.id is null then raise exception 'Assessment not found'; end if;
  if a.owner_id <> auth.uid() and not public.has_org_role(a.org_id, array['pedago','admin']) then raise exception 'Not authorized'; end if;
  if not exists (select 1 from public.assessment_sections where assessment_id = a.id) then raise exception 'assessment_has_no_sections'; end if;
  if exists (select 1 from public.assessment_sections s where s.assessment_id = a.id and ((s.selection_mode = 'fixed' and not exists (select 1 from public.assessment_item_refs r where r.section_id = s.id)) or (s.selection_mode = 'pool' and not exists (select 1 from public.assessment_pool_rules p where p.section_id = s.id)))) then raise exception 'section_has_no_items'; end if;
  select jsonb_agg(jsonb_build_object('section_id', s.id, 'title', s.title, 'position', s.position, 'selection_mode', s.selection_mode,
    'item_revision_ids', coalesce((select jsonb_agg(ref.item_revision_id order by ref.position) from public.assessment_item_refs ref where ref.section_id = s.id), '[]'::jsonb),
    'pool_rules', coalesce((select jsonb_agg(jsonb_build_object('collection_id', p.collection_id, 'count', p.count, 'filter', p.filter)) from public.assessment_pool_rules p where p.section_id = s.id), '[]'::jsonb)) order by s.position) into structure
  from public.assessment_sections s where s.assessment_id = a.id;
  next_version := a.published_version + 1;
  insert into public.assessment_versions(assessment_id, version, structure) values (a.id, next_version, structure);
  update public.assessments set status='published', published_version=next_version where id=a.id returning * into result;
  return result;
end;
$$;
revoke all on function public.publish_assessment(uuid) from public;
grant execute on function public.publish_assessment(uuid) to authenticated;
