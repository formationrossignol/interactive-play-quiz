-- Spec 08 — Évaluations avancées et banque d'items versionnée
-- (docs/product-specs/2026-08-10-lms-program/08-advanced-assessment.md).
--
-- ASM-017/019/021/023: 4 of the 8 new interaction types. Deliberately
-- SKIPPED here — each is its own dedicated-library project, not a variant
-- of what already exists: ASM-018 interactive video (timecoded pause/
-- resume instrumentation on a video player), ASM-020 drawing/annotation
-- (canvas + layers), ASM-022 math/graphique (equation editor + numeric
-- equivalence + point/curve plotting), ASM-024 code (the spec itself
-- defers this "derrière un runner isolé", never guessed here).
--
-- ASM-017 Passage: on reflection this needs NO schema/engine change at
-- all. assessment_items.item_type already has a 'passage' value (posed
-- since 20260810220000) but a passage is a *stimulus*, not a scored
-- question — it never gets an item_answer_key, never gets attached to a
-- section, never appears in an attempt. What ASM-017 actually asks for
-- ("plusieurs sous-questions partagent un stimulus") is delivered as an
-- authoring-time convenience: any scorable item's own prompt can carry a
-- `passage: {text, mediaUrl}` object, copied from a `passage`-type bank
-- item when the author picks one (see ItemBank.tsx PassagePicker). No new
-- join, no new RLS — the shared content is duplicated into each
-- sub-question's own immutable prompt at authoring time, same "frozen at
-- creation, not live-referenced" posture as everything else ASM-003
-- protects.
--
-- ASM-019 (audio/vidéo response) and ASM-023 (fichier) can't go through
-- _score_assessment_response() — there's no correct answer to compare, only
-- a rubric a human applies (ASM-015: "validation humaine obligatoire").
-- They get a dedicated submit path (submit_assessment_media_response(),
-- never touching item_answer_keys) and a new grading_status column so
-- submit_assessment_attempt()'s existing sum(points_earned) naturally
-- treats them as 0 until a staff member grades them (SQL sum() already
-- ignores NULL rows — no special-casing needed there).
--
-- ASM-021 (labeling) *is* auto-scorable, and gets a real
-- _score_assessment_response() branch. Deliberately built without a
-- canvas/drag-drop: zones are named targets (not pixel coordinates) and
-- labels are assigned via a dropdown per target — matches this repo's own
-- established accessibility bias for exactly this kind of interaction
-- (spec 09's matrix format used numeric sliders instead of a
-- drag-canvas for the same "placement accessible" reason).

-- ── manual-grading support on assessment_responses ──────────────────────
alter table public.assessment_responses
  add column grading_status text not null default 'auto' check (grading_status in ('auto', 'pending_review', 'graded'));

-- ── assessment_response_files : media/file answers, mirrors spec 01's
-- submission_file_uploads pattern (private bucket, owner+staff RLS,
-- server-verified path ownership on write). ────────────────────────────
create table public.assessment_response_files (
  id                   uuid primary key default gen_random_uuid(),
  response_id          uuid not null references public.assessment_responses(id) on delete cascade,
  storage_path         text not null,
  file_name            text not null,
  mime_type            text,
  size_bytes           bigint,
  kind                 text not null check (kind in ('audio', 'video', 'file')),
  -- ASM-019 "transcription" — interface only, no vendor, same posture as
  -- plagiarism_check_interface (20260812220000): a status a staff member
  -- sets after obtaining a transcript out-of-band, never a real STT call.
  transcription_status text not null default 'not_requested' check (transcription_status in ('not_requested', 'pending', 'reviewed')),
  transcript_text      text,
  created_at           timestamptz not null default now()
);
create index assessment_response_files_response_idx on public.assessment_response_files(response_id);

alter table public.assessment_response_files enable row level security;

create policy assessment_response_files_learner_read on public.assessment_response_files
  for select using (
    exists (
      select 1 from public.assessment_responses resp
      join public.assessment_attempts att on att.id = resp.attempt_id
      where resp.id = response_id and att.learner_id = auth.uid()
    )
  );
create policy assessment_response_files_staff_read on public.assessment_response_files
  for select using (
    exists (
      select 1 from public.assessment_responses resp
      join public.assessment_attempts att on att.id = resp.attempt_id
      join public.assessments ass on ass.id = att.assessment_id
      where resp.id = response_id and public.has_org_role(ass.org_id, array['trainer', 'pedago', 'admin'])
    )
  );
