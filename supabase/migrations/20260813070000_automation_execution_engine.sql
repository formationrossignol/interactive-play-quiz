-- Spec 06 — Parcours adaptatifs, conditions et automatisations
-- (docs/product-specs/2026-08-10-lms-program/06-adaptive-automation.md).
--
-- RESTE-A-FAIRE.md flagged (in the follow_up_tasks entry) that the
-- trigger→action automation engine was dormant: automation_rule_versions
-- had no writer anywhere, record_automation_run() had no caller anywhere.
-- automation_rules/automation_rule_versions/automation_runs/automation_actions
-- already existed (20260810200000_adaptive_automation.sql) but nothing
-- ever executed a rule. This migration is that execution engine.
--
-- AUT-002's six V1 action types, and how each is implemented:
--   - notification: insert into notifications (category 'system', same as
--     every other LMS notification this session added).
--   - email: this codebase already has a real email vendor wired
--     (Resend, supabase/functions/send-welcome-email + send-org-invitation,
--     RESEND_API_KEY) — not greenfield, not a new vendor decision. But
--     nothing in this repo's Postgres layer has ever called out to an edge
--     function from inside a migration/cron job (no pg_net usage anywhere,
--     confirmed by grep) — inventing that HTTP-from-Postgres wiring blind,
--     with no way to test it against the live project, would risk a
--     silently broken production email path. So: this migration queues to
--     automation_email_outbox (a durable, staff-visible record of what
--     should be sent) and a paired edge function
--     (supabase/functions/dispatch-automation-emails) drains it via the
--     same Resend call shape already used elsewhere. Actually invoking
--     that function on a schedule needs a one-time operator step (a
--     Supabase Dashboard Cron Job pointed at the function URL, or pg_net
--     wired later) — same category of one-time setup as setting
--     RESEND_API_KEY itself already is, not something a migration can do
--     unattended.
--   - assign_content: assignment_targets insert (spec 01, already built) —
--     "content" means an existing assignment, the only real per-learner
--     content-assignment mechanism this codebase has.
--   - extend_due_date: same assignment_targets.due_override this session
--     already built a UI for (due_override), just written by the engine
--     instead of a staff form.
--   - add_to_group/remove_from_group: share_group_members insert/delete —
--     "groupe pédagogique" is this codebase's only group concept
--     (share_groups, owner-scoped).
--   - follow_up_task: follow_up_tasks insert — the exact gap this session
--     already closed for manual creation; this is its automated sibling.
--
-- Trigger detection (the 8 automation_rules.trigger_type values) reuses
-- existing signal sources rather than inventing new event capture:
--   - enrollment: learning_events name='enrollment.started'.
--   - due_soon/overdue: same assignment_targets expansion +
--     effective_assignment_due_at() the J-7/J-1/overdue reminder job
--     already uses (20260813010000) — evaluated against "now", not the
--     rollup's p_day, since these are forward/current-looking, not
--     retrospective-for-yesterday like the other triggers.
--   - inactivity/failure: risk_signals newly opened that day
--     (rule_code='inactivity'/'repeated_failure') — reuses
--     generate_risk_signals()'s own detection rather than re-deriving it.
--   - completion: grade_results published that day.
--   - mastery_gained/mastery_expired: competency_mastery_history rows from
--     that day — simplified to to_level/from_level text comparison
--     (gained: to_level changed and isn't 'not_assessed'; expired:
--     dropped to 'not_assessed' from something else) rather than a full
--     mastery_scale_levels.position lookup — the extra join buys little
--     over reading the same domain-meaningful text values this history
--     table already stores.
--
-- Idempotency: automation_runs.idempotency_key is
-- "<rule_id>:<version>:<learner_id>:<instance_key>", instance_key being
-- whatever row identifies that specific trigger occurrence (a signal id,
-- a learning_event id, an assignment_id for due_soon/overdue — those two
-- fire once ever per (rule,learner,assignment), matching the reminder
-- job's own "once ever" semantics, not once per night the condition still
-- holds).

-- ── publish_automation_rule_version() : the missing writer ─────────────
create or replace function public.publish_automation_rule_version(p_rule_id uuid, p_config jsonb)
returns public.automation_rule_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.automation_rules;
  v_next_version integer;
  v_result public.automation_rule_versions;
