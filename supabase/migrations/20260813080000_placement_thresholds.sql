-- Spec 06 — Parcours adaptatifs, conditions et automatisations
-- (docs/product-specs/2026-08-10-lms-program/06-adaptive-automation.md),
-- "Remédiation et positionnement" section.
--
-- ADP-009 — Un test initial peut recommander, imposer ou dispenser des
--   étapes selon des seuils versionnés.
-- ADP-010 — Un échec peut affecter une activité de remédiation et
--   autoriser une nouvelle tentative après complétion.
-- ADP-011 — Une exemption conserve la preuve et n'est pas équivalente à
--   une complétion normale dans les rapports.
--
-- Non-objectif V1: "Algorithme adaptatif auto-apprenant sans règle
-- humaine." Combined with ADP-009's own "seuils versionnés" wording, this
-- rules out mid-test adaptive branching — a placement test is an ordinary
-- assessment (spec 08, already built with real scoring); only the
-- end-of-attempt outcome (recommend/impose/exempt a downstream step) is
-- new here. Nothing in the spec's indicative data model names a table for
-- this — greenfield, versioned the same way rule_sets/rule_set_versions
-- already are (immutable version snapshots, a wrapper row tracking
-- published_version) rather than mutable per-row status flags.
--
-- Delivery reuses what's already built rather than new schema:
--   - "recommander"/"imposer" → assignment_targets insert (spec 01) —
--     the only real per-learner content-assignment mechanism this
--     codebase has. "Imposer" gaining an actual hard gate (vs. just an
--     assignment appearing) is composition, not new mechanics: staff can
--     already build an activity_completed rule_set condition
--     (20260810200000, fully working) against the remediation assignment
--     to block a downstream step — not invented here, already available.
--   - "dispenser" (exempt) → release_state gets a new 'exempted' effect.
--     ADP-011's "conserve la preuve" is release_state_exemptions, an
--     append-only audit row (attempt/score/threshold-version) — same
--     posture as accommodation_access_log elsewhere in this codebase.
--     recompute_release_state() is patched to never downgrade an
--     'exempted' row: an exemption is a deliberate override of the normal
--     rule engine, not just another computed state it should recompute
--     over on the next nightly sweep or event trigger.
--   - Reporting distinction (ADP-011, "pas équivalente... dans les
--     rapports") is real at the data level — release_state_exemptions is
--     a separate audit trail from ordinary completion, effect='exempted'
--     is distinct from 'unlocked' — but no analytics dashboard visual
--     breaks it out yet (spec 07 territory, not attempted here).

-- ── placement_threshold_sets / _versions : versioned, mirrors rule_sets ──
create table public.placement_threshold_sets (
  id             uuid primary key default gen_random_uuid(),
  assessment_id  uuid not null references public.assessments(id) on delete cascade unique,
  status         text not null default 'draft' check (status in ('draft','published')),
  published_version integer not null default 0,
  created_by     uuid not null references auth.users(id) default auth.uid(),
  created_at     timestamptz not null default now()
);

create table public.placement_threshold_set_versions (
  id         uuid primary key default gen_random_uuid(),
  set_id     uuid not null references public.placement_threshold_sets(id) on delete cascade,
  version    integer not null,
  -- array of {min_percentage, max_percentage, outcome: 'recommend'|'impose'|'exempt',
  --   remediation_assignment_id? (recommend/impose), exempt_target_type?/exempt_target_id? (exempt)}
  thresholds jsonb not null,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (set_id, version)
);

alter table public.placement_threshold_sets enable row level security;
alter table public.placement_threshold_set_versions enable row level security;

create policy placement_threshold_sets_staff on public.placement_threshold_sets
  for select using (exists (select 1 from public.assessments a where a.id = assessment_id and public.has_org_role(a.org_id, array['trainer','pedago','admin'])));
create policy placement_threshold_set_versions_staff_read on public.placement_threshold_set_versions
  for select using (exists (select 1 from public.placement_threshold_sets s join public.assessments a on a.id = s.assessment_id where s.id = set_id and public.has_org_role(a.org_id, array['trainer','pedago','admin'])));
-- No insert policy: publish_placement_thresholds() (below) is the only writer.

-- ── publish_placement_thresholds() : validates + versions ───────────────
create or replace function public.publish_placement_thresholds(p_assessment_id uuid, p_thresholds jsonb)
returns public.placement_threshold_set_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_set public.placement_threshold_sets;
  v_next_version integer;
  v_entry jsonb;
  v_result public.placement_threshold_set_versions;
begin
  select org_id into v_org_id from public.assessments where id = p_assessment_id;
  if v_org_id is null then
    raise exception 'Assessment not found';
  end if;
  if not public.has_org_role(v_org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  if jsonb_typeof(p_thresholds) <> 'array' or jsonb_array_length(p_thresholds) = 0 then
    raise exception 'thresholds_required';
  end if;

  for v_entry in select * from jsonb_array_elements(p_thresholds)
  loop
    if (v_entry->>'min_percentage')::numeric is null or (v_entry->>'max_percentage')::numeric is null
       or (v_entry->>'min_percentage')::numeric < 0 or (v_entry->>'max_percentage')::numeric > 100
       or (v_entry->>'min_percentage')::numeric > (v_entry->>'max_percentage')::numeric then
      raise exception 'invalid_threshold_range';
    end if;
    if v_entry->>'outcome' not in ('recommend','impose','exempt') then
      raise exception 'invalid_outcome';
    end if;
    if v_entry->>'outcome' in ('recommend','impose') and nullif(v_entry->>'remediation_assignment_id','') is null then
      raise exception 'remediation_assignment_id_required';
    end if;
    if v_entry->>'outcome' = 'exempt' and (nullif(v_entry->>'exempt_target_type','') is null or nullif(v_entry->>'exempt_target_id','') is null) then
      raise exception 'exempt_target_required';
    end if;
  end loop;

  insert into public.placement_threshold_sets (assessment_id)
  values (p_assessment_id)
  on conflict (assessment_id) do update set assessment_id = excluded.assessment_id
  returning * into v_set;

  select coalesce(max(version), 0) + 1 into v_next_version from public.placement_threshold_set_versions where set_id = v_set.id;

  insert into public.placement_threshold_set_versions (set_id, version, thresholds)
  values (v_set.id, v_next_version, p_thresholds)
  returning * into v_result;

  update public.placement_threshold_sets set status = 'published', published_version = v_next_version where id = v_set.id;

  return v_result;
end;
$$;

revoke all on function public.publish_placement_thresholds(uuid, jsonb) from public;
grant execute on function public.publish_placement_thresholds(uuid, jsonb) to authenticated;

-- ── release_state gains 'exempted' ───────────────────────────────────────
do $$
declare
  v_conname text;
begin
  select conname into v_conname from pg_constraint
    where conrelid = 'public.release_state'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%effect%';
  if v_conname is not null then
    execute format('alter table public.release_state drop constraint %I', v_conname);
  end if;
end $$;
alter table public.release_state add constraint release_state_effect_check
  check (effect in ('hidden','locked','unlocked','recommended','exempted'));

-- ── release_state_exemptions : ADP-011's "conserve la preuve" ────────────
create table public.release_state_exemptions (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations(id) on delete cascade,
  learner_id            uuid not null references auth.users(id) on delete cascade,
  target_type           text not null,
  target_id             uuid not null,
  attempt_id            uuid not null references public.assessment_attempts(id) on delete cascade,
  percentage            numeric not null,
  threshold_set_version integer not null,
  created_at            timestamptz not null default now()
);
create index release_state_exemptions_learner_idx on public.release_state_exemptions(learner_id, target_type, target_id);

alter table public.release_state_exemptions enable row level security;
create policy release_state_exemptions_read on public.release_state_exemptions
  for select using (learner_id = auth.uid() or public.has_org_role(org_id, array['trainer','pedago','registrar','admin']));
-- No insert policy: only _apply_placement_outcome() (security definer,
-- called from submit_assessment_attempt()) writes.

-- ── recompute_release_state() : never downgrade an exemption ────────────
-- Full body from 20260811070000_release_state_engine.sql, verbatim,
-- except the on-conflict upsert now skips rows currently 'exempted' — an
-- exemption is a deliberate override, not something the normal
-- condition-evaluation sweep should ever silently revert.
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
      set effect = excluded.effect, reason = excluded.reason, rule_version = excluded.rule_version, computed_at = excluded.computed_at
      where release_state.effect is distinct from 'exempted';

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.recompute_release_state(uuid, uuid) from public;
grant execute on function public.recompute_release_state(uuid, uuid) to authenticated;

-- ── _apply_placement_outcome() : the decision, applied on submit ────────
create or replace function public._apply_placement_outcome(p_attempt public.assessment_attempts)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_set public.placement_threshold_sets;
  v_thresholds jsonb;
  v_match jsonb;
  v_org_id uuid;
begin
  select * into v_set from public.placement_threshold_sets where assessment_id = p_attempt.assessment_id and status = 'published';
  if v_set.id is null then
    return;
  end if;

  select org_id into v_org_id from public.assessments where id = p_attempt.assessment_id;

  select thresholds into v_thresholds from public.placement_threshold_set_versions where set_id = v_set.id and version = v_set.published_version;

  select t into v_match from jsonb_array_elements(v_thresholds) t
    where (t->>'min_percentage')::numeric <= p_attempt.percentage and (t->>'max_percentage')::numeric >= p_attempt.percentage
    limit 1;
  if v_match is null then
    return;
  end if;

  if v_match->>'outcome' in ('recommend', 'impose') then
    insert into public.assignment_targets (assignment_id, target_type, target_id)
    values ((v_match->>'remediation_assignment_id')::uuid, 'learner', p_attempt.learner_id)
    on conflict (assignment_id, target_type, target_id) do nothing;

  elsif v_match->>'outcome' = 'exempt' then
    insert into public.release_state (org_id, target_type, target_id, learner_id, effect, reason, rule_version, computed_at)
    values (v_org_id, v_match->>'exempt_target_type', (v_match->>'exempt_target_id')::uuid, p_attempt.learner_id, 'exempted', 'placement_exemption:' || p_attempt.id, v_set.published_version, now())
    on conflict (target_type, target_id, learner_id) do update
      set effect = 'exempted', reason = excluded.reason, rule_version = excluded.rule_version, computed_at = now();

    insert into public.release_state_exemptions (org_id, learner_id, target_type, target_id, attempt_id, percentage, threshold_set_version)
    values (v_org_id, p_attempt.learner_id, v_match->>'exempt_target_type', (v_match->>'exempt_target_id')::uuid, p_attempt.id, p_attempt.percentage, v_set.published_version);
  end if;
end;
$$;

revoke all on function public._apply_placement_outcome(public.assessment_attempts) from public;

-- ── submit_assessment_attempt() : call it after scoring ──────────────────
-- Full body from 20260812060000_assessment_correction_engine.sql,
-- verbatim, plus one new call at the end.
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

  perform public._apply_placement_outcome(v_result);

  return v_result;
end;
$$;

revoke all on function public.submit_assessment_attempt(uuid) from public;
grant execute on function public.submit_assessment_attempt(uuid) to authenticated;
