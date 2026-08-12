-- Spec 03 — Compétences, résultats d'apprentissage et preuves
-- (docs/product-specs/2026-08-10-lms-program/03-competencies-outcomes.md).
--
-- RESTE-A-FAIRE.md §03: "Méthodes d'agrégation configurables (CMP-007) —
-- seule « dernière preuve » est implémentée ; meilleure preuve / moyenne
-- pondérée / N-récentes / validation manuelle sont à ajouter."
--
-- Real gap found building this, not anticipated: mastery_scales/
-- mastery_scale_levels (CMP-006, "échelle par défaut... configurable") had
-- RLS (`for all`, pedago/admin) since the original migration but zero UI
-- ever wrote to them — no org could actually have a scale, which would
-- have made every aggregation_method below dead code (recompute_
-- competency_mastery() already silently no-ops to 'not_assessed' when no
-- default scale exists, before and after this migration). Minimal CRUD for
-- creating a scale + levels is added in this same pass (client-side direct
-- writes, RLS already permits it — no new RPC needed for that part),
-- otherwise "configurable aggregation" has nothing to configure.
--
-- Method semantics, since the spec names them but doesn't define the math:
--   - latest: existing behaviour, unchanged (most recent non-voided
--     evidence wins).
--   - best: highest-position evidence among all non-voided evidence.
--   - weighted_average: mean position across all non-voided evidence,
--     weighted by competency_alignments.weight (evidence with no
--     alignment_id — manual/import — weighs 1), rounded to the nearest
--     defined position.
--   - recent_n: unweighted mean position across the N most recent
--     non-voided evidence rows (N = mastery_scales.recent_n).
--   - manual: recompute_competency_mastery() becomes a deliberate no-op —
--     evidence is still logged (record_competency_evidence still inserts
--     the row, for traceability) but the level only ever changes via the
--     new set_manual_mastery_level(), a real human decision, audited like
--     every other mastery change.
--
-- Evidence with neither a resolvable level_code nor a raw_score inside the
-- scale's thresholds contributes nothing to best/weighted_average/recent_n
-- (excluded, not treated as zero) — same "never guess" posture as the rest
-- of this program.

alter table public.mastery_scales
  add column aggregation_method text not null default 'latest'
    check (aggregation_method in ('latest','best','weighted_average','recent_n','manual')),
  add column recent_n integer not null default 3 check (recent_n > 0);

-- ── competency_evidence_position() : resolves one evidence row to a rank on
-- a scale, however it was recorded (explicit level_code, or a raw_score
-- read through the scale's thresholds) — the same two-path resolution the
-- original recompute already did for 'latest', now shared by every method. ─
create or replace function public.competency_evidence_position(p_scale_id uuid, p_level_code text, p_raw_score numeric)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select position from public.mastery_scale_levels where scale_id = p_scale_id and code = p_level_code),
    (select position from public.mastery_scale_levels
       where scale_id = p_scale_id and p_raw_score is not null and min_score <= p_raw_score
       order by min_score desc limit 1)
  );
$$;

revoke all on function public.competency_evidence_position(uuid, text, numeric) from public;

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
  end if;
end;
$$;

revoke all on function public.recompute_competency_mastery(uuid, uuid, uuid) from public;
grant execute on function public.recompute_competency_mastery(uuid, uuid, uuid) to authenticated;

-- ── set_manual_mastery_level() : the only writer when method = 'manual' ────
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
  end if;

  return v_result;
end;
$$;

revoke all on function public.set_manual_mastery_level(uuid, uuid, text, text) from public;
grant execute on function public.set_manual_mastery_level(uuid, uuid, text, text) to authenticated;
