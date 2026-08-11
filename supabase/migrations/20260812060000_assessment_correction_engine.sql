-- Spec 08 — the correction engine (RESTE-A-FAIRE.md: "la pièce la plus
-- bloquante du programme"). Until now item_answer_keys had exactly one
-- writer (create_item_revision()) and zero readers — nothing ever scored a
-- learner's answer against a stored key, and no attempt/response table
-- existed at all (the spec's own indicative model names
-- assessment_attempt_forms/responses; neither was ever created by
-- 20260810220000_advanced_assessment.sql).
--
-- Scope, stated explicitly rather than silently implied:
--   - Scoring is implemented for 4 item_types only: true_false,
--     single_choice, mcq (multi-select), short_answer — the same 4
--     ItemBank.tsx already lets staff author today. The other 17 values in
--     assessment_items.item_type's check constraint (ranking, matching,
--     cloze, and the 8 ASM-017..024 types: passage/interactive_video/
--     audio_video/drawing/labeling/math_graph/file/code) have no comparator
--     here — start_assessment_attempt() refuses to start an attempt on an
--     assessment containing any of them (fail closed, not a silent
--     mis-score) rather than guessing a scoring rule for a type with no
--     authoring UI and no defined answer-key shape yet.
--   - Only assessment_sections.selection_mode = 'fixed' is supported.
--     'pool' sections (random draw) are rejected the same way — the pool
--     draw executor is a separate, still-unbuilt reste-à-faire item
--     ("aucun moteur de tirage").
--   - ASM-012 ("barèmes riches") is covered for what these 4 types can
--     express: fixed points (all 4), partial credit + penalty-per-wrong
--     option (mcq only), case/whitespace-insensitive equivalence sets
--     (short_answer only). Numeric tolerance isn't covered — no numeric
--     item_type (slider, math_graph) has authoring UI yet either.
--
-- item_answer_keys.correct_answer / scoring_rules shape per item_type
-- (previously fully undefined jsonb — this migration is what gives it a
-- contract, alongside the ItemBank.tsx changes that actually author it):
--   true_false:     correct_answer = true | false
--                    scoring_rules  = {points?}
--   single_choice:   correct_answer = {optionId}
--                    scoring_rules  = {points?}
--   mcq:             correct_answer = {optionIds: [...]}
--                    scoring_rules  = {points?, partialCredit?, penaltyPerWrong?}
--   short_answer:    correct_answer = {equivalents: [...]}
--                    scoring_rules  = {points?, caseSensitive?, trim?}
-- A learner's response uses the same shape family: {optionId}/{optionIds}/
-- {text} respectively, true_false response is a bare boolean.

create table public.assessment_attempts (
  id                 uuid primary key default gen_random_uuid(),
  assessment_id      uuid not null references public.assessments(id) on delete cascade,
  assessment_version integer not null,
  learner_id         uuid not null references auth.users(id) on delete cascade,
  status             text not null default 'in_progress' check (status in ('in_progress','submitted')),
  started_at         timestamptz not null default now(),
  submitted_at       timestamptz,
  total_points       numeric(10,4),
  max_points         numeric(10,4),
  percentage         numeric(6,2)
);
create index assessment_attempts_learner_idx on public.assessment_attempts(learner_id, assessment_id);
-- At most one in-progress attempt per learner per assessment — resumable,
-- never duplicated under a double-click race.
create unique index assessment_attempts_in_progress_unique_idx
  on public.assessment_attempts(assessment_id, learner_id) where status = 'in_progress';

-- One row per drawn item, pre-created at attempt start — this *is* the
-- "tirage figé par tentative" (ASM-010/011): the set and order are fixed
-- the moment the attempt starts, never recomputed from the live item bank.
create table public.assessment_responses (
  id                uuid primary key default gen_random_uuid(),
  attempt_id        uuid not null references public.assessment_attempts(id) on delete cascade,
  item_revision_id  uuid not null references public.assessment_item_revisions(id) on delete cascade,
  position          integer not null,
  response          jsonb,
  is_correct        boolean,
  points_earned     numeric(10,4),
  max_points        numeric(10,4) not null default 1,
  answered_at       timestamptz,
  unique (attempt_id, item_revision_id)
);
create index assessment_responses_attempt_idx on public.assessment_responses(attempt_id, position);

alter table public.assessment_attempts enable row level security;
alter table public.assessment_responses enable row level security;

create policy assessment_attempts_learner_read on public.assessment_attempts
  for select using (learner_id = auth.uid());
