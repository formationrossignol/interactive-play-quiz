import { supabase } from '@/lib/supabase';

/** ANA-005 to ANA-009 read the sparse daily projections written by
 *  _run_daily_analytics_rollup_internal() (20260811010000_learning_analytics_aggregation.sql,
 *  item projection added by 20260812070000_analytics_daily_item.sql).
 *  RLS on all four tables grants select only to trainer/pedago/admin — there
 *  is no learner-scoped read policy, so a learner-facing dashboard (ANA-005)
 *  isn't buildable yet without a new migration; not attempted here. */

export interface DailyActivityRow {
  learner_id: string;
  day: string;
  events_count: number;
}

export interface DailyEnrollmentRow {
  session_id: string;
  day: string;
  started_count: number;
  completed_count: number;
  withdrawn_count: number;
  waitlisted_count: number;
}

export interface DailyCompetencyRow {
  competency_id: string;
  day: string;
  evidence_count: number;
  mastery_changed_count: number;
}

export async function listDailyActivity(orgId: string, sinceIsoDate: string): Promise<DailyActivityRow[]> {
  const { data, error } = await supabase
    .from('analytics_daily_activity')
    .select('learner_id, day, events_count')
    .eq('org_id', orgId)
    .gte('day', sinceIsoDate)
    .order('day', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DailyActivityRow[];
}

export async function listDailyEnrollment(orgId: string, sinceIsoDate: string): Promise<DailyEnrollmentRow[]> {
  const { data, error } = await supabase
    .from('analytics_daily_enrollment')
    .select('session_id, day, started_count, completed_count, withdrawn_count, waitlisted_count')
    .eq('org_id', orgId)
    .gte('day', sinceIsoDate)
    .order('day', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DailyEnrollmentRow[];
}

export async function listDailyCompetency(orgId: string, sinceIsoDate: string): Promise<DailyCompetencyRow[]> {
  const { data, error } = await supabase
    .from('analytics_daily_competency')
    .select('competency_id, day, evidence_count, mastery_changed_count')
    .eq('org_id', orgId)
    .gte('day', sinceIsoDate)
    .order('day', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DailyCompetencyRow[];
}

/** ANA-009 (partial — see analyticsDashboard.ts header and the migration
 *  comment: no median time, no distractor/difficulty analysis). */
export interface DailyItemRow {
  item_revision_id: string;
  day: string;
  responses_count: number;
  correct_count: number;
  omitted_count: number;
  avg_score_ratio: number | null;
}

export async function listDailyItem(orgId: string, sinceIsoDate: string): Promise<DailyItemRow[]> {
  const { data, error } = await supabase
    .from('analytics_daily_item')
    .select('item_revision_id, day, responses_count, correct_count, omitted_count, avg_score_ratio')
    .eq('org_id', orgId)
    .gte('day', sinceIsoDate)
    .order('day', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DailyItemRow[];
}
