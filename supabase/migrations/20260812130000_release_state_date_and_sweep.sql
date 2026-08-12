-- Spec 06 — Parcours adaptatifs, conditions et automatisations
-- (docs/product-specs/2026-08-10-lms-program/06-adaptive-automation.md).
--
-- RESTE-A-FAIRE.md §06 had two separate-looking bullets that turn out to be
-- two halves of the same gap:
--   - "Évaluateur pour les sources autres que activity_completed" —
--     evaluate_rule_definition() failed closed on everything but
--     'activity_completed'.
--   - "Balayage planifié complémentaire (règles à échéance temporelle —
--     date/score qui change sans écriture applicative) — bloqué par : pas
--     d'ordonnanceur."
-- pg_cron now exists (20260812020000_scheduler.sql, built for spec 07) —
-- that blocker is stale. But building a 'date' evaluator without also
-- sweeping on a timer would have been pointless: recompute_release_state()
-- only ever runs from the three event triggers (a submission/exam/grade
-- write), so a rule made *only* of a date condition would sit stuck at
-- whatever it was last computed as, updated only by unrelated learner
-- activity — never by the date itself arriving. Both pieces land together.
--
-- Scope: only 'date' (ADP-001's "date absolue"), operators 'after'/'before'
-- (ADP-002's avant/après) — 'score'/'competency' sources still fail closed,
-- each needs its own resolution logic (which score? which competency
-- scale?) not guessed here. Leaf shape:
--   {source: 'date', operator: 'after' | 'before', value: <ISO 8601>}

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
  else
    return false;
  end if;
end;
$$;

revoke all on function public.evaluate_rule_definition(jsonb, uuid) from public;

-- ── _sweep_release_state_internal() : the timer half ────────────────────
-- Not gated (like the other _internal scheduler functions) — never granted
-- to authenticated/anon, only pg_cron calls it. Loops every learner with an
-- active enrollment in the org and re-evaluates every published access rule
-- for them via the existing recompute_release_state() — same function the
-- three event triggers already call ungated, so this introduces no new
-- privilege surface, just a new caller.
create or replace function public._sweep_release_state_internal(p_org_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_learner_id uuid;
  v_count integer := 0;
begin
  for v_learner_id in
    select distinct learner_id from public.enrollments where org_id = p_org_id and status = 'active'
  loop
    perform public.recompute_release_state(v_learner_id, p_org_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public._sweep_release_state_internal(uuid) from public;

-- ── run_scheduled_lms_analytics_jobs() : add the sweep as a third,
-- independently-isolated step per org (same "one org's failure doesn't
-- abort the others" posture as the two existing steps). ───────────────────
create or replace function public.run_scheduled_lms_analytics_jobs()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org record;
  v_yesterday date := current_date - 1;
begin
  for v_org in select id from public.organizations loop
    begin
      perform public._run_daily_analytics_rollup_internal(v_org.id, v_yesterday);
    exception when others then
      raise warning 'run_scheduled_lms_analytics_jobs: rollup failed for org %: %', v_org.id, sqlerrm;
    end;

    begin
      perform public._generate_risk_signals_internal(v_org.id);
    exception when others then
      raise warning 'run_scheduled_lms_analytics_jobs: risk signals failed for org %: %', v_org.id, sqlerrm;
    end;

    begin
      perform public._sweep_release_state_internal(v_org.id);
    exception when others then
      raise warning 'run_scheduled_lms_analytics_jobs: release_state sweep failed for org %: %', v_org.id, sqlerrm;
    end;
  end loop;
end;
$$;

revoke all on function public.run_scheduled_lms_analytics_jobs() from public;
