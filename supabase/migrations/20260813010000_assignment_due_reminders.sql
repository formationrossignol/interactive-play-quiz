-- Spec 01 — Devoirs, remises et carnet de notes
-- (docs/product-specs/2026-08-10-lms-program/01-assignments-gradebook.md).
--
-- RESTE-A-FAIRE.md §01: "Notifications programmées (J-7/J-1/retard) —
-- table notifications existe, rien ne les déclenche pour les devoirs
-- (bloqué par : pas d'ordonnanceur)." The scheduler blocker is resolved
-- (pg_cron, 20260812020000_scheduler.sql) — what was still missing was the
-- business logic itself, not the ability to run it nightly.
--
-- notifications/notification_preferences and their full display surface
-- (NotificationCenter.tsx, /notifications, realtime) already exist and work
-- end-to-end (used by grade-publication notifications since
-- 20260811050000_lms_reconciliation.sql) — this needed no new table, no new
-- UI, just a generator. Reuses category 'system' (same as the existing
-- grade-publication notifications) rather than adding a new check-constraint
-- value + icon/label entry + preference toggle for a single generator.
--
-- Due date: effective_assignment_due_at() (spec 05), not raw
-- assignments.due_at — same precedent generate_risk_signals()'s overdue
-- rule already follows, so a learner's accommodation (extended_deadline/
-- no_time_limit) is respected by reminders the same way it already is by
-- lateness. A NULL return (no_time_limit) skips that learner entirely for
-- this assignment — no J-7/J-1/retard makes sense against no deadline.
--
-- Target resolution: same union-of-target_types CTE generate_risk_signals()
-- already uses to expand assignment_targets (session/group/learner) into a
-- learner set — not assignment_visible_to_learner() itself, which only
-- answers a single learner/assignment pair, not "enumerate everyone".
--
-- "Already submitted" exclusion: same left-join-to-submissions predicate
-- as the overdue risk signal (s.id is null or s.status = 'draft') — a
-- learner who already turned something in doesn't need a reminder.
--
-- Dedup: notifications has no unique constraint or status column to lean
-- on (unlike risk_signals' open/resolved lifecycle) — reminders are fired
-- once ever per (learner, assignment, kind), keyed through
-- metadata->>'assignment_id' + metadata->>'reminder_kind', mirroring how
-- generate_risk_signals() scopes its own per-assignment dedup
-- (rs.factors->>'assignment_id') the same way.
create or replace function public._generate_assignment_due_reminders_internal(p_org_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  with target_learners as (
    select t.assignment_id, t.target_id as learner_id
    from public.assignment_targets t
    where t.target_type = 'learner'
    union
    select t.assignment_id, gm.user_id
    from public.assignment_targets t
    join public.share_group_members gm on gm.group_id = t.target_id
    where t.target_type = 'group' and gm.user_id is not null
    union
    select t.assignment_id, e.learner_id
    from public.assignment_targets t
    join public.enrollments e on e.session_id = t.target_id and e.status = 'active'
    where t.target_type = 'session'
  ),
  candidates as (
    select a.id as assignment_id, a.title, tl.learner_id,
      public.effective_assignment_due_at(a.id, tl.learner_id) as effective_due_at
    from public.assignments a
    join target_learners tl on tl.assignment_id = a.id
    left join public.submissions s on s.assignment_id = a.id and s.learner_id = tl.learner_id
    where a.org_id = p_org_id and a.status = 'published' and a.due_at is not null
      and (s.id is null or s.status = 'draft')
  ),
  reminders as (
    select assignment_id, title, learner_id, effective_due_at,
      case
        when effective_due_at is null then null
        when effective_due_at < now() then 'overdue'
        when (effective_due_at::date - current_date) = 7 then 'j7'
        when (effective_due_at::date - current_date) = 1 then 'j1'
        else null
      end as reminder_kind
    from candidates
  )
  insert into public.notifications (user_id, category, title, body, action_url, metadata)
  select
    r.learner_id, 'system',
    case r.reminder_kind
      when 'overdue' then 'Devoir en retard'
      when 'j7' then 'Échéance dans 7 jours'
      else 'Échéance demain'
    end,
    r.title,
    '/lms/assignments',
    jsonb_build_object('assignment_id', r.assignment_id, 'reminder_kind', r.reminder_kind, 'due_at', r.effective_due_at)
  from reminders r
  where r.reminder_kind is not null
    and public.notification_category_enabled(r.learner_id, 'system')
    and not exists (
      select 1 from public.notifications n
      where n.user_id = r.learner_id
        and n.metadata->>'assignment_id' = r.assignment_id::text
        and n.metadata->>'reminder_kind' = r.reminder_kind
    );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public._generate_assignment_due_reminders_internal(uuid) from public;

-- ── run_scheduled_lms_analytics_jobs(): add the 4th isolated step ──────────
-- Full body from 20260812130000_release_state_date_and_sweep.sql, verbatim,
-- plus one new begin/exception block matching the existing three.
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
  end loop;
end;
$$;

revoke all on function public.run_scheduled_lms_analytics_jobs() from public;