-- No insert/update policy: submit_assessment_media_response() (below) is
-- the only writer of the row; set_response_transcription() is the only
-- writer of transcription_status/transcript_text.

insert into storage.buckets (id, name, public)
values ('assessment-response-media', 'assessment-response-media', false)
on conflict (id) do nothing;

-- Path convention <learner_id>/<response_id>/<random>-<filename> — RLS
-- derives ownership from the first path segment (never trust the second
-- segment for authorization, only for organization); the RPC below
-- independently re-verifies the same thing server-side before attaching
-- metadata, same double-check posture as assignment-submissions.
create policy assessment_response_media_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'assessment-response-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy assessment_response_media_owner_read on storage.objects
  for select to authenticated
  using (bucket_id = 'assessment-response-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy assessment_response_media_staff_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assessment-response-media'
    and exists (
      select 1 from public.assessment_responses resp
      join public.assessment_attempts att on att.id = resp.attempt_id
      join public.assessments ass on ass.id = att.assessment_id
      where resp.id = ((storage.foldername(name))[2])::uuid
        and public.has_org_role(ass.org_id, array['trainer', 'pedago', 'admin'])
    )
  );

-- ── _score_assessment_response() : add the 'labeling' branch ─────────────
-- correct_answer/response shape: {assignments: {targetId: labelId, ...}}.
-- scoring_rules reuses the existing points/partialCredit keys (mcq already
-- established this vocabulary, no new one invented).
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
  v_label_keys text[];
  v_label_total integer;
  v_label_matches integer;
  v_label_key text;
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

  elsif p_item_type = 'labeling' then
    select coalesce(array_agg(k), '{}') into v_label_keys
      from jsonb_object_keys(coalesce(p_correct_answer -> 'assignments', '{}'::jsonb)) k;
    v_label_total := coalesce(array_length(v_label_keys, 1), 0);
    if v_label_total = 0 then
      -- Malformed answer key (no targets) — fail closed, never guess.
      return query select false, 0::numeric, v_points;
      return;
    end if;

    v_label_matches := 0;
    foreach v_label_key in array v_label_keys loop
      if (p_response -> 'assignments' ->> v_label_key) is not distinct from (p_correct_answer -> 'assignments' ->> v_label_key) then
        v_label_matches := v_label_matches + 1;
      end if;
    end loop;

    v_correct := (v_label_matches = v_label_total);
    if v_partial then
      v_earned := round(v_points * v_label_matches::numeric / v_label_total, 4);
      return query select v_correct, v_earned, v_points;
      return;
    else
      return query select v_correct, (case when v_correct then v_points else 0 end), v_points;
      return;
    end if;

  else
    raise exception 'scoring_not_implemented_for_item_type: %', p_item_type;
  end if;
end;
$$;

-- ── start_assessment_attempt() : widen the whitelist ─────────────────────
-- audio_video/file are included even though they never reach
-- _score_assessment_response() — item_missing_answer_key still requires a
-- (dummy, points-only) item_answer_keys row for them, same "every item in
-- a section has a key" invariant as the auto-scored types, just an unused
-- correct_answer since there's nothing to compare.
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
        and i.item_type not in ('true_false','single_choice','mcq','short_answer','labeling','audio_video','file')
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

-- ── submit_assessment_media_response() : audio_video/file's own submit
-- path — never touches item_answer_keys or _score_assessment_response(),
-- there's nothing to auto-compare against a recording or a file. ─────────
create or replace function public.submit_assessment_media_response(
  p_response_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_kind text,
  p_consent boolean default null
)
returns public.assessment_responses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_response public.assessment_responses;
  v_attempt public.assessment_attempts;
  v_item_type text;
  v_result public.assessment_responses;
  v_file_id uuid;
begin
  if p_kind not in ('audio', 'video', 'file') then
    raise exception 'invalid_kind';
  end if;

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
  if v_item_type not in ('audio_video', 'file') then
    raise exception 'wrong_response_endpoint_for_item_type';
  end if;
  if v_item_type = 'audio_video' and p_consent is distinct from true then
    raise exception 'consent_required';
  end if;

  -- never trust a client-declared owner segment in the storage path —
  -- same double-check submit_assignment()'s p_files does for
  -- assignment-submissions.
  if split_part(p_storage_path, '/', 1) <> auth.uid()::text then
    raise exception 'storage_path_owner_mismatch';
  end if;

  insert into public.assessment_response_files (response_id, storage_path, file_name, mime_type, size_bytes, kind)
  values (p_response_id, p_storage_path, p_file_name, p_mime_type, p_size_bytes, p_kind)
  returning id into v_file_id;

  update public.assessment_responses
  set response = jsonb_build_object('file_id', v_file_id, 'file_name', p_file_name, 'kind', p_kind),
      is_correct = null, points_earned = null, grading_status = 'pending_review', answered_at = now()
  where id = p_response_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.submit_assessment_media_response(uuid, text, text, text, bigint, text, boolean) from public;
