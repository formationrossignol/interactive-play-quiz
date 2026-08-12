-- Spec 07 — Analytics pédagogiques, psychométrie et signaux de risque
-- (docs/product-specs/2026-08-10-lms-program/07-learning-analytics.md).
--
-- ANA-020: "Comparaison de cohortes exige taille minimale configurable pour
-- éviter l'identification indirecte." RESTE-A-FAIRE.md flagged this as open
-- and, on inspection, it's not just an unbuilt feature: analytics_daily_enrollment,
-- analytics_daily_competency and analytics_daily_item today grant
-- trainer/pedago/admin a `for select` RLS policy with no row-count floor —
-- the client (analyticsDashboard.ts) fetches every row (per session, per
-- competency, per item revision, per day) and only sums them client-side.
-- The raw small-N rows are already on the wire and selectable directly via
-- the same PostgREST call, which is exactly the "combinaison rare"
-- re-identification vector the spec's confidentiality section warns about
-- (e.g. a 2-learner session's started/completed counts, attributable to a
-- named session by anyone with session list access).
--
-- Fix: drop direct client select on those three tables (analytics_daily_activity
-- is untouched — it's per-learner by construction, already-authorized direct
-- pedagogical monitoring, a different category per the spec, not a cohort
-- comparison) and replace with security-definer RPCs that pre-aggregate to
-- org+day totals (no session_id/competency_id/item_revision_id ever leaves
-- the database) and suppress the whole period when the underlying
-- population is below a per-org configurable minimum — same shape as
-- risk_signal_settings (20260811010000).
--
-- This does not build ANA-007's actual cohort-comparison screens (session vs.
-- session, group vs. group — still nonexistent, see RESTE-A-FAIRE.md §07):
-- doing that would mean guessing a comparison UI nobody asked for yet. What
-- this closes is the concrete leak that exists right now, and it lays the
-- one settings table + suppression pattern any future cohort-comparison
-- screen (or ANA-011's own sample-size gate) can reuse rather than
-- reinventing.

create table public.analytics_privacy_settings (
  org_id          uuid primary key references public.organizations(id) on delete cascade,
  min_cohort_size integer not null default 5 check (min_cohort_size >= 1),
  updated_at      timestamptz not null default now()
);
create trigger analytics_privacy_settings_touch before update on public.analytics_privacy_settings
  for each row execute function public.touch_updated_at();

alter table public.analytics_privacy_settings enable row level security;
create policy analytics_privacy_settings_read on public.analytics_privacy_settings
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));
create policy analytics_privacy_settings_manage on public.analytics_privacy_settings
  for all using (public.has_org_role(org_id, array['pedago','admin']))
  with check (public.has_org_role(org_id, array['pedago','admin']));

-- Internal helper, not directly callable by clients (no grant to
-- authenticated) — mirrors the risk_signal_settings coalesce-to-default
-- pattern used throughout generate_risk_signals().
create or replace function public._get_min_cohort_size(p_org_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select min_cohort_size from public.analytics_privacy_settings where org_id = p_org_id), 5);
$$;
revoke all on function public._get_min_cohort_size(uuid) from public;

-- Raw per-cohort rows are no longer directly selectable: only the
-- aggregated RPCs below (security definer, bypass RLS as table owner —
-- same posture already relied on for the write side of these tables) can
-- read them now.
drop policy analytics_daily_enrollment_staff_read on public.analytics_daily_enrollment;
drop policy analytics_daily_competency_staff_read on public.analytics_daily_competency;
drop policy analytics_daily_item_staff_read on public.analytics_daily_item;

