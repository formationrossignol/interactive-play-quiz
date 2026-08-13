import { supabase } from '@/lib/supabase';

export interface RuleSet {
  id: string;
  org_id: string;
  target_type: string;
  target_id: string;
  status: 'draft' | 'published' | 'archived';
  published_version: number;
}

export interface AutomationRule {
  id: string;
  org_id: string;
  trigger_type: string;
  status: 'draft' | 'published' | 'archived';
  published_version: number;
}

export async function listOrgRuleSets(orgId: string): Promise<RuleSet[]> {
  const { data, error } = await supabase.from('rule_sets').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RuleSet[];
}

export async function createRuleSet(orgId: string, targetType: string, targetId: string): Promise<RuleSet> {
  const { data, error } = await supabase.from('rule_sets').insert({ org_id: orgId, target_type: targetType, target_id: targetId }).select().single();
  if (error) throw error;
  return data as RuleSet;
}

/** Atomic: validates depth + rejects cycles, then publishes an immutable version. */
export async function publishRuleSetVersion(ruleSetId: string, definition: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc('publish_rule_set_version', { p_rule_set_id: ruleSetId, p_definition: definition });
  if (error) throw error;
}

/** ADP-008/AUT-004: evaluates a definition (not necessarily published yet)
 *  against a specific learner — pedago/admin only, learner must belong to
 *  the org (see 20260813040000_rule_definition_simulation.sql). */
export async function simulateRuleDefinition(orgId: string, definition: Record<string, unknown>, learnerId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('simulate_rule_definition', { p_org_id: orgId, p_definition: definition, p_learner_id: learnerId });
  if (error) throw error;
  return data as boolean;
}

export async function listOrgAutomationRules(orgId: string): Promise<AutomationRule[]> {
  const { data, error } = await supabase.from('automation_rules').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AutomationRule[];
}

export async function createAutomationRule(orgId: string, triggerType: string): Promise<AutomationRule> {
  const { data, error } = await supabase.from('automation_rules').insert({ org_id: orgId, trigger_type: triggerType }).select().single();
  if (error) throw error;
  return data as AutomationRule;
}

export interface FollowUpTask {
  id: string;
  org_id: string;
  automation_rule_id: string | null;
  assignee_id: string;
  learner_id: string;
  title: string;
  status: 'open' | 'done' | 'dismissed';
  created_at: string;
}

/** RESTE-A-FAIRE §06: manual creation path (AUT-002's automation-fired
 *  path needs automation_rule_versions/an execution engine that doesn't
 *  exist yet — see 20260813050000_follow_up_tasks.sql). Staff turning a
 *  flagged learner (risk_signals) into an actionable task for someone. */
export async function createFollowUpTask(orgId: string, learnerId: string, assigneeId: string, title: string): Promise<FollowUpTask> {
  const { data, error } = await supabase.rpc('create_follow_up_task', {
    p_org_id: orgId, p_learner_id: learnerId, p_assignee_id: assigneeId, p_title: title,
  });
  if (error) throw error;
  return data as FollowUpTask;
}

/** RLS (follow_up_tasks_assignee) scopes this automatically: a trainer
 *  sees only tasks assigned to them, pedago/admin see every open task in
 *  the org regardless of assignee — no client-side assignee filter needed. */
export async function listOpenFollowUpTasks(orgId: string): Promise<FollowUpTask[]> {
  const { data, error } = await supabase
    .from('follow_up_tasks')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FollowUpTask[];
}

/** Direct update: follow_up_tasks_manage (RLS) already lets the assignee
 *  or org staff transition status — no RPC needed, same posture as
 *  competency_review_requests' resolve flow. */
export async function updateFollowUpTaskStatus(taskId: string, status: 'done' | 'dismissed'): Promise<void> {
  const { error } = await supabase.from('follow_up_tasks').update({ status }).eq('id', taskId);
  if (error) throw error;
}

/** The reason a specific activity is locked/unlocked for the current learner, if any. */
export async function myReleaseState(targetType: string, targetId: string): Promise<{ effect: string; reason: string | null } | null> {
  const { data, error } = await supabase
    .from('release_state')
    .select('effect, reason')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
