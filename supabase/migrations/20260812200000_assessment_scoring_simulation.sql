-- Spec 08 — Évaluations avancées et banque d'items versionnée
-- (docs/product-specs/2026-08-10-lms-program/08-advanced-assessment.md).
--
-- RESTE-A-FAIRE.md §08: "Simulation de barème avant publication (ASM-013)".
-- Spec text is one sentence: "Le barème est simulable sur des réponses
-- exemples avant publication." No acceptance criteria beyond that.
--
-- item_answer_keys has zero select policy for `authenticated` — not even
-- for staff (20260810220000_advanced_assessment.sql: "correct answers are
-- server-only"). So an authoring UI cannot read the key client-side to
-- simulate locally; this has to be a server-side RPC, same posture as
-- submit_assessment_response(). Rather than re-deriving the scoring math,
-- this calls the exact same pure comparator submit_assessment_response()
-- already uses — public._score_assessment_response(), added by
-- 20260812060000_assessment_correction_engine.sql, already `immutable`
-- with no I/O — so a simulated score can never drift from a real one.
-- Returns only the outcome (is_correct/points_earned/max_points), never
-- correct_answer itself, matching the spec's own permission boundary
-- ("réponses correctes privées accessibles uniquement au moteur de score").
create or replace function public.simulate_item_scoring(p_item_revision_id uuid, p_response jsonb)
returns table(is_correct boolean, points_earned numeric, max_points numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_type text;
  v_org_id uuid;
  v_key public.item_answer_keys;
begin
  select i.item_type, i.org_id into v_item_type, v_org_id
  from public.assessment_item_revisions r
  join public.assessment_items i on i.id = r.item_id
  where r.id = p_item_revision_id;

  if v_item_type is null then
    raise exception 'item_revision_not_found';
  end if;

  if not public.has_org_role(v_org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  select * into v_key from public.item_answer_keys where item_revision_id = p_item_revision_id;
  if v_key.item_revision_id is null then
    raise exception 'item_missing_answer_key';
  end if;

  return query
    select * from public._score_assessment_response(v_item_type, p_response, v_key.correct_answer, v_key.scoring_rules);
end;
$$;

revoke all on function public.simulate_item_scoring(uuid, jsonb) from public;
grant execute on function public.simulate_item_scoring(uuid, jsonb) to authenticated;
