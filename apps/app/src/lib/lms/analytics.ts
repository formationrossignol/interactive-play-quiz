import { supabase } from '@/lib/supabase';

export interface RiskSignal {
  id: string;
  org_id: string;
  learner_id: string;
  rule_code: 'inactivity' | 'overdue' | 'repeated_failure' | 'progress_drop' | 'blocking_prereq';
  factors: Record<string, unknown>;
  window_start: string;
  window_end: string;
  status: 'open' | 'acknowledged' | 'resolved';
  created_at: string;
}

export interface SavedReport {
  id: string;
  org_id: string;
  owner_id: string;
  title: string;
  filters: Record<string, unknown>;
  columns: string[];
  audience: 'self' | 'org';
  created_at: string;
}

export async function listOrgRiskSignals(orgId: string): Promise<RiskSignal[]> {
  const { data, error } = await supabase.from('risk_signals').select('*').eq('org_id', orgId).eq('status', 'open').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RiskSignal[];
}

/** Audited, human-in-the-loop: no automatic action follows a resolution. */
export async function resolveRiskSignal(signalId: string, resolution: string): Promise<void> {
  const { error } = await supabase.rpc('resolve_risk_signal', { p_signal_id: signalId, p_resolution: resolution });
  if (error) throw error;
}

/** Sends the learner an in-app notification without resolving the signal —
 *  a human-triggered nudge, never an automatic action (20260813180000). */
export async function relaunchRiskSignal(signalId: string, message: string): Promise<void> {
  const { error } = await supabase.rpc('relaunch_risk_signal', { p_signal_id: signalId, p_message: message });
  if (error) throw error;
}

export async function listMySavedReports(orgId: string): Promise<SavedReport[]> {
  const { data, error } = await supabase.from('saved_reports').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedReport[];
}

export async function createSavedReport(orgId: string, title: string, columns: string[], audience: 'self' | 'org' = 'self'): Promise<SavedReport> {
  const { data, error } = await supabase.from('saved_reports').insert({ org_id: orgId, title, columns, audience }).select().single();
  if (error) throw error;
  return data as SavedReport;
}

export interface ReportSchedule {
  id: string;
  report_id: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  next_run_at: string | null;
  created_at: string;
}

/** report_schedules is what _run_due_analytics_reports_internal() (the
 *  nightly executor, 20260813170000) actually reads — a saved report with
 *  no schedule row never runs. schedule_saved_report() (20260813180000)
 *  existed with no caller until this. */
export async function scheduleSavedReport(reportId: string, frequency: ReportSchedule['frequency'], recipients: string[] = []): Promise<ReportSchedule> {
  const { data, error } = await supabase.rpc('schedule_saved_report', { p_report_id: reportId, p_frequency: frequency, p_recipients: recipients });
  if (error) throw error;
  return data as ReportSchedule;
}

export async function listReportSchedules(reportId: string): Promise<ReportSchedule[]> {
  const { data, error } = await supabase.from('report_schedules').select('*').eq('report_id', reportId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReportSchedule[];
}
