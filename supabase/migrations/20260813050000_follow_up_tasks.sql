-- Spec 06 — Parcours adaptatifs, conditions et automatisations
-- (docs/product-specs/2026-08-10-lms-program/06-adaptive-automation.md).
--
-- RESTE-A-FAIRE.md §06: "follow_up_tasks — table posée, aucun écran ni
-- déclencheur." AUT-002 lists "création d'une tâche de suivi" as one of
-- six V1 automation actions — but automation_rule_versions (where an
-- action's config would live) has no writer anywhere, and
-- record_automation_run() has no caller anywhere either (confirmed by
-- grep): the action-execution engine itself is dormant, not just this one
-- action type. Wiring follow_up_tasks to a real trigger→action firing is
-- therefore a materially bigger scope than this item alone — not
-- attempted here.
--
-- What's genuinely scoped to "this table, this gap": follow_up_tasks has
-- no INSERT policy at all (only follow_up_tasks_manage, update-only), and
-- zero client references anywhere. The other half of AUT-002's own intent
-- — a staff member turning a flagged learner (risk_signals, spec 07) into
-- an actionable task for someone — is buildable today without the
-- automation engine: resolve_risk_signal() is explicitly "human-in-the-loop,
-- no automatic action follows a resolution" (analytics.ts's own comment);
-- this migration adds the manual creation path a human can use right next
-- to it, same posture as competency_review_requests' resolve flow (open/
-- resolved/dismissed queue, no RPC needed for the status transition itself
-- since follow_up_tasks_manage's RLS already allows the assignee or org
-- staff to update directly).
create or replace function public.create_follow_up_task(
  p_org_id uuid,
  p_learner_id uuid,
  p_assignee_id uuid,
  p_title text,
  p_automation_rule_id uuid default null
)
returns public.follow_up_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.follow_up_tasks;
begin
  if not public.has_org_role(p_org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  if p_title is null or char_length(trim(p_title)) = 0 then
    raise exception 'title_required';
  end if;
  if not exists (select 1 from public.user_org_roles where user_id = p_assignee_id and org_id = p_org_id) then
    raise exception 'assignee_not_in_org';
  end if;

  insert into public.follow_up_tasks (org_id, automation_rule_id, assignee_id, learner_id, title)
  values (p_org_id, p_automation_rule_id, p_assignee_id, p_learner_id, trim(p_title))
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.create_follow_up_task(uuid, uuid, uuid, text, uuid) from public;
grant execute on function public.create_follow_up_task(uuid, uuid, uuid, text, uuid) to authenticated;
