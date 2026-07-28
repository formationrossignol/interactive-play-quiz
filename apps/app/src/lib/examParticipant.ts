// Shared between ExamRoom (sets it on identification) and ExamResults (reads
// it to prove attempt ownership to get-attempt-result) — a participant has
// no auth session, this sessionStorage id is their only identity.
const PART_KEY = 'exam_participant';

export interface Participant {
  id: string;
  name: string;
  email: string;
}

export function genParticipantId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getParticipant(): Participant | null {
  try { return JSON.parse(sessionStorage.getItem(PART_KEY) ?? 'null'); } catch { return null; }
}

export function setParticipant(p: Participant): void {
  sessionStorage.setItem(PART_KEY, JSON.stringify(p));
}