-- ── get_org_enrollment_totals(): org+period totals, no session_id ──────────
create or replace function public.get_org_enrollment_totals(p_org_id uuid, p_since date)
returns table(started_count bigint, completed_count bigint, withdrawn_count bigint, waitlisted_count bigint, suppressed boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_min integer;
  v_started bigint;
  v_completed bigint;
  v_withdrawn bigint;
  v_waitlisted bigint;
begin
  if not public.has_org_role(p_org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  v_min := public._get_min_cohort_size(p_org_id);

  select coalesce(sum(e.started_count), 0), coalesce(sum(e.completed_count), 0),
         coalesce(sum(e.withdrawn_count), 0), coalesce(sum(e.waitlisted_count), 0)
  into v_started, v_completed, v_withdrawn, v_waitlisted
  from public.analytics_daily_enrollment e
  where e.org_id = p_org_id and e.day >= p_since;

  if (v_started + v_completed + v_withdrawn + v_waitlisted) < v_min then
    return query select null::bigint, null::bigint, null::bigint, null::bigint, true;
  else
    return query select v_started, v_completed, v_withdrawn, v_waitlisted, false;
  end if;
end;
$$;
revoke all on function public.get_org_enrollment_totals(uuid, date) from public;
grant execute on function public.get_org_enrollment_totals(uuid, date) to authenticated;

-- ── get_daily_competency_totals(): per-day org totals, no competency_id ────
-- Sparse like the source table: a day whose org-wide evidence_count falls
-- under the threshold is simply omitted (the dashboard's chart already
-- treats missing days as a gap, same as a day with no rollup yet).
create or replace function public.get_daily_competency_totals(p_org_id uuid, p_since date)
returns table(day date, evidence_count bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_org_role(p_org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  return query
    select c.day, sum(c.evidence_count)::bigint as evidence_count
    from public.analytics_daily_competency c
    where c.org_id = p_org_id and c.day >= p_since
    group by c.day
    having sum(c.evidence_count) >= public._get_min_cohort_size(p_org_id)
    order by c.day;
end;
$$;
revoke all on function public.get_daily_competency_totals(uuid, date) from public;
grant execute on function public.get_daily_competency_totals(uuid, date) to authenticated;

-- ── get_daily_item_totals(): per-day org totals, no item_revision_id ───────
-- No screen reads analytics_daily_item yet (ANA-010/011/012 aren't built —
-- see 20260812070000's header), but the table is live in prod and was
-- exposed to any staff caller at full per-item granularity via the same RLS
-- gap this migration closes elsewhere; fixed here too rather than left for
-- whoever builds the psychometrics screens to discover.
create or replace function public.get_daily_item_totals(p_org_id uuid, p_since date)
returns table(day date, responses_count bigint, correct_count bigint, omitted_count bigint, avg_score_ratio numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_org_role(p_org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  return query
    select
      i.day,
      sum(i.responses_count)::bigint,
      sum(i.correct_count)::bigint,
      sum(i.omitted_count)::bigint,
      (sum(i.avg_score_ratio * i.responses_count) / nullif(sum(i.responses_count) filter (where i.avg_score_ratio is not null), 0))
    from public.analytics_daily_item i
    where i.org_id = p_org_id and i.day >= p_since
    group by i.day
    having sum(i.responses_count) >= public._get_min_cohort_size(p_org_id)
    order by i.day;
end;
$$;
revoke all on function public.get_daily_item_totals(uuid, date) from public;
grant execute on function public.get_daily_item_totals(uuid, date) to authenticated;

-- ── set_min_cohort_size(): upsert, pedago/admin only ────────────────────────
create or replace function public.set_min_cohort_size(p_org_id uuid, p_min_cohort_size integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_org_role(p_org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  if p_min_cohort_size < 1 then
    raise exception 'min_cohort_size must be at least 1';
  end if;

  insert into public.analytics_privacy_settings (org_id, min_cohort_size)
  values (p_org_id, p_min_cohort_size)
  on conflict (org_id) do update set min_cohort_size = excluded.min_cohort_size, updated_at = now();
end;
$$;
revoke all on function public.set_min_cohort_size(uuid, integer) from public;
grant execute on function public.set_min_cohort_size(uuid, integer) to authenticated;
