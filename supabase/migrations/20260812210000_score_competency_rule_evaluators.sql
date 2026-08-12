-- Spec 06 — Parcours adaptatifs, conditions et automatisations
-- (docs/product-specs/2026-08-10-lms-program/06-adaptive-automation.md).
--
-- RESTE-A-FAIRE.md §06: "évaluateur score/compétence (pendant du date déjà
-- fait) — même mécanique, résolution à définir." evaluate_rule_definition()
-- has failed closed on these two sources since 20260811070000, deliberately
-- ("chacun a besoin de sa propre résolution... pas devinée ici") — this
-- migration is that resolution.
--
-- ADP-001 lists "score", "note publiée" and "compétence" as three separate
-- sources but the spec never says which score system a condition means.
-- Two parallel systems exist: grade_results/grade_items (spec 01, already
-- what activity_completed_for_learner() resolves against, already
-- trigger-wired to recompute_release_state() on every graded write) vs
-- assessment_attempts.percentage (spec 08's correction engine, has zero
-- recompute trigger anywhere). Resolving "score" against grade_results
-- reuses activity_completed's own target_id convention exactly
-- (target_id = grade_items.source_id, same ambiguity across source_type
-- that convention already accepts — not a new risk introduced here) and
-- needs zero new event plumbing. Resolving against assessment_attempts
-- would need a brand-new trigger this migration doesn't invent, so score
-- means grade_results/grade_items here — not the parallel spec-08 system.
--
-- Comparison basis: points/max_points as a 0-100 percentage (matches how
-- the gradebook already displays scores to staff) rather than raw points
-- (meaningless across grade_items with different max_points) or a 0-1
-- ratio (harder to author from a UI). Only two operators, gte/lte —
-- mirrors date's own after/before pair, covers ADP-002's
-- "supérieur/inférieur" without inventing "dans une plage" nobody asked
-- the date evaluator for either.
--
-- Competency: mastery_scale_levels.position is the only cross-scale-
-- comparable ordinal (raw level_code strings aren't ordered) — same
-- position concept 20260812120000_competency_aggregation_methods.sql
-- already introduced for aggregation. p_value is a level_code (e.g.
-- "expert"), resolved to a position on the learner's own scale so
-- gte/lte compare like-for-like even if an org later changes scales.
--
-- Event-driven recompute: grade_results' existing trigger
-- (20260811070000_release_state_engine.sql) already fires
-- recompute_release_state() on every graded write, so a score condition
-- gets that for free — no new trigger. competency_mastery has no
-- equivalent trigger anywhere; rather than bolting one onto the table
-- (competency_mastery is written by two different functions with
-- different call shapes), recompute_release_state() is called directly
-- from inside recompute_competency_mastery() and
-- set_manual_mastery_level() (20260812120000), at the exact point each
-- already detects a level actually changed — both already have org_id/
-- learner_id resolved there, so this is additive, not a rewrite of their
-- logic. Satisfies ADP-004's acceptance criterion ("un score modifié et
-- republié recalcule les accès dépendants") for both sources without
-- relying solely on the nightly sweep (which still covers both generically
-- regardless, same as it already does for date).
--
-- rule_definition_targets() (cycle/dependency graph) is left untouched —
-- score/competency leaves don't participate in it, same as date today.

-- ── score_condition_satisfied_for_learner() ─────────────────────────────
-- Same target_id convention as activity_completed_for_learner(): the
-- grade_item's source_id (the assignment/exam/etc.), not grade_items.id
-- itself — consistent with how staff already identify "the activity" in
-- the activity_completed condition next to this one in the same rule DSL.
create or replace function public.score_condition_satisfied_for_learner(
  p_learner_id uuid, p_target_id uuid, p_operator text, p_value numeric
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_points numeric;
  v_max numeric;
  v_pct numeric;
begin
  select gr.points, gi.max_points into v_points, v_max
  from public.grade_results gr
  join public.grade_items gi on gi.id = gr.grade_item_id
  where gi.source_id = p_target_id and gr.learner_id = p_learner_id and gr.status = 'graded'
  order by gr.published_at desc nulls last
  limit 1;

  if v_points is null or v_max is null or v_max = 0 then
    return false;
  end if;

  v_pct := (v_points / v_max) * 100;

  if p_operator = 'gte' then
    return v_pct >= p_value;
  elsif p_operator = 'lte' then
    return v_pct <= p_value;
  else
    return false;
  end if;
end;
$$;

-- ── competency_condition_satisfied_for_learner() ────────────────────────
create or replace function public.competency_condition_satisfied_for_learner(
  p_learner_id uuid, p_target_id uuid, p_operator text, p_value text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scale_id uuid;
  v_learner_position integer;
  v_target_position integer;
begin
  select cm.scale_id, msl.position into v_scale_id, v_learner_position
  from public.competency_mastery cm
  left join public.mastery_scale_levels msl on msl.scale_id = cm.scale_id and msl.code = cm.level_code
  where cm.competency_id = p_target_id and cm.learner_id = p_learner_id;

  if v_scale_id is null or v_learner_position is null then
    return false;
  end if;

  select position into v_target_position from public.mastery_scale_levels
  where scale_id = v_scale_id and code = p_value;

  if v_target_position is null then
    return false;
  end if;

  if p_operator = 'gte' then
    return v_learner_position >= v_target_position;
  elsif p_operator = 'lte' then
    return v_learner_position <= v_target_position;
  else
    return false;
  end if;
end;
$$;

-- ── evaluate_rule_definition(): add the two branches ────────────────────
-- Full body from 20260812130000_release_state_date_and_sweep.sql, verbatim,
-- plus the two new elsif branches before the final fail-closed else.
create or replace function public.evaluate_rule_definition(p_definition jsonb, p_learner_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_child jsonb;
begin
  if p_definition->>'op' = 'and' then
    for v_child in select * from jsonb_array_elements(coalesce(p_definition->'children', '[]'::jsonb))
    loop
      if not public.evaluate_rule_definition(v_child, p_learner_id) then
        return false;
      end if;
    end loop;
    return true;
  elsif p_definition->>'op' = 'or' then
    for v_child in select * from jsonb_array_elements(coalesce(p_definition->'children', '[]'::jsonb))
    loop
      if public.evaluate_rule_definition(v_child, p_learner_id) then
        return true;
      end if;
    end loop;
    return false;
  elsif p_definition->>'source' = 'activity_completed' then
    return public.activity_completed_for_learner(p_learner_id, (p_definition->>'target_id')::uuid);
  elsif p_definition->>'source' = 'date' then
    if p_definition->>'operator' = 'after' then
      return now() >= (p_definition->>'value')::timestamptz;
    elsif p_definition->>'operator' = 'before' then
      return now() < (p_definition->>'value')::timestamptz;
    else
      return false;
    end if;
  elsif p_definition->>'source' = 'score' then
    return public.score_condition_satisfied_for_learner(
      p_learner_id, (p_definition->>'target_id')::uuid, p_definition->>'operator', (p_definition->>'value')::numeric
    );
  elsif p_definition->>'source' = 'competency' then
    return public.competency_condition_satisfied_for_learner(
      p_learner_id, (p_definition->>'target_id')::uuid, p_definition->>'operator', p_definition->>'value'
    );
  else
    return false;
  end if;
end;
$$;

-- ── recompute_competency_mastery(): call recompute_release_state() when
-- the level actually changes ─────────────────────────────────────────────
-- Full body from 20260812120000_competency_aggregation_methods.sql,
-- verbatim, plus one new perform call inside the existing "level changed"
-- branch (right next to the emit_learning_event() call already there).
create or replace function public.recompute_competency_mastery(p_competency_id uuid, p_learner_id uuid, p_evidence_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_scale_id uuid;
  v_method text;
  v_recent_n integer;
  v_previous text;
  v_new_level text;
  v_target_position integer;
begin
  select f.org_id into v_org_id
  from public.competencies c join public.competency_frameworks f on f.id = c.framework_id
  where c.id = p_competency_id;

  select id, aggregation_method, recent_n into v_scale_id, v_method, v_recent_n
  from public.mastery_scales where org_id = v_org_id and is_default = true limit 1;

  select level_code into v_previous from public.competency_mastery where competency_id = p_competency_id and learner_id = p_learner_id;

  if v_method = 'manual' then
    if v_previous is null then
      insert into public.competency_mastery (org_id, competency_id, learner_id, scale_id, level_code, computed_at)
      values (v_org_id, p_competency_id, p_learner_id, v_scale_id, 'not_assessed', now())
      on conflict (competency_id, learner_id) do nothing;
    end if;
    return;
  end if;

  if v_method = 'best' then
    select max(public.competency_evidence_position(v_scale_id, ev.level_code, ev.raw_score))
      into v_target_position
    from public.competency_evidence ev
    where ev.competency_id = p_competency_id and ev.learner_id = p_learner_id and ev.voided_at is null;

  elsif v_method = 'weighted_average' then
    select round(sum(resolved.pos * resolved.wt) / nullif(sum(resolved.wt), 0))::integer into v_target_position
    from (
      select public.competency_evidence_position(v_scale_id, ev.level_code, ev.raw_score) as pos,
             coalesce(al.weight, 1) as wt
      from public.competency_evidence ev
      left join public.competency_alignments al on al.id = ev.alignment_id
      where ev.competency_id = p_competency_id and ev.learner_id = p_learner_id and ev.voided_at is null
    ) resolved
    where resolved.pos is not null;

  elsif v_method = 'recent_n' then
    select round(avg(recent.pos))::integer into v_target_position
    from (
      select public.competency_evidence_position(v_scale_id, ev.level_code, ev.raw_score) as pos
      from public.competency_evidence ev
      where ev.competency_id = p_competency_id and ev.learner_id = p_learner_id and ev.voided_at is null
      order by ev.occurred_at desc, ev.created_at desc
      limit coalesce(v_recent_n, 3)
    ) recent
    where recent.pos is not null;

  else -- 'latest', and the fallback when no default scale exists at all
    select public.competency_evidence_position(v_scale_id, ev.level_code, ev.raw_score)
      into v_target_position
    from public.competency_evidence ev
    where ev.competency_id = p_competency_id and ev.learner_id = p_learner_id and ev.voided_at is null
    order by ev.occurred_at desc, ev.created_at desc
    limit 1;
  end if;

  if v_target_position is null then
    v_new_level := 'not_assessed';
  else
    select code into v_new_level from public.mastery_scale_levels
    where scale_id = v_scale_id and position <= v_target_position
    order by position desc limit 1;
    v_new_level := coalesce(v_new_level, 'not_assessed');
  end if;

  insert into public.competency_mastery (org_id, competency_id, learner_id, scale_id, level_code, computed_at)
  values (v_org_id, p_competency_id, p_learner_id, v_scale_id, v_new_level, now())
  on conflict (competency_id, learner_id)
  do update set level_code = excluded.level_code, scale_id = excluded.scale_id, computed_at = now();

  if v_previous is distinct from v_new_level then
    insert into public.competency_mastery_history (competency_id, learner_id, from_level, to_level, rule_version, reason, evidence_id)
    values (p_competency_id, p_learner_id, v_previous, v_new_level, 1, 'recompute:' || coalesce(v_method, 'latest'), p_evidence_id);
    perform public.emit_learning_event('competency.mastery_changed', v_org_id, p_learner_id, 'competency', p_competency_id, jsonb_build_object('from', v_previous, 'to', v_new_level));
    perform public.recompute_release_state(p_learner_id, v_org_id);
  end if;
end;
$$;

revoke all on function public.recompute_competency_mastery(uuid, uuid, uuid) from public;
grant execute on function public.recompute_competency_mastery(uuid, uuid, uuid) to authenticated;

-- ── set_manual_mastery_level(): same addition ───────────────────────────
create or replace function public.set_manual_mastery_level(
  p_competency_id uuid, p_learner_id uuid, p_level_code text, p_reason text
)
returns public.competency_mastery
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_scale_id uuid;
  v_method text;
  v_previous text;
  v_result public.competency_mastery;
begin
  select f.org_id into v_org_id
  from public.competencies c join public.competency_frameworks f on f.id = c.framework_id
  where c.id = p_competency_id;
  if v_org_id is null then
    raise exception 'Competency not found';
  end if;
  if not public.has_org_role(v_org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'reason_required';
  end if;

  select id, aggregation_method into v_scale_id, v_method from public.mastery_scales where org_id = v_org_id and is_default = true limit 1;
  if v_scale_id is null or v_method is distinct from 'manual' then
    raise exception 'default_scale_not_in_manual_mode';
  end if;
  if not exists (select 1 from public.mastery_scale_levels where scale_id = v_scale_id and code = p_level_code) then
    raise exception 'invalid_level_code';
  end if;

  select level_code into v_previous from public.competency_mastery where competency_id = p_competency_id and learner_id = p_learner_id;

  insert into public.competency_mastery (org_id, competency_id, learner_id, scale_id, level_code, computed_at)
  values (v_org_id, p_competency_id, p_learner_id, v_scale_id, p_level_code, now())
  on conflict (competency_id, learner_id)
  do update set level_code = excluded.level_code, scale_id = excluded.scale_id, computed_at = now()
  returning * into v_result;

  if v_previous is distinct from p_level_code then
    insert into public.competency_mastery_history (competency_id, learner_id, from_level, to_level, rule_version, reason, evidence_id)
    values (p_competency_id, p_learner_id, v_previous, p_level_code, 1, p_reason, null);
    perform public.emit_learning_event('competency.mastery_changed', v_org_id, p_learner_id, 'competency', p_competency_id, jsonb_build_object('from', v_previous, 'to', p_level_code));
    perform public.recompute_release_state(p_learner_id, v_org_id);
  end if;

  return v_result;
end;
$$;

revoke all on function public.set_manual_mastery_level(uuid, uuid, text, text) from public;
grant execute on function public.set_manual_mastery_level(uuid, uuid, text, text) to authenticated;