begin
  select * into v_rule from public.automation_rules where id = p_rule_id for update;
  if v_rule.id is null then
    raise exception 'Automation rule not found';
  end if;
  if not public.has_org_role(v_rule.org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  if coalesce(p_config->>'action_type', '') not in ('notification','email','assign_content','extend_due_date','add_to_group','remove_from_group','follow_up_task') then
    raise exception 'invalid_action_type';
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version from public.automation_rule_versions where automation_rule_id = p_rule_id;

  insert into public.automation_rule_versions (automation_rule_id, version, config)
  values (p_rule_id, v_next_version, p_config)
  returning * into v_result;

  update public.automation_rules set status = 'published', published_version = v_next_version where id = p_rule_id;

  return v_result;
end;
$$;

revoke all on function public.publish_automation_rule_version(uuid, jsonb) from public;
grant execute on function public.publish_automation_rule_version(uuid, jsonb) to authenticated;

-- ── automation_email_outbox : queued, not sent inline ───────────────────
create table public.automation_email_outbox (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  learner_id uuid not null references auth.users(id) on delete cascade,
  subject    text not null,
  body       text not null,
  status     text not null default 'pending' check (status in ('pending','sent','failed')),
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
create index automation_email_outbox_pending_idx on public.automation_email_outbox(status, created_at) where status = 'pending';

alter table public.automation_email_outbox enable row level security;
create policy automation_email_outbox_staff_read on public.automation_email_outbox
  for select using (public.has_org_role(org_id, array['pedago','admin']));
-- No insert/update policy for authenticated: only _execute_automation_action()
-- (security definer) queues rows; only the dispatch-automation-emails edge
-- function (service_role, bypasses RLS entirely) marks them sent/failed.

-- ── _execute_automation_action() : one action, one learner ─────────────
create or replace function public._execute_automation_action(p_org_id uuid, p_learner_id uuid, p_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action_type text := p_config->>'action_type';
  v_params jsonb := coalesce(p_config->'params', '{}'::jsonb);
  v_assignment_id uuid;
  v_group_id uuid;
  v_base_due timestamptz;
begin
  if v_action_type = 'notification' then
    if not public.notification_category_enabled(p_learner_id, 'system') then
      return jsonb_build_object('skipped', true, 'reason', 'notifications_disabled');
    end if;
    insert into public.notifications (user_id, category, title, body, action_url)
    values (p_learner_id, 'system', coalesce(v_params->>'title', 'Notification'), coalesce(v_params->>'body', ''), '/lms/automation');
    return jsonb_build_object('applied', true);

  elsif v_action_type = 'email' then
    insert into public.automation_email_outbox (org_id, learner_id, subject, body)
    values (p_org_id, p_learner_id, coalesce(v_params->>'subject', 'Notification'), coalesce(v_params->>'body', ''));
    return jsonb_build_object('queued', true);

  elsif v_action_type = 'assign_content' then
    v_assignment_id := nullif(v_params->>'assignment_id', '')::uuid;
    if v_assignment_id is null then
      return jsonb_build_object('skipped', true, 'reason', 'missing_assignment_id');
    end if;
    insert into public.assignment_targets (assignment_id, target_type, target_id)
    values (v_assignment_id, 'learner', p_learner_id)
    on conflict (assignment_id, target_type, target_id) do nothing;
    return jsonb_build_object('assignment_id', v_assignment_id);

  elsif v_action_type = 'extend_due_date' then
    v_assignment_id := nullif(v_params->>'assignment_id', '')::uuid;
    if v_assignment_id is null or v_params->>'extra_days' is null then
      return jsonb_build_object('skipped', true, 'reason', 'missing_params');
    end if;
    select coalesce(
      (select due_override from public.assignment_targets where assignment_id = v_assignment_id and target_type = 'learner' and target_id = p_learner_id),
      (select due_at from public.assignments where id = v_assignment_id)
    ) into v_base_due;
    if v_base_due is null then
      return jsonb_build_object('skipped', true, 'reason', 'no_base_due_date');
    end if;
    insert into public.assignment_targets (assignment_id, target_type, target_id, due_override)
    values (v_assignment_id, 'learner', p_learner_id, v_base_due + make_interval(days => (v_params->>'extra_days')::int))
    on conflict (assignment_id, target_type, target_id) do update set due_override = excluded.due_override;
    return jsonb_build_object('assignment_id', v_assignment_id);

  elsif v_action_type in ('add_to_group', 'remove_from_group') then
    v_group_id := nullif(v_params->>'group_id', '')::uuid;
    if v_group_id is null then
      return jsonb_build_object('skipped', true, 'reason', 'missing_group_id');
    end if;
    if v_action_type = 'add_to_group' then
      insert into public.share_group_members (group_id, user_id) values (v_group_id, p_learner_id)
      on conflict (group_id, user_id) do nothing;
    else
      delete from public.share_group_members where group_id = v_group_id and user_id = p_learner_id;
    end if;
    return jsonb_build_object('group_id', v_group_id);

  elsif v_action_type = 'follow_up_task' then
    if nullif(v_params->>'assignee_id', '') is null then
      return jsonb_build_object('skipped', true, 'reason', 'missing_assignee_id');
    end if;
    insert into public.follow_up_tasks (org_id, automation_rule_id, assignee_id, learner_id, title)
    values (p_org_id, nullif(p_config->>'automation_rule_id', '')::uuid, (v_params->>'assignee_id')::uuid, p_learner_id, coalesce(v_params->>'title', 'Suivi automatique'));
    return jsonb_build_object('applied', true);

  else
    raise exception 'unknown_action_type: %', v_action_type;
  end if;
end;
$$;

revoke all on function public._execute_automation_action(uuid, uuid, jsonb) from public;

-- ── _automation_trigger_candidates() : who matches a trigger today ──────
create or replace function public._automation_trigger_candidates(p_org_id uuid, p_trigger_type text, p_day date)
returns table(learner_id uuid, instance_key text)
language sql
stable
security definer
set search_path = public
as $$
  select le.actor_id, le.id::text
  from public.learning_events le
  where p_trigger_type = 'enrollment' and le.org_id = p_org_id and le.name = 'enrollment.started' and le.occurred_at::date = p_day and le.actor_id is not null

  union all
  select tl.learner_id, a.id::text
  from public.assignments a
  join public.assignment_targets t on t.assignment_id = a.id
  join lateral (
    select t.target_id as learner_id where t.target_type = 'learner'
    union all
    select gm.user_id from public.share_group_members gm where t.target_type = 'group' and gm.group_id = t.target_id and gm.user_id is not null
    union all
    select e.learner_id from public.enrollments e where t.target_type = 'session' and e.session_id = t.target_id and e.status = 'active'
  ) tl on true
  left join public.submissions s on s.assignment_id = a.id and s.learner_id = tl.learner_id
  where p_trigger_type = 'due_soon' and a.org_id = p_org_id and a.status = 'published' and a.due_at is not null
    and (s.id is null or s.status = 'draft')
    and public.effective_assignment_due_at(a.id, tl.learner_id) is not null
    and (public.effective_assignment_due_at(a.id, tl.learner_id)::date - current_date) between 0 and 7

  union all
  select tl.learner_id, a.id::text
  from public.assignments a
  join public.assignment_targets t on t.assignment_id = a.id
  join lateral (
    select t.target_id as learner_id where t.target_type = 'learner'
    union all
    select gm.user_id from public.share_group_members gm where t.target_type = 'group' and gm.group_id = t.target_id and gm.user_id is not null
    union all
    select e.learner_id from public.enrollments e where t.target_type = 'session' and e.session_id = t.target_id and e.status = 'active'
  ) tl on true
  left join public.submissions s on s.assignment_id = a.id and s.learner_id = tl.learner_id
  where p_trigger_type = 'overdue' and a.org_id = p_org_id and a.status = 'published' and a.due_at is not null
    and (s.id is null or s.status = 'draft')
    and public.effective_assignment_due_at(a.id, tl.learner_id) is not null
    and public.effective_assignment_due_at(a.id, tl.learner_id) < now()

  union all
  select rs.learner_id, rs.id::text
  from public.risk_signals rs
  where p_trigger_type = 'inactivity' and rs.org_id = p_org_id and rs.rule_code = 'inactivity' and rs.created_at::date = p_day

  union all
  select rs.learner_id, rs.id::text
  from public.risk_signals rs
  where p_trigger_type = 'failure' and rs.org_id = p_org_id and rs.rule_code = 'repeated_failure' and rs.created_at::date = p_day

  union all
  select gr.learner_id, gr.id::text
  from public.grade_results gr
  join public.grade_items gi on gi.id = gr.grade_item_id
  where p_trigger_type = 'completion' and gi.org_id = p_org_id and gr.status = 'graded' and gr.published_at::date = p_day

  union all
  select cmh.learner_id, cmh.id::text
  from public.competency_mastery_history cmh
  join public.competencies c on c.id = cmh.competency_id
  join public.competency_frameworks f on f.id = c.framework_id
  where p_trigger_type = 'mastery_gained' and f.org_id = p_org_id and cmh.created_at::date = p_day
    and cmh.to_level is distinct from cmh.from_level and cmh.to_level <> 'not_assessed'

  union all
  select cmh.learner_id, cmh.id::text
  from public.competency_mastery_history cmh
  join public.competencies c on c.id = cmh.competency_id
  join public.competency_frameworks f on f.id = c.framework_id
  where p_trigger_type = 'mastery_expired' and f.org_id = p_org_id and cmh.created_at::date = p_day
    and cmh.to_level = 'not_assessed' and cmh.from_level is distinct from 'not_assessed';
$$;

revoke all on function public._automation_trigger_candidates(uuid, text, date) from public;

-- ── _run_automation_rules_internal() : the scheduler entry point ────────
create or replace function public._run_automation_rules_internal(p_org_id uuid, p_day date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule record;
  v_candidate record;
  v_idempotency_key text;
  v_run public.automation_runs;
  v_detail jsonb;
  v_count integer := 0;
begin
  for v_rule in
    select r.id, r.org_id, r.trigger_type, r.published_version, rv.config
    from public.automation_rules r
    join public.automation_rule_versions rv on rv.automation_rule_id = r.id and rv.version = r.published_version
    where r.org_id = p_org_id and r.status = 'published'
  loop
    for v_candidate in
      select * from public._automation_trigger_candidates(v_rule.org_id, v_rule.trigger_type, p_day)
    loop
      v_idempotency_key := v_rule.id || ':' || v_rule.published_version || ':' || v_candidate.learner_id || ':' || v_candidate.instance_key;

      if exists (select 1 from public.automation_runs where idempotency_key = v_idempotency_key) then
        continue;
      end if;

      begin
        v_detail := public._execute_automation_action(v_rule.org_id, v_candidate.learner_id, v_rule.config || jsonb_build_object('automation_rule_id', v_rule.id));

        insert into public.automation_runs (automation_rule_id, version, triggered_by, idempotency_key, status)
        values (v_rule.id, v_rule.published_version, v_rule.trigger_type, v_idempotency_key, 'success')
        returning * into v_run;

        insert into public.automation_actions (run_id, target_learner_id, action_type, result, detail)
        values (v_run.id, v_candidate.learner_id, v_rule.config->>'action_type', case when (v_detail->>'skipped')::boolean is true then 'skipped' else 'applied' end, v_detail);

        v_count := v_count + 1;
      exception when others then
        insert into public.automation_runs (automation_rule_id, version, triggered_by, idempotency_key, status, error_message)
        values (v_rule.id, v_rule.published_version, v_rule.trigger_type, v_idempotency_key, 'error', sqlerrm)
        on conflict (idempotency_key) do nothing;
      end;
    end loop;
  end loop;

  return v_count;
end;
$$;

revoke all on function public._run_automation_rules_internal(uuid, date) from public;

-- ── run_scheduled_lms_analytics_jobs() : 5th isolated step ──────────────
-- Full body from 20260813010000_assignment_due_reminders.sql, verbatim,
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
  end loop;
end;
$$;

revoke all on function public.run_scheduled_lms_analytics_jobs() from public;
