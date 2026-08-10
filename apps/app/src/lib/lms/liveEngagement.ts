import { supabase } from '@/lib/supabase';

export interface LiveEvent {
  id: string;
  org_id: string;
  owner_id: string;
  title: string;
  code: string;
  access_policy: 'anonymous' | 'pseudonym' | 'authenticated' | 'allowlist';
  status: 'draft' | 'active' | 'closed';
  created_at: string;
}

export interface LiveRun {
  id: string;
  event_id: string;
  status: 'open' | 'closed';
  started_at: string;
}

export interface AudienceQuestion {
  id: string;
  run_id: string;
  author_display_name: string | null;
  body: string;
  status: 'pending' | 'approved' | 'live' | 'answered' | 'dismissed' | 'archived';
  votes_count: number;
  created_at: string;
}

export async function listOrgLiveEvents(orgId: string): Promise<LiveEvent[]> {
  const { data, error } = await supabase.from('live_events').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LiveEvent[];
}

export async function createLiveEvent(orgId: string, title: string): Promise<LiveEvent> {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const { data, error } = await supabase.from('live_events').insert({ org_id: orgId, title, code }).select().single();
  if (error) throw error;
  return data as LiveEvent;
}

export async function activateLiveEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('live_events').update({ status: 'active' }).eq('id', eventId);
  if (error) throw error;
}

/** Reusing an event never overwrites history — always a new run (LIVE-003). */
export async function createLiveRun(eventId: string): Promise<LiveRun> {
  const { data, error } = await supabase.rpc('create_live_run', { p_event_id: eventId });
  if (error) throw error;
  return data as LiveRun;
}

export async function listLatestRun(eventId: string): Promise<LiveRun | null> {
  const { data, error } = await supabase.from('live_runs').select('*').eq('event_id', eventId).order('started_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return (data as LiveRun | null) ?? null;
}

export async function listRunQuestions(runId: string): Promise<AudienceQuestion[]> {
  const { data, error } = await supabase.from('audience_questions').select('*').eq('run_id', runId).order('votes_count', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AudienceQuestion[];
}

export async function submitAudienceQuestion(runId: string, clientId: string, displayName: string, body: string): Promise<AudienceQuestion> {
  const { data, error } = await supabase.rpc('submit_audience_question', {
    p_run_id: runId, p_client_id: clientId, p_display_name: displayName, p_body: body,
  });
  if (error) throw error;
  return data as AudienceQuestion;
}

export async function moderateQuestion(questionId: string, action: 'approved' | 'dismissed' | 'marked_answered' | 'featured'): Promise<void> {
  const { error } = await supabase.rpc('moderate_question', { p_question_id: questionId, p_action: action });
  if (error) throw error;
}

/** Idempotent by (question, client) — replaying a vote never double-counts. */
export async function castVote(questionId: string, clientId: string): Promise<number> {
  const { data, error } = await supabase.rpc('cast_vote', { p_question_id: questionId, p_client_id: clientId });
  if (error) throw error;
  return data as number;
}