create policy assessment_attempts_staff_read on public.assessment_attempts
  for select using (exists (select 1 from public.assessments a where a.id = assessment_id and public.has_org_role(a.org_id, array['trainer','pedago','admin'])));
-- No insert/update policy: start_assessment_attempt()/submit_assessment_attempt() (security definer) are the only writers.

create policy assessment_responses_learner_read on public.assessment_responses
  for select using (exists (select 1 from public.assessment_attempts att where att.id = attempt_id and att.learner_id = auth.uid()));
create policy assessment_responses_staff_read on public.assessment_responses
  for select using (exists (
    select 1 from public.assessment_attempts att join public.assessments ass on ass.id = att.assessment_id
    where att.id = attempt_id and public.has_org_role(ass.org_id, array['trainer','pedago','admin'])
  ));
-- No insert/update policy: start_assessment_attempt()/submit_assessment_response() (security definer) are the only writers.

-- A learner needs to find published assessments to attempt — assessments
-- previously had no read policy at all for a plain 'learner' role.
create policy assessments_learner_read on public.assessments
  for select using (status = 'published' and public.has_org_role(org_id, array['learner']));

-- ── _score_assessment_response() : pure comparator, no I/O, no auth check —
-- called only from submit_assessment_response() below, never granted
-- directly (there is nothing to authorize on a pure function, but keeping
-- it un-grantable avoids a client depending on an internal signature). ────
create or replace function public._score_assessment_response(
  p_item_type text,
  p_response jsonb,
  p_correct_answer jsonb,
  p_scoring_rules jsonb
)
returns table(is_correct boolean, points_earned numeric, max_points numeric)
language plpgsql
immutable
as $$
declare
  v_points numeric := coalesce((p_scoring_rules->>'points')::numeric, 1);
  v_correct boolean;
  v_selected text[];
  v_correct_set text[];
  v_correct_count integer;
  v_wrong_count integer;
  v_penalty numeric := coalesce((p_scoring_rules->>'penaltyPerWrong')::numeric, 0);
  v_partial boolean := coalesce((p_scoring_rules->>'partialCredit')::boolean, false);
  v_raw numeric;
  v_earned numeric;
  v_equivalents text[];
  v_submitted text;
  v_case_sensitive boolean := coalesce((p_scoring_rules->>'caseSensitive')::boolean, false);
  v_trim boolean := coalesce((p_scoring_rules->>'trim')::boolean, true);
begin
  if v_points <= 0 then v_points := 1; end if;

  if p_item_type = 'true_false' then
    if p_response is null or jsonb_typeof(p_response) <> 'boolean' then
      return query select false, 0::numeric, v_points;
      return;
    end if;
    v_correct := (p_response)::boolean = (p_correct_answer)::boolean;
    return query select v_correct, (case when v_correct then v_points else 0 end), v_points;
    return;

  elsif p_item_type = 'single_choice' then
    v_correct := p_response ->> 'optionId' is not null
      and p_response ->> 'optionId' = p_correct_answer ->> 'optionId';
    return query select v_correct, (case when v_correct then v_points else 0 end), v_points;
    return;

  elsif p_item_type = 'mcq' then
    select coalesce(array_agg(value order by value), '{}') into v_selected
      from jsonb_array_elements_text(coalesce(p_response -> 'optionIds', '[]'::jsonb));
    select coalesce(array_agg(value order by value), '{}') into v_correct_set
      from jsonb_array_elements_text(coalesce(p_correct_answer -> 'optionIds', '[]'::jsonb));

    if array_length(v_correct_set, 1) is null then
      -- Malformed answer key (empty correct set) — fail closed, never guess.
      return query select false, 0::numeric, v_points;
      return;
    end if;

    v_correct := (v_selected = v_correct_set);

    if v_partial then
      select count(*) into v_correct_count from unnest(v_selected) s(val) where s.val = any(v_correct_set);
      select count(*) into v_wrong_count from unnest(v_selected) s(val) where not (s.val = any(v_correct_set));
      v_raw := v_correct_count - (v_wrong_count * v_penalty);
      v_earned := greatest(0, least(v_points, v_points * v_raw / array_length(v_correct_set, 1)));
      return query select v_correct, round(v_earned, 4), v_points;
      return;
    else
      return query select v_correct, (case when v_correct then v_points else 0 end), v_points;
      return;
    end if;

  elsif p_item_type = 'short_answer' then
    select coalesce(array_agg(
      case
        when v_trim and not v_case_sensitive then lower(trim(value))
        when v_trim then trim(value)
        when not v_case_sensitive then lower(value)
        else value
      end
    ), '{}')
    into v_equivalents
    from jsonb_array_elements_text(coalesce(p_correct_answer -> 'equivalents', '[]'::jsonb));

    if array_length(v_equivalents, 1) is null then
      return query select false, 0::numeric, v_points;
      return;
    end if;

    v_submitted := p_response ->> 'text';
    if v_submitted is null then
      return query select false, 0::numeric, v_points;
      return;
    end if;
    if v_trim then v_submitted := trim(v_submitted); end if;
    if not v_case_sensitive then v_submitted := lower(v_submitted); end if;

    v_correct := v_submitted = any(v_equivalents);
    return query select v_correct, (case when v_correct then v_points else 0 end), v_points;
    return;

  else
    raise exception 'scoring_not_implemented_for_item_type: %', p_item_type;
  end if;
