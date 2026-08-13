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
  ended_at: string | null;
  capacity: number | null;
  locked: boolean;
}

export interface AudienceQuestion {
  id: string;
  run_id: string;
  author_display_name: string | null;
  body: string;
  status: 'pending' | 'approved' | 'live' | 'answered' | 'dismissed' | 'archived';
  votes_count: number;
  created_at: string;
  /** Assist only — matched blocked_terms, never hides/blocks the question
   *  itself. See 20260813060000_live_moderation_rate_limit_term_filter.sql. */
  flagged_terms: string[] | null;
}

export interface LiveModerationSettings {
  event_id: string;
  rate_limit_per_window: number;
  rate_limit_window_seconds: number;
  event_rate_limit_per_window: number;
  blocked_terms: string[];
  updated_at: string;
}

export interface LiveParticipantRow {
  id: string;
  run_id: string;
  client_id: string;
  display_name: string | null;
  status: 'active' | 'kicked';
}

/** Only 'poll' has a defined config/payload contract so far (see
 *  20260812090000_live_poll_interactions.sql) — 'priority'/'matrix'/
 *  'brainstorm'/'ranking' are accepted by the DB check constraint but have
 *  no editor/reader UI yet. */
export interface PollOption {
  id: string;
  label: string;
}

export interface PollConfig {
  question: string;
  options: PollOption[];
  allowMultiple: boolean;
}

