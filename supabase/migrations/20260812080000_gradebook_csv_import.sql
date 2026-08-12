-- Spec 01 — Devoirs, remises et carnet de notes
-- (docs/product-specs/2026-08-10-lms-program/01-assignments-gradebook.md).
--
-- RESTE-A-FAIRE.md §01: "GBK-006 import CSV/XLSX avec prévisualisation/
-- mapping/doublons" — the only piece missing from an otherwise-shipped
-- gradebook. grade_items has so far only ever been written by triggers
-- (sync_exam_attempt_to_gradebook/sync_manual_grade_to_gradebook) — this is
-- the first direct, staff-initiated writer.
--
-- Scope: person-matching (username → learner_id), file parsing (CSV/XLSX)
-- and the preview/duplicate/error-report UI all happen client-side, against
-- the session roster the client already legitimately holds via RLS — no new
-- identity-resolution endpoint is added for this. This function is the
-- transactional backstop once the client has already resolved and filtered
-- rows: it re-validates every row against real enrollment/max_points
-- server-side (never trusting a client-built payload blindly, same posture
-- as the correction engine) and creates the grade_item + all grade_results
-- as a single all-or-nothing insert — one bad row aborts the whole import
-- rather than leaving a half-populated column, which is why the client is
-- expected to have already dropped invalid rows before calling this.
create or replace function public.import_gradebook_csv(
  p_org_id uuid,
  p_session_id uuid,
  p_title text,
  p_category text,
  p_weight numeric,
  p_max_points numeric,
  p_rows jsonb
)
returns public.grade_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.grade_items;
  v_row record;
begin
  if not public.has_org_role(p_org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  if not exists (select 1 from public.course_sessions where id = p_session_id and org_id = p_org_id) then
    raise exception 'session_not_in_org';
  end if;
  if p_title is null or char_length(trim(p_title)) = 0 then
    raise exception 'title_required';
  end if;
  if p_max_points is null or p_max_points <= 0 then
    raise exception 'invalid_max_points';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'no_rows';
  end if;

  insert into public.grade_items (org_id, session_id, source_type, source_id, title, category, weight, max_points)
  values (
    p_org_id, p_session_id, 'manual', gen_random_uuid(),
    trim(p_title), coalesce(nullif(trim(p_category), ''), 'Import'), greatest(coalesce(p_weight, 1), 0.001), p_max_points
  )
  returning * into v_item;

  for v_row in select * from jsonb_to_recordset(p_rows) as x(learner_id uuid, points numeric)
  loop
    if v_row.learner_id is null then
      raise exception 'row_missing_learner_id';
    end if;
    if not exists (
      select 1 from public.enrollments e
      where e.session_id = p_session_id and e.learner_id = v_row.learner_id
        and e.status in ('active','completed','failed')
    ) then
      raise exception 'learner_not_enrolled_in_session: %', v_row.learner_id;
    end if;
    if v_row.points is null or v_row.points < 0 or v_row.points > p_max_points then
      raise exception 'points_out_of_range_for_learner: %', v_row.learner_id;
    end if;

    insert into public.grade_results (grade_item_id, learner_id, status, points, published_at)
    values (v_item.id, v_row.learner_id, 'graded', v_row.points, now());
  end loop;

  return v_item;
end;
$$;

revoke all on function public.import_gradebook_csv(uuid, uuid, text, text, numeric, numeric, jsonb) from public;
grant execute on function public.import_gradebook_csv(uuid, uuid, text, text, numeric, numeric, jsonb) to authenticated;
