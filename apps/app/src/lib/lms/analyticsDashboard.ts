import { supabase } from '@/lib/supabase';

/** ANA-005 to ANA-009 read the sparse daily projections written by
 *  _run_daily_analytics_rollup_internal() (20260811010000_learning_analytics_aggregation.sql,
 *  item projection added by 20260812070000_analytics_daily_item.sql).
 *  RLS on all four tables grants select only to trainer/pedago/admin — there
 *  is no learner-scoped read policy, so a learner-facing dashboard (ANA-005)
 *  isn't buildable yet without a new migration; not attempted here.
 *
 *  ANA-020: analytics_daily_enrollment/competency/item no longer allow direct
 *  row-level select (20260812170000_analytics_privacy_threshold.sql) — the
 *  raw rows are keyed by session_id/competency_id/item_revision_id, small
 *  enough on a quiet day to re-identify a specific learner. Reads go through
 *  security-definer RPCs that pre-aggregate to org+day totals and suppress
 *  the period entirely when the underlying population is below the org's
 *  configurable min_cohort_size. analytics_daily_activity is untouched: it's
 *  per-learner by construction, already-authorized direct pedagogical
 *  monitoring rather than a cohort comparison. */

export interface DailyActivityRow {
  learner_id: string;
  day: string;
  events_count: number;
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

export interface EnrollmentTotals {
  started_count: number | null;
  completed_count: number | null;
  withdrawn_count: number | null;
  waitlisted_count: number | null;
  suppressed: boolean;
}

export async function getEnrollmentTotals(orgId: string, sinceIsoDate: string): Promise<EnrollmentTotals> {
  const { data, error } = await supabase
    .rpc('get_org_enrollment_totals', { p_org_id: orgId, p_since: sinceIsoDate })
    .single();
  if (error) throw error;
  return data as EnrollmentTotals;
}

export interface DailyCompetencyRow {
  day: string;
  evidence_count: number;
}

export async function listDailyCompetency(orgId: string, sinceIsoDate: string): Promise<DailyCompetencyRow[]> {
  const { data, error } = await supabase.rpc('get_daily_competency_totals', { p_org_id: orgId, p_since: sinceIsoDate });
  if (error) throw error;
  return (data ?? []) as DailyCompetencyRow[];
}

/** ANA-009 (partial — see analyticsDashboard.ts header and the migration
 *  comment: no median time, no distractor/difficulty analysis). Not
 *  consumed by any screen yet (ANA-010/011/012 aren't built), kept
 *  threshold-safe ahead of that so whoever builds the psychometrics screens
 *  inherits suppression instead of having to add it. */
export interface DailyItemRow {
  day: string;
  responses_count: number;
  correct_count: number;
  omitted_count: number;
  avg_score_ratio: number | null;
}

export async function listDailyItem(orgId: string, sinceIsoDate: string): Promise<DailyItemRow[]> {
  const { data, error } = await supabase.rpc('get_daily_item_totals', { p_org_id: orgId, p_since: sinceIsoDate });
  if (error) throw error;
  return (data ?? []) as DailyItemRow[];
}

export async function getMinCohortSize(orgId: string): Promise<number> {
  const { data, error } = await supabase
    .from('analytics_privacy_settings')
    .select('min_cohort_size')
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) throw error;
  return data?.min_cohort_size ?? 5;
}

export async function setMinCohortSize(orgId: string, minCohortSize: number): Promise<void> {
  const { error } = await supabase.rpc('set_min_cohort_size', { p_org_id: orgId, p_min_cohort_size: minCohortSize });
  if (error) throw error;
}

export interface DailyProgramRow {
  day: string;
  active_learners: number;
  started_count: number;
  completed_count: number;
  withdrawn_count: number;
  waitlisted_count: number;
  suppressed: boolean;
}

export async function listDailyProgram(orgId: string, sinceIsoDate: string): Promise<DailyProgramRow[]> {
  const { data, error } = await supabase.rpc('get_daily_program_totals', { p_org_id: orgId, p_since: sinceIsoDate });
  if (error) throw error;
  return (data ?? []) as DailyProgramRow[];
}

export interface ItemPsychometricRow {
  item_revision_id: string;
  day: string;
  response_count: number;
  omitted_count: number;
  correct_rate: number | null;
  median_response_time_ms: number | null;
  difficulty: number | null;
  discrimination: number | null;
  option_counts: Record<string, number>;
  warning_codes: string[];
}

export async function listItemPsychometrics(orgId: string, sinceIsoDate: string): Promise<ItemPsychometricRow[]> {
  const { data, error } = await supabase.rpc('get_item_psychometrics', { p_org_id: orgId, p_since: sinceIsoDate });
  if (error) throw error;
  return (data ?? []) as ItemPsychometricRow[];
}

export interface LearnerAnalyticsRow {
  day: string;
  events_count: number;
  attempts_count: number;
  average_percentage: number | null;
}

export async function getMyLearningAnalytics(sinceIsoDate: string): Promise<LearnerAnalyticsRow[]> {
  const { data, error } = await supabase.rpc('get_my_learning_analytics', { p_since: sinceIsoDate });
  if (error) throw error;
  return (data ?? []) as LearnerAnalyticsRow[];
}