export interface LiveInteraction {
  id: string;
  run_id: string;
  kind: 'poll' | 'priority' | 'matrix' | 'brainstorm' | 'ranking';
  config: PollConfig | Record<string, unknown>;
  status: 'draft' | 'live' | 'closed';
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface PollResponsePayload {
  optionIds: string[];
}

export async function listOrgLiveEvents(orgId: string): Promise<LiveEvent[]> {
  const { data, error } = await supabase.from('live_events').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LiveEvent[];
}

/** LIVE-002 "politique fixée avant ouverture": access_policy is set here,
 *  at creation (while the event is still 'draft', before activateLiveEvent),
 *  not editable afterward — no audited-change mechanism exists for it. */
export async function createLiveEvent(orgId: string, title: string, accessPolicy: LiveEvent['access_policy'] = 'anonymous'): Promise<LiveEvent> {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const { data, error } = await supabase.from('live_events').insert({ org_id: orgId, title, code, access_policy: accessPolicy }).select().single();
  if (error) throw error;
  return data as LiveEvent;
}

/** Only meaningful when the event's access_policy = 'allowlist' —
 *  live_run_allowlist_ok() (20260812140000) is the actual server-side gate;
 *  this is just the staff CRUD for the list it reads. */
export interface AllowlistEntry {
  id: string;
  event_id: string;
  email: string;
  created_at: string;
}

export async function listEventAllowlist(eventId: string): Promise<AllowlistEntry[]> {
  const { data, error } = await supabase.from('live_event_allowlist').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AllowlistEntry[];
}

export async function addAllowlistEmail(eventId: string, email: string): Promise<AllowlistEntry> {
  const { data, error } = await supabase.from('live_event_allowlist').insert({ event_id: eventId, email }).select().single();
  if (error) throw error;
  return data as AllowlistEntry;
}

export async function removeAllowlistEmail(entryId: string): Promise<void> {
  const { error } = await supabase.from('live_event_allowlist').delete().eq('id', entryId);
  if (error) throw error;
}

/** Sane defaults when no row exists yet — mirrors this table's own
 *  coalesce-to-default posture inside the RPCs that read it. */
const DEFAULT_MODERATION_SETTINGS = {
  rate_limit_per_window: 5,
  rate_limit_window_seconds: 60,
  event_rate_limit_per_window: 60,
  blocked_terms: [] as string[],
};

export async function getLiveModerationSettings(eventId: string): Promise<Omit<LiveModerationSettings, 'event_id' | 'updated_at'>> {
  const { data, error } = await supabase.from('live_event_moderation_settings').select('*').eq('event_id', eventId).maybeSingle();
  if (error) throw error;
  return data ?? DEFAULT_MODERATION_SETTINGS;
}

export async function setLiveModerationSettings(eventId: string, settings: Omit<LiveModerationSettings, 'event_id' | 'updated_at'>): Promise<void> {
  const { error } = await supabase.from('live_event_moderation_settings').upsert({ event_id: eventId, ...settings }, { onConflict: 'event_id' });
  if (error) throw error;
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

/** Public join-by-code lookup: any active event, any org — the code is the
 * gate (enforced by whoever has it), not org membership. */
export async function getLiveEventByCode(code: string): Promise<LiveEvent | null> {
  const { data, error } = await supabase.from('live_events').select('*').eq('code', code).eq('status', 'active').maybeSingle();
  if (error) throw error;
  return (data as LiveEvent | null) ?? null;
}

export async function getOpenRun(eventId: string): Promise<LiveRun | null> {
  const { data, error } = await supabase
    .from('live_runs').select('*').eq('event_id', eventId).eq('status', 'open')
    .order('started_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return (data as LiveRun | null) ?? null;
}

/** Idempotent by (run, client): a reconnect (page reload, new tab with the
 * same sessionStorage identity) calls this again and gets the same seat
 * back, never a duplicate participant row. Throws on capacity/lock/kick/
 * access_policy rejection — callers switch on the error message. */
export async function joinLiveRun(runId: string, clientId: string, displayName: string | null): Promise<LiveParticipantRow> {
  const { data, error } = await supabase.rpc('join_live_run', { p_run_id: runId, p_client_id: clientId, p_display_name: displayName });
  if (error) throw error;
  return data as LiveParticipantRow;
}

export async function listRunParticipants(runId: string): Promise<LiveParticipantRow[]> {
  const { data, error } = await supabase.from('live_participants').select('*').eq('run_id', runId).order('joined_at');
  if (error) throw error;
  return (data ?? []) as LiveParticipantRow[];
}

/** LIVE-020/021/023: post-session report. No new RPC — every table read
 *  here already has an `is_live_event_staff()`-gated select policy
 *  (live_participants_staff, audience_questions_staff, live_interactions_staff,
 *  live_responses_staff_read), so this composes plain reads client-side
 *  rather than adding a server-side aggregate nothing else needed.
 *
 *  LIVE-023 "distingue absence de réponse, perte de connexion et
 *  interaction non présentée" — per (participant, interaction) pair:
 *    - not_presented: the interaction never left 'draft' (nobody could
 *      have answered regardless of who was present).
 *    - answered: a live_responses row exists for that (interaction, client).
 *    - connection_lost: no response, and the participant's last_seen_at
 *      (refreshed only on join/rejoin, no continuous heartbeat exists in
 *      this schema) predates the interaction's opened_at — they had
 *      already gone quiet before this interaction even started, the best
 *      honest signal this data model supports.
 *    - no_response: present when it opened, still didn't answer. */
export interface SessionReportParticipant {
  client_id: string;
  display_name: string | null;
  joined_at: string;
  last_seen_at: string;
}

export interface InteractionBreakdown {
  interaction_id: string;
  kind: LiveInteraction['kind'];
  presented: boolean;
  answered_count: number;
  no_response_count: number;
  connection_lost_count: number;
}

export interface TimelineEntry {
  at: string;
  label: string;
}

export interface SessionReport {
  run: LiveRun;
  participants: SessionReportParticipant[];
  questionsCount: number;
  votesCount: number;
  interactions: LiveInteraction[];
  interactionBreakdown: InteractionBreakdown[];
  timeline: TimelineEntry[];
}

export async function getSessionReport(runId: string): Promise<SessionReport> {
  const [runRes, participants, questions, interactions] = await Promise.all([
    supabase.from('live_runs').select('*').eq('id', runId).single(),
    listRunParticipants(runId),
    listRunQuestions(runId),
    listRunInteractions(runId),
  ]);
  if (runRes.error) throw runRes.error;
  const run = runRes.data as LiveRun;

  const interactionIds = interactions.map((i) => i.id);
  let responses: Array<{ interaction_id: string; client_id: string }> = [];
  if (interactionIds.length > 0) {
    const { data, error } = await supabase.from('live_responses').select('interaction_id, client_id').in('interaction_id', interactionIds);
    if (error) throw error;
    responses = data ?? [];
  }

  const interactionBreakdown: InteractionBreakdown[] = interactions.map((interaction) => {
    const presented = interaction.status !== 'draft';
    if (!presented) {
      return { interaction_id: interaction.id, kind: interaction.kind, presented, answered_count: 0, no_response_count: 0, connection_lost_count: 0 };
    }
    const answeredClientIds = new Set(responses.filter((r) => r.interaction_id === interaction.id).map((r) => r.client_id));
    let noResponse = 0;
    let connectionLost = 0;
    for (const p of participants) {
      if (answeredClientIds.has(p.client_id)) continue;
      if (interaction.opened_at && p.last_seen_at < interaction.opened_at) connectionLost++;
      else noResponse++;
    }
    return { interaction_id: interaction.id, kind: interaction.kind, presented, answered_count: answeredClientIds.size, no_response_count: noResponse, connection_lost_count: connectionLost };
  });

  const timeline: TimelineEntry[] = [
    { at: run.started_at, label: 'Session démarrée' },
    ...participants.map((p) => ({ at: p.joined_at, label: `${p.display_name ?? 'Participant'} a rejoint` })),
    ...questions.map((q) => ({ at: q.created_at, label: `Question posée : « ${q.body.slice(0, 60)}${q.body.length > 60 ? '…' : ''} »` })),
    ...interactions.filter((i) => i.opened_at).map((i) => ({ at: i.opened_at as string, label: `Interaction ouverte (${i.kind})` })),
    ...interactions.filter((i) => i.closed_at).map((i) => ({ at: i.closed_at as string, label: `Interaction fermée (${i.kind})` })),
    ...(run.ended_at ? [{ at: run.ended_at, label: 'Session terminée' }] : []),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return {
    run,
    participants: participants.map((p) => ({ client_id: p.client_id, display_name: p.display_name, joined_at: p.joined_at, last_seen_at: p.last_seen_at })),
    questionsCount: questions.length,
    votesCount: questions.reduce((sum, q) => sum + q.votes_count, 0),
    interactions,
    interactionBreakdown,
    timeline,
  };
}

/** LIVE-021 "comparaison entre sessions d'un même événement" — one summary
 *  row per run, side by side. */
export interface EventRunSummary {
  run: LiveRun;
  participantsCount: number;
  questionsCount: number;
  votesCount: number;
  interactionsCount: number;
}

export async function listEventRunSummaries(eventId: string): Promise<EventRunSummary[]> {
  const { data: runs, error } = await supabase.from('live_runs').select('*').eq('event_id', eventId).order('started_at', { ascending: false });
  if (error) throw error;
  const summaries: EventRunSummary[] = [];
  for (const run of (runs ?? []) as LiveRun[]) {
    const [participants, questions, interactions] = await Promise.all([
      listRunParticipants(run.id),
      listRunQuestions(run.id),
      listRunInteractions(run.id),
    ]);
    summaries.push({
      run,
      participantsCount: participants.length,
      questionsCount: questions.length,
      votesCount: questions.reduce((sum, q) => sum + q.votes_count, 0),
      interactionsCount: interactions.length,
    });
  }
  return summaries;
}

export async function setRunLocked(runId: string, locked: boolean): Promise<void> {
  const { error } = await supabase.rpc('lock_live_run', { p_run_id: runId, p_locked: locked });
  if (error) throw error;
}

export async function kickParticipant(participantId: string): Promise<void> {
  const { error } = await supabase.rpc('kick_participant', { p_participant_id: participantId });
  if (error) throw error;
}

/** Staff-only: RLS (`live_interactions_staff`, `for all`) already allows a
 *  direct insert — no RPC needed for creation, same posture as rubric
 *  criteria (gradebook.ts::addRubricCriterion). Always created 'draft'. */
export async function createPollInteraction(runId: string, config: PollConfig): Promise<LiveInteraction> {
  const { data, error } = await supabase
    .from('live_interactions')
    .insert({ run_id: runId, kind: 'poll', config })
    .select()
    .single();
  if (error) throw error;
  return data as LiveInteraction;
}

export interface PublicInteractionResult {
  option_id: string;
  votes_count: number;
  respondents: number;
}

/** Aggregate only — live_responses itself is staff-only
 *  (live_responses_staff_read), a public presenter screen never sees who
 *  answered what. See 20260813090000_live_presenter_poll_results.sql. */
export async function getPublicLiveInteractionResults(interactionId: string): Promise<PublicInteractionResult[]> {
  const { data, error } = await supabase.rpc('get_public_live_interaction_results', { p_interaction_id: interactionId });
  if (error) throw error;
  return (data ?? []) as PublicInteractionResult[];
}

export async function listRunInteractions(runId: string): Promise<LiveInteraction[]> {
  const { data, error } = await supabase
    .from('live_interactions')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as LiveInteraction[];
}

/** Opening auto-closes any other interaction currently live on the same run
 *  — only one can be "the current one" a participant screen shows at a time. */
export async function openLiveInteraction(interactionId: string): Promise<LiveInteraction> {
  const { data, error } = await supabase.rpc('open_live_interaction', { p_interaction_id: interactionId });
  if (error) throw error;
  return data as LiveInteraction;
}

export async function closeLiveInteraction(interactionId: string): Promise<LiveInteraction> {
  const { data, error } = await supabase.rpc('close_live_interaction', { p_interaction_id: interactionId });
  if (error) throw error;
  return data as LiveInteraction;
}

/** Staff-only read (`live_responses_staff_read`) — used for live tallies. */
export async function listInteractionResponses(interactionId: string): Promise<Array<{ client_id: string; payload: PollResponsePayload }>> {
  const { data, error } = await supabase
    .from('live_responses')
    .select('client_id, payload')
    .eq('interaction_id', interactionId);
  if (error) throw error;
  return (data ?? []) as Array<{ client_id: string; payload: PollResponsePayload }>;
}

/** Participant-facing: anon-capable, idempotent upsert by (interaction, client). */
export async function submitLiveResponse(interactionId: string, clientId: string, payload: PollResponsePayload): Promise<void> {
  const { error } = await supabase.rpc('submit_live_response', { p_interaction_id: interactionId, p_client_id: clientId, p_payload: payload });
  if (error) throw error;
}

/** Restores the participant's own answer on reconnect — `live_responses` has
 *  no participant SELECT policy (client_id isn't an auth identity RLS can
 *  key on), so this RPC is the only read path for "what did I already answer". */
export async function getMyLiveResponse(interactionId: string, clientId: string): Promise<PollResponsePayload | null> {
  const { data, error } = await supabase.rpc('get_my_live_response', { p_interaction_id: interactionId, p_client_id: clientId });
  if (error) throw error;
  return (data as PollResponsePayload | null) ?? null;
}