grant execute on function public.submit_assessment_media_response(uuid, text, text, text, bigint, text, boolean) to authenticated;

-- ── grade_assessment_response() : ASM-015's "validation humaine
-- obligatoire" for pending_review responses. Writes through
-- score_adjustments for audit — submit_score_adjustment() (posed since
-- 20260810220000) only ever wrote an audit row with no effect on the
-- actual response/attempt; this is the first function that makes a manual
-- grade real. If the attempt was already submitted, its totals are
-- recomputed immediately (the learner has nothing left to "resubmit"). ──
create or replace function public.grade_assessment_response(
  p_response_id uuid,
  p_points_earned numeric,
  p_is_correct boolean default null,
  p_note text default null
)
returns public.assessment_responses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_previous numeric;
  v_attempt_id uuid;
  v_item_revision_id uuid;
  v_attempt_status text;
  v_result public.assessment_responses;
  v_total numeric;
  v_max numeric;
begin
  select i.org_id, resp.points_earned, resp.attempt_id, resp.item_revision_id
    into v_org_id, v_previous, v_attempt_id, v_item_revision_id
  from public.assessment_responses resp
  join public.assessment_item_revisions r on r.id = resp.item_revision_id
  join public.assessment_items i on i.id = r.item_id
  where resp.id = p_response_id;

  if v_org_id is null then
    raise exception 'Response not found';
  end if;
  if not public.has_org_role(v_org_id, array['trainer', 'pedago', 'admin']) then
    raise exception 'Not authorized';
  end if;

  update public.assessment_responses
  set points_earned = p_points_earned, is_correct = p_is_correct, grading_status = 'graded'
  where id = p_response_id
  returning * into v_result;

  insert into public.score_adjustments (attempt_ref, item_revision_id, previous_score, new_score, reason, author_id)
  values (v_attempt_id, v_item_revision_id, v_previous, p_points_earned, coalesce(nullif(trim(p_note), ''), 'manual_grading'), auth.uid());

  select status into v_attempt_status from public.assessment_attempts where id = v_attempt_id;
  if v_attempt_status = 'submitted' then
    select coalesce(sum(points_earned), 0), coalesce(sum(max_points), 0) into v_total, v_max
    from public.assessment_responses where attempt_id = v_attempt_id;
    update public.assessment_attempts
    set total_points = v_total, max_points = v_max,
        percentage = case when v_max > 0 then round(v_total / v_max * 100, 2) else 0 end
    where id = v_attempt_id;
  end if;

  return v_result;
end;
$$;

revoke all on function public.grade_assessment_response(uuid, numeric, boolean, text) from public;
grant execute on function public.grade_assessment_response(uuid, numeric, boolean, text) to authenticated;

-- ── set_response_transcription() : interface-only, no vendor (see header) ─
create or replace function public.set_response_transcription(
  p_file_id uuid,
  p_status text,
  p_text text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if p_status not in ('not_requested', 'pending', 'reviewed') then
    raise exception 'invalid_status';
  end if;
  select ass.org_id into v_org_id
  from public.assessment_response_files f
  join public.assessment_responses resp on resp.id = f.response_id
  join public.assessment_attempts att on att.id = resp.attempt_id
  join public.assessments ass on ass.id = att.assessment_id
  where f.id = p_file_id;
  if v_org_id is null then
    raise exception 'File not found';
  end if;
  if not public.has_org_role(v_org_id, array['trainer', 'pedago', 'admin']) then
    raise exception 'Not authorized';
  end if;

  update public.assessment_response_files
  set transcription_status = p_status, transcript_text = p_text
  where id = p_file_id;
end;
$$;

revoke all on function public.set_response_transcription(uuid, text, text) from public;
grant execute on function public.set_response_transcription(uuid, text, text) to authenticated;

revoke all on function public.start_assessment_attempt(uuid) from public;
grant execute on function public.start_assessment_attempt(uuid) to authenticated;
