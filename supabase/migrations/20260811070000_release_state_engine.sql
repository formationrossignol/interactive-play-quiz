-- Spec 06 — Parcours adaptatifs, conditions et automatisations
-- (docs/product-specs/2026-08-10-lms-program/06-adaptive-automation.md).
--
-- release_state existed with a real priority/uniqueness shape but "posée,
-- jamais calculée (aucun writer)" per VALIDATION-STATUS §06. The rule DSL
-- itself (20260810200000_adaptive_automation.sql) only ever implemented
-- graph traversal for cycle detection — no evaluator against a learner's
-- actual progress existed for any leaf type, not even 'activity_completed'.
--
-- 'activity_completed' resolution reuses what spec 01's gradebook
-- unification (20260811050000) already made coherent: a target_id is
-- "completed" if it has a graded grade_results row (source-agnostic —
-- covers assignment/exam/manual uniformly), OR a submitted-or-later
-- submission, OR a submitted exam attempt — the concrete entities this app
-- actually has, since there is no unified "activities" table to check
-- against generically.
--
-- Every other leaf source (date/score/competency/…) is accepted and
-- rendered by the DSL (per the original migration's own comment) but has
-- no evaluator here either — evaluate_rule_definition() fails CLOSED
-- (treats an unevaluable leaf as not satisfied) rather than guessing true.
-- A lock should stay locked when the condition can't actually be checked,
-- not silently open.
--
-- No scheduler exists in this repo — recompute is event-driven, fired from
-- the three write paths that can make 'activity_completed' become true:
-- submissions, exam_attempts and grade_results.

create or replace function public.activity_completed_for_learner(p_learner_id uuid, p_target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.grade_results gr
      join public.grade_items gi on gi.id = gr.grade_item_id
      where gi.source_id = p_target_id and gr.learner_id = p_learner_id and gr.status = 'graded'
    )
    or exists (
      select 1 from public.submissions s
      where s.assignment_id = p_target_id and s.learner_id = p_learner_id and s.status in ('submitted', 'late', 'graded')
    )
    or exists (
      select 1 from public.exam_attempts ea
      where ea.exam_id = p_target_id and ea.learner_id = p_learner_id and ea.status in ('submitted', 'auto-submitted')
    );
$$;

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
  else
    return false;
  end if;
end;
$$;

-- ── recompute_release_state() : evaluate every published access rule ───────
create or replace function public.recompute_release_state(p_learner_id uuid, p_org_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule record;
  v_satisfied boolean;
  v_count integer := 0;
begin
  for v_rule in
    select rs.target_type, rs.target_id, rs.published_version, rv.definition
    from public.rule_sets rs
    join public.rule_set_versions rv on rv.rule_set_id = rs.id and rv.version = rs.published_version
    where rs.org_id = p_org_id and rs.status = 'published' and rs.mode = 'access'
  loop
    v_satisfied := public.evaluate_rule_definition(v_rule.definition, p_learner_id);

    insert into public.release_state (org_id, target_type, target_id, learner_id, effect, reason, rule_version, computed_at)
    values (
      p_org_id, v_rule.target_type, v_rule.target_id, p_learner_id,
      case when v_satisfied then 'unlocked' else 'locked' end,
      case when v_satisfied then null else 'prerequisite_not_met' end,
      v_rule.published_version, now()
    )
    on conflict (target_type, target_id, learner_id) do update
      set effect = excluded.effect, reason = excluded.reason, rule_version = excluded.rule_version, computed_at = excluded.computed_at;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.activity_completed_for_learner(uuid, uuid) from public;
revoke all on function public.evaluate_rule_definition(jsonb, uuid) from public;
revoke all on function public.recompute_release_state(uuid, uuid) from public;
grant execute on function public.recompute_release_state(uuid, uuid) to authenticated;

-- ── event-driven triggers : the three write paths that can satisfy a rule ──
create or replace function public.trigger_recompute_release_state_submissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if new.status not in ('submitted', 'late', 'graded') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = new.status then
    return new;
  end if;
  select org_id into v_org_id from public.assignments where id = new.assignment_id;
  if v_org_id is not null then
    perform public.recompute_release_state(new.learner_id, v_org_id);
  end if;
  return new;
end;
$$;

drop trigger if exists submissions_recompute_release_state on public.submissions;
create trigger submissions_recompute_release_state after insert or update on public.submissions
  for each row execute function public.trigger_recompute_release_state_submissions();

create or replace function public.trigger_recompute_release_state_exam_attempts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.learner_id is null or new.status not in ('submitted', 'auto-submitted') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = new.status then
    return new;
  end if;
  if new.org_id is not null then
    perform public.recompute_release_state(new.learner_id, new.org_id);
  end if;
  return new;
end;
$$;

drop trigger if exists exam_attempts_recompute_release_state on public.exam_attempts;
create trigger exam_attempts_recompute_release_state after insert or update on public.exam_attempts
  for each row execute function public.trigger_recompute_release_state_exam_attempts();

create or replace function public.trigger_recompute_release_state_grade_results()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if new.status <> 'graded' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = new.status then
    return new;
  end if;
  select org_id into v_org_id from public.grade_items where id = new.grade_item_id;
  if v_org_id is not null then
    perform public.recompute_release_state(new.learner_id, v_org_id);
  end if;
  return new;
end;
$$;

drop trigger if exists grade_results_recompute_release_state on public.grade_results;
create trigger grade_results_recompute_release_state after insert or update on public.grade_results
  for each row execute function public.trigger_recompute_release_state_grade_results();
