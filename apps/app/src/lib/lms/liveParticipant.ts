// A live event participant has no auth session in the general case
// (access_policy 'anonymous'/'pseudonym') — this sessionStorage identity is
// their only handle, same convention as lib/examParticipant.ts. Kept
// per-tab (sessionStorage, not localStorage) so a new tab is a fresh join.
const IDENTITY_KEY = 'lms_live_participant';
const VOTED_KEY_PREFIX = 'lms_live_voted_';

export interface LiveParticipantIdentity {
  clientId: string;
  displayName: string;
}

export function genLiveClientId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getLiveParticipantIdentity(): LiveParticipantIdentity | null {
  try {
    return JSON.parse(sessionStorage.getItem(IDENTITY_KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function setLiveParticipantIdentity(identity: LiveParticipantIdentity): void {
  sessionStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
}

/** Client-side only: cast_vote() is idempotent server-side regardless, this
 * just avoids a pointless round-trip and lets the vote button disable itself. */
export function getVotedQuestionIds(runId: string): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(VOTED_KEY_PREFIX + runId) ?? '[]'));
  } catch {
    return new Set();
  }
}

export function markQuestionVoted(runId: string, questionId: string): void {
  const ids = getVotedQuestionIds(runId);
  ids.add(questionId);
  sessionStorage.setItem(VOTED_KEY_PREFIX + runId, JSON.stringify([...ids]));
}
