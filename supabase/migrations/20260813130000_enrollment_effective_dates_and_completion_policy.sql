-- Spec 02 — Inscriptions, sessions et gestion des apprenants
-- (docs/product-specs/2026-08-10-lms-program/02-enrollment-roster.md).
--
-- ENR-017 (dates effectives/échéances relatives recalculées) + la règle
-- métier libre "La complétion est calculée par politique versionnée :
-- activités obligatoires, score, présence et durée éventuelle" (ligne 150 du
-- spec). `attendance_events` (spec 02, session précédente) fournit déjà la
-- matière première présence ; ce fichier écrit le calcul lui-même.

-- ── self_paced_relative avait un mode reconnu mais aucune durée à calculer
-- une échéance depuis — colonne manquante, pas juste un branchement.
alter table public.course_sessions
  add column relative_duration_days integer check (relative_duration_days is null or relative_duration_days > 0);

-- ── effective_enrollment_access_start_at() / effective_enrollment_due_at() ──
-- Miroir de effective_assignment_due_at() (20260811040000) : fonctions pures,
-- security definer, composant les règles dans un ordre fixe, pensées pour
-- être appelées partout où une date "effective" compte plutôt que de relire
-- une colonne brute. `enrollments.effective_start_at` est déjà, depuis
-- 20260810150000, "la date effective d'inscription" que ENR-017 réclame —
-- rien à ajouter côté colonne pour le début, seulement la composer avec le
-- mode de la session.
create or replace function public.effective_enrollment_access_start_at(p_enrollment_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_enrollment public.enrollments;
  v_session public.course_sessions;
begin
  select * into v_enrollment from public.enrollments where id = p_enrollment_id;
  if v_enrollment.id is null then
    return null;
  end if;
  select * into v_session from public.course_sessions where id = v_enrollment.session_id;
  if v_session.mode in ('fixed', 'recurring') and v_session.starts_at is not null then
    return greatest(v_session.starts_at, v_enrollment.effective_start_at);
  end if;
  -- self_paced_relative / self_paced_open: accessible from the moment the
  -- learner actually enrolled, there is no shared calendar start.
  return v_enrollment.effective_start_at;
end;
$$;

revoke all on function public.effective_enrollment_access_start_at(uuid) from public;
grant execute on function public.effective_enrollment_access_start_at(uuid) to authenticated;

create or replace function public.effective_enrollment_due_at(p_enrollment_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_enrollment public.enrollments;
  v_session public.course_sessions;
begin
  select * into v_enrollment from public.enrollments where id = p_enrollment_id;
  if v_enrollment.id is null then
    return null;
  end if;

  -- extend_enrollment_due_date() (20260812110000) is the only writer of
  -- effective_due_at after row creation — a non-null value here is always an
  -- explicit staff override and wins over any computed date, same
  -- precedence style as due_override in effective_assignment_due_at().
  if v_enrollment.effective_due_at is not null then
    return v_enrollment.effective_due_at;
  end if;

  select * into v_session from public.course_sessions where id = v_enrollment.session_id;
  if v_session.mode in ('fixed', 'recurring') then
    return v_session.ends_at;
  end if;
  if v_session.mode = 'self_paced_relative' and v_session.relative_duration_days is not null then
    return v_enrollment.effective_start_at + make_interval(days => v_session.relative_duration_days);
  end if;
  -- self_paced_open, or self_paced_relative without a configured duration:
  -- no deadline exists to compute.
  return null;
end;
$$;

revoke all on function public.effective_enrollment_due_at(uuid) from public;
grant execute on function public.effective_enrollment_due_at(uuid) to authenticated;

-- ── completion_policy_sets / _set_versions : versioned, mirrors placement_threshold_sets ──
-- A later republish must never retroactively alter an already-computed
-- completion — enrollment_completion_results (below) snapshots the exact
-- published_version it was computed against, same pattern as
-- release_state_exemptions.threshold_set_version (ADP-011).
create table public.completion_policy_sets (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null unique references public.course_sessions(id) on delete cascade,
  status             text not null default 'draft' check (status in ('draft', 'published')),
  published_version  integer not null default 0,
  created_by         uuid not null references auth.users(id) default auth.uid(),
  created_at         timestamptz not null default now()
);

create table public.completion_policy_set_versions (
  id         uuid primary key default gen_random_uuid(),
  set_id     uuid not null references public.completion_policy_sets(id) on delete cascade,
  version    integer not null,
  -- { required_assignment_ids?: uuid[], min_score_pct?: number,
  --   min_attendance_pct?: number, min_duration_days?: number }
  -- Every key optional/independent — an empty {} is a valid published
  -- policy meaning "no automatic completion gate", staff still complete
  -- manually via transition_enrollment() as before.
  definition jsonb not null,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (set_id, version)
);

alter table public.completion_policy_sets enable row level security;
alter table public.completion_policy_set_versions enable row level security;

create policy completion_policy_sets_staff_read on public.completion_policy_sets
  for select using (exists (select 1 from public.course_sessions s where s.id = session_id and public.has_org_role(s.org_id, array['trainer', 'registrar', 'pedago', 'admin'])));
create policy completion_policy_set_versions_staff_read on public.completion_policy_set_versions
  for select using (exists (select 1 from public.completion_policy_sets cps join public.course_sessions s on s.id = cps.session_id where cps.id = set_id and public.has_org_role(s.org_id, array['trainer', 'registrar', 'pedago', 'admin'])));
-- No insert policy: publish_completion_policy() below is the only writer.

create or replace function public.publish_completion_policy(
  p_session_id uuid,
  p_definition jsonb
)
returns public.completion_policy_sets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_set public.completion_policy_sets;
  v_next_version integer;
begin
  select org_id into v_org_id from public.course_sessions where id = p_session_id;
  if v_org_id is null then
    raise exception 'Session not found';
  end if;
  if not public.has_org_role(v_org_id, array['registrar', 'pedago', 'admin']) then
    raise exception 'Not authorized';
  end if;
  if p_definition is null or jsonb_typeof(p_definition) <> 'object' then
    raise exception 'invalid_definition';
  end if;

  insert into public.completion_policy_sets (session_id, created_by)
  values (p_session_id, auth.uid())
  on conflict (session_id) do nothing;

  select * into v_set from public.completion_policy_sets where session_id = p_session_id for update;

  select coalesce(max(version), 0) + 1 into v_next_version from public.completion_policy_set_versions where set_id = v_set.id;
  insert into public.completion_policy_set_versions (set_id, version, definition, created_by)
  values (v_set.id, v_next_version, p_definition, auth.uid());

  update public.completion_policy_sets set status = 'published', published_version = v_next_version where id = v_set.id
  returning * into v_set;

  return v_set;
end;
$$;

revoke all on function public.publish_completion_policy(uuid, jsonb) from public;
grant execute on function public.publish_completion_policy(uuid, jsonb) to authenticated;

-- ── enrollment_completion_results : last computed snapshot per enrollment ──
create table public.enrollment_completion_results (
  id             uuid primary key default gen_random_uuid(),
  enrollment_id  uuid not null references public.enrollments(id) on delete cascade,
  policy_set_id  uuid not null references public.completion_policy_sets(id) on delete cascade,
  policy_version integer not null,
  satisfied      boolean not null,
  details        jsonb not null default '{}'::jsonb,
  computed_at    timestamptz not null default now(),
  unique (enrollment_id)
);

alter table public.enrollment_completion_results enable row level security;
create policy enrollment_completion_results_read on public.enrollment_completion_results
  for select using (
    exists (
      select 1 from public.enrollments e
      where e.id = enrollment_id
        and (e.learner_id = auth.uid() or public.has_org_role(e.org_id, array['registrar', 'pedago', 'admin']))
    )
  );
-- No insert policy: only the compute functions below (security definer) write.

-- ── _compute_enrollment_completion_internal() : evaluate one enrollment ────
-- Skips anything not 'active' — a terminal enrollment (completed, failed,
-- withdrawn...) is never reopened by a later policy change or a later
-- sweep, same non-reconquest guarantee as recompute_release_state() around
-- 'exempted' (20260813080000).
create or replace function public._compute_enrollment_completion_internal(p_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment public.enrollments;
  v_set public.completion_policy_sets;
  v_def jsonb;
  v_satisfied boolean := true;
  v_details jsonb := '{}'::jsonb;
  v_required_ids text[];
  v_id text;
  v_missing text[] := '{}';
  v_min_score numeric;
  v_score_pct numeric;
  v_min_attendance numeric;
  v_attendance_pct numeric;
  v_min_duration integer;
  v_days_enrolled numeric;
begin
  select * into v_enrollment from public.enrollments where id = p_enrollment_id for update;
  if v_enrollment.id is null or v_enrollment.status <> 'active' then
    return;
  end if;

  select * into v_set from public.completion_policy_sets where session_id = v_enrollment.session_id and status = 'published';
  if v_set.id is null then
    return;
  end if;
  select definition into v_def from public.completion_policy_set_versions where set_id = v_set.id and version = v_set.published_version;
  if v_def is null then
    return;
  end if;

  -- required activities: "done" means a real submission exists (anything
  -- past 'draft'), not necessarily graded yet — matches ENR's "activités
  -- obligatoires" wording, distinct from the score gate below.
  if jsonb_typeof(v_def->'required_assignment_ids') = 'array' then
    select array_agg(x) into v_required_ids from jsonb_array_elements_text(v_def->'required_assignment_ids') x;
    foreach v_id in array coalesce(v_required_ids, '{}') loop
      if not exists (
        select 1 from public.submissions
        where assignment_id = v_id::uuid and learner_id = v_enrollment.learner_id and status <> 'draft'
      ) then
        v_missing := array_append(v_missing, v_id);
      end if;
    end loop;
    if array_length(v_missing, 1) > 0 then
      v_satisfied := false;
      v_details := v_details || jsonb_build_object('missing_assignments', to_jsonb(v_missing));
    end if;
  end if;

  -- score: weighted average of published grade_results for this session,
  -- same weighting field (grade_items.weight) the gradebook (GBK-004)
  -- already exposes client-side — items with no result yet are skipped
  -- rather than counted as 0, consistent with "not graded" not being a
  -- failure in itself.
  v_min_score := nullif(v_def->>'min_score_pct', '')::numeric;
  if v_min_score is not null then
    select case when sum(gi.weight) > 0 then round(100 * sum(gr.points / nullif(gi.max_points, 0) * gi.weight) / sum(gi.weight), 2) else null end
    into v_score_pct
    from public.grade_items gi
    join public.grade_results gr on gr.grade_item_id = gi.id and gr.learner_id = v_enrollment.learner_id
    where gi.session_id = v_enrollment.session_id and gr.status = 'graded' and gr.published_at is not null;

    v_details := v_details || jsonb_build_object('score_pct', v_score_pct);
    if v_score_pct is null or v_score_pct < v_min_score then
      v_satisfied := false;
    end if;
  end if;

  -- attendance: present days over (present+absent+late) days recorded for
  -- this learner — 'excused' days are dropped from both sides so an
  -- authorized absence never counts against the ratio.
  v_min_attendance := nullif(v_def->>'min_attendance_pct', '')::numeric;
  if v_min_attendance is not null then
    select case when count(*) filter (where status in ('present', 'absent', 'late')) > 0
      then round(100.0 * count(*) filter (where status = 'present') / count(*) filter (where status in ('present', 'absent', 'late')), 2)
      else null end
    into v_attendance_pct
    from public.attendance_events
    where session_id = v_enrollment.session_id and learner_id = v_enrollment.learner_id;

    v_details := v_details || jsonb_build_object('attendance_pct', v_attendance_pct);
    if v_attendance_pct is null or v_attendance_pct < v_min_attendance then
      v_satisfied := false;
    end if;
  end if;

  -- minimum enrolled duration: "durée éventuelle" from the spec's own
  -- wording — a floor on time-in-session before completion can trigger at
  -- all, not a deadline.
  v_min_duration := nullif(v_def->>'min_duration_days', '')::integer;
  if v_min_duration is not null then
    v_days_enrolled := extract(epoch from (now() - v_enrollment.effective_start_at)) / 86400.0;
    v_details := v_details || jsonb_build_object('days_enrolled', round(v_days_enrolled, 1));
    if v_days_enrolled < v_min_duration then
      v_satisfied := false;
    end if;
  end if;

  insert into public.enrollment_completion_results (enrollment_id, policy_set_id, policy_version, satisfied, details)
  values (p_enrollment_id, v_set.id, v_set.published_version, v_satisfied, v_details)
  on conflict (enrollment_id) do update set
    policy_set_id = excluded.policy_set_id,
    policy_version = excluded.policy_version,
    satisfied = excluded.satisfied,
    details = excluded.details,
    computed_at = now();

  if v_satisfied then
    update public.enrollments set status = 'completed' where id = p_enrollment_id;
    insert into public.enrollment_history (enrollment_id, from_status, to_status, actor_id, source, reason)
    values (p_enrollment_id, 'active', 'completed', null, 'system', 'completion_policy_satisfied');
    perform public.emit_learning_event('enrollment.completed', v_enrollment.org_id, v_enrollment.learner_id, 'enrollment', p_enrollment_id, jsonb_build_object('session_id', v_enrollment.session_id, 'policy_version', v_set.published_version));
  end if;
end;
$$;

revoke all on function public._compute_enrollment_completion_internal(uuid) from public;

-- Staff on-demand recompute (e.g. right after publishing a new policy
-- version, without waiting for the nightly sweep).
create or replace function public.recompute_enrollment_completion(p_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from public.enrollments where id = p_enrollment_id;
  if v_org_id is null then
    raise exception 'Enrollment not found';
  end if;
  if not public.has_org_role(v_org_id, array['registrar', 'pedago', 'admin']) then
    raise exception 'Not authorized';
  end if;
  perform public._compute_enrollment_completion_internal(p_enrollment_id);
end;
$$;

revoke all on function public.recompute_enrollment_completion(uuid) from public;
grant execute on function public.recompute_enrollment_completion(uuid) to authenticated;

create or replace function public._sweep_enrollment_completion_internal(p_org_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment_id uuid;
  v_count integer := 0;
begin
  for v_enrollment_id in
    select e.id from public.enrollments e
    join public.completion_policy_sets cps on cps.session_id = e.session_id and cps.status = 'published'
    where e.org_id = p_org_id and e.status = 'active'
  loop
    perform public._compute_enrollment_completion_internal(v_enrollment_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public._sweep_enrollment_completion_internal(uuid) from public;

-- ── run_scheduled_lms_analytics_jobs() : 6th isolated step ──────────────
-- Full body from 20260813070000_automation_execution_engine.sql, verbatim,
-- plus one new begin/exception block.
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

    begin
      perform public._generate_assignment_due_reminders_internal(v_org.id);
    exception when others then
      raise warning 'run_scheduled_lms_analytics_jobs: assignment due reminders failed for org %: %', v_org.id, sqlerrm;
    end;

    begin
      perform public._run_automation_rules_internal(v_org.id, v_yesterday);
    exception when others then
      raise warning 'run_scheduled_lms_analytics_jobs: automation rules failed for org %: %', v_org.id, sqlerrm;
    end;

    begin
      perform public._sweep_enrollment_completion_internal(v_org.id);
    exception when others then
      raise warning 'run_scheduled_lms_analytics_jobs: enrollment completion sweep failed for org %: %', v_org.id, sqlerrm;
    end;
  end loop;
end;
$$;

revoke all on function public.run_scheduled_lms_analytics_jobs() from public;
