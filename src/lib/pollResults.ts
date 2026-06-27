export interface PollQuestionResult {
  questionIndex: number;
  question: string;
  type: string;
  answers?: string[];
  distribution: number[];
  totalResponses: number;
  textResponses?: string[];
}

export interface PollResultSession {
  sessionId: string;
  date: string;
  totalParticipants: number;
  questions: PollQuestionResult[];
}

export interface PollResultsStore {
  pollId: string;
  pollTitle: string;
  sessions: PollResultSession[];
}

const getKey = (pollId: string) => `poll-results-${pollId}`;

export const savePollSession = (pollId: string, pollTitle: string, session: PollResultSession) => {
  const key = getKey(pollId);
  const raw = localStorage.getItem(key);
  let store: PollResultsStore;
  try {
    store = raw ? (JSON.parse(raw) as PollResultsStore) : { pollId, pollTitle, sessions: [] };
  } catch {
    store = { pollId, pollTitle, sessions: [] };
  }

  const existingIdx = store.sessions.findIndex((s) => s.sessionId === session.sessionId);
  if (existingIdx >= 0) {
    store.sessions[existingIdx] = session;
  } else {
    store.sessions.unshift(session);
  }

  localStorage.setItem(key, JSON.stringify(store));
};

export const getPollResults = (pollId: string): PollResultsStore | null => {
  const raw = localStorage.getItem(getKey(pollId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PollResultsStore;
  } catch {
    return null;
  }
};

export const hasPollResults = (pollId: string): boolean => {
  const store = getPollResults(pollId);
  return !!store && store.sessions.length > 0;
};
