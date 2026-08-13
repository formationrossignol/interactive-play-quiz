-- Spec 06 — Parcours adaptatifs, conditions et automatisations
-- (docs/product-specs/2026-08-10-lms-program/06-adaptive-automation.md).
--
-- RESTE-A-FAIRE.md §06: "Simulation « voir comme cet apprenant » / dry-run
-- avant publication (ADP-008, AUT-004)." evaluate_rule_definition() already
-- takes exactly (definition, learner_id) and returns a boolean — the
-- "engine" for this was never missing, only a client-callable entry point:
-- it has never been granted to `authenticated` (only called internally by
-- recompute_release_state()), and calling it directly would let anyone
-- probe an arbitrary learner_id's grades/competencies via a crafted score/
-- competency leaf with no org check at all. simulate_rule_definition()
-- wraps it: pedago/admin only (same STAFF_ROLES already gating
-- Automation.tsx), and requires the target learner_id to actually be a
-- member of the org before evaluating anything against them.
--
-- Takes the definition as a parameter rather than reading a rule_set's
-- published version — that's the "dry-run before publication" part: a
-- staff member editing an unpublished draft in ConditionNodeEditor can
-- test it against a specific learner before ever calling
-- publish_rule_set_version().
create or replace function public.simulate_rule_definition(p_org_id uuid, p_definition jsonb, p_learner_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_org_role(p_org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  if not exists (select 1 from public.user_org_roles where user_id = p_learner_id and org_id = p_org_id) then
    raise exception 'learner_not_in_org';
  end if;

  return public.evaluate_rule_definition(p_definition, p_learner_id);
end;
$$;

revoke all on function public.simulate_rule_definition(uuid, jsonb, uuid) from public;
grant execute on function public.simulate_rule_definition(uuid, jsonb, uuid) to authenticated;