end;
$$;

-- ── start_assessment_attempt() : freezes the draw, never exposes answers ──
create or replace function public.start_assessment_attempt(p_assessment_id uuid)
returns table(
  attempt_id uuid,
  response_id uuid,
  item_revision_id uuid,
  item_type text,
  prompt jsonb,
  response jsonb,
  item_position integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment public.assessments;
  v_existing_attempt_id uuid;
  v_attempt_id uuid;
  v_ref record;
begin
  select * into v_assessment from public.assessments where id = p_assessment_id;
  if v_assessment.id is null then
    raise exception 'Assessment not found';
  end if;
  if v_assessment.status <> 'published' then
    raise exception 'assessment_not_published';
  end if;
  if not public.has_org_role(v_assessment.org_id, array['learner','trainer','pedago','registrar','admin']) then
    raise exception 'Not authorized';
  end if;

  select a.id into v_existing_attempt_id
  from public.assessment_attempts a
  where a.assessment_id = p_assessment_id and a.learner_id = auth.uid() and a.status = 'in_progress'
  limit 1;

  if v_existing_attempt_id is null then
    if exists (select 1 from public.assessment_sections s where s.assessment_id = p_assessment_id and s.selection_mode = 'pool') then
      raise exception 'pool_sections_not_supported';
    end if;
    if exists (
      select 1 from public.assessment_sections s
      join public.assessment_item_refs ref on ref.section_id = s.id
      join public.assessment_item_revisions r on r.id = ref.item_revision_id
      join public.assessment_items i on i.id = r.item_id
      where s.assessment_id = p_assessment_id
        and i.item_type not in ('true_false','single_choice','mcq','short_answer')
    ) then
      raise exception 'unsupported_item_type_in_assessment';
    end if;
    if exists (
      select 1 from public.assessment_sections s
      join public.assessment_item_refs ref on ref.section_id = s.id
      left join public.item_answer_keys k on k.item_revision_id = ref.item_revision_id
      where s.assessment_id = p_assessment_id and k.item_revision_id is null
    ) then
      raise exception 'item_missing_answer_key';
    end if;
    if not exists (select 1 from public.assessment_sections s where s.assessment_id = p_assessment_id) then
      raise exception 'assessment_has_no_items';
    end if;

    insert into public.assessment_attempts (assessment_id, assessment_version, learner_id)
    values (p_assessment_id, v_assessment.published_version, auth.uid())
    returning id into v_attempt_id;

    for v_ref in
      select r.id as item_revision_id,
             coalesce((k.scoring_rules->>'points')::numeric, 1) as max_points,
             row_number() over (order by s.position, ref.position) as pos
      from public.assessment_sections s
      join public.assessment_item_refs ref on ref.section_id = s.id
      join public.assessment_item_revisions r on r.id = ref.item_revision_id
      join public.item_answer_keys k on k.item_revision_id = r.id
      where s.assessment_id = p_assessment_id
      order by pos
    loop
      insert into public.assessment_responses (attempt_id, item_revision_id, position, max_points)
      values (v_attempt_id, v_ref.item_revision_id, v_ref.pos, greatest(v_ref.max_points, 0.0001));
    end loop;
  else
    v_attempt_id := v_existing_attempt_id;
  end if;

  return query
    select v_attempt_id, resp.id, resp.item_revision_id, i.item_type, r.prompt, resp.response, resp.position
    from public.assessment_responses resp
    join public.assessment_item_revisions r on r.id = resp.item_revision_id
    join public.assessment_items i on i.id = r.item_id
    where resp.attempt_id = v_attempt_id
    order by resp.position;
end;
$$;

-- ── submit_assessment_response() : the correction engine itself — the
-- first function anywhere in this repo that reads item_answer_keys. ──────
create or replace function public.submit_assessment_response(p_response_id uuid, p_response jsonb)
returns public.assessment_responses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_response public.assessment_responses;
  v_attempt public.assessment_attempts;
  v_item_type text;
  v_key public.item_answer_keys;
  v_scored record;
  v_result public.assessment_responses;
begin
  select * into v_response from public.assessment_responses where id = p_response_id;
  if v_response.id is null then
    raise exception 'Response not found';
  end if;

  select * into v_attempt from public.assessment_attempts where id = v_response.attempt_id;
  if v_attempt.learner_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'attempt_already_submitted';
  end if;

  select i.item_type into v_item_type
  from public.assessment_item_revisions r join public.assessment_items i on i.id = r.item_id
  where r.id = v_response.item_revision_id;

  select * into v_key from public.item_answer_keys where item_revision_id = v_response.item_revision_id;
  if v_key.item_revision_id is null then
    raise exception 'item_missing_answer_key';
  end if;

  select * into v_scored from public._score_assessment_response(v_item_type, p_response, v_key.correct_answer, v_key.scoring_rules);

  update public.assessment_responses
  set response = p_response, is_correct = v_scored.is_correct, points_earned = v_scored.points_earned,
      max_points = v_scored.max_points, answered_at = now()
  where id = p_response_id
  returning * into v_result;

  return v_result;
end;
$$;

-- ── submit_assessment_attempt() : finalizes — unanswered items score 0,
-- never silently excluded from max_points (never a free pass). ───────────
create or replace function public.submit_assessment_attempt(p_attempt_id uuid)
returns public.assessment_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.assessment_attempts;
  v_total numeric;
  v_max numeric;
  v_result public.assessment_attempts;
begin
  select * into v_attempt from public.assessment_attempts where id = p_attempt_id;
  if v_attempt.id is null then
    raise exception 'Attempt not found';
  end if;
  if v_attempt.learner_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'attempt_already_submitted';
  end if;

  select coalesce(sum(points_earned), 0), coalesce(sum(max_points), 0)
    into v_total, v_max
  from public.assessment_responses where attempt_id = p_attempt_id;

  update public.assessment_attempts
  set status = 'submitted', submitted_at = now(), total_points = v_total, max_points = v_max,
      percentage = case when v_max > 0 then round(v_total / v_max * 100, 2) else 0 end
  where id = p_attempt_id
  returning * into v_result;

  return v_result;
end;
$$;

-- ── publish_assessment() : snapshots the current fixed structure ─────────
create or replace function public.publish_assessment(p_assessment_id uuid)
returns public.assessments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment public.assessments;
  v_next_version integer;
  v_structure jsonb;
  v_result public.assessments;
begin
  select * into v_assessment from public.assessments where id = p_assessment_id;
  if v_assessment.id is null then
    raise exception 'Assessment not found';
  end if;
  if v_assessment.owner_id <> auth.uid() and not public.has_org_role(v_assessment.org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  if not exists (select 1 from public.assessment_sections where assessment_id = p_assessment_id) then
    raise exception 'assessment_has_no_sections';
  end if;
  if exists (
    select 1 from public.assessment_sections s
    where s.assessment_id = p_assessment_id
      and not exists (select 1 from public.assessment_item_refs r where r.section_id = s.id)
  ) then
    raise exception 'section_has_no_items';
  end if;

  select jsonb_agg(jsonb_build_object(
    'section_id', s.id, 'title', s.title, 'position', s.position, 'selection_mode', s.selection_mode,
    'item_revision_ids', (select jsonb_agg(ref.item_revision_id order by ref.position) from public.assessment_item_refs ref where ref.section_id = s.id)
  ) order by s.position)
  into v_structure
  from public.assessment_sections s
  where s.assessment_id = p_assessment_id;

  v_next_version := v_assessment.published_version + 1;

  insert into public.assessment_versions (assessment_id, version, structure)
  values (p_assessment_id, v_next_version, v_structure);

  update public.assessments
  set status = 'published', published_version = v_next_version
  where id = p_assessment_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.start_assessment_attempt(uuid) from public;
grant execute on function public.start_assessment_attempt(uuid) to authenticated;
revoke all on function public.submit_assessment_response(uuid, jsonb) from public;
grant execute on function public.submit_assessment_response(uuid, jsonb) to authenticated;
revoke all on function public.submit_assessment_attempt(uuid) from public;
grant execute on function public.submit_assessment_attempt(uuid) to authenticated;
revoke all on function public.publish_assessment(uuid) from public;
grant execute on function public.publish_assessment(uuid) to authenticated;
