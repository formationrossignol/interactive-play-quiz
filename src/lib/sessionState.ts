import { isValid } from "date-fns";
import { supabase } from "./supabase";

export type SharedGameState =
  | "waiting"
  | "countdown"
  | "transition"
  | "question-intro"
  | "question"
  | "answer-distribution"
  | "leaderboard"
  | "final"
  | "abandoned";

export interface SharedPlayer {
  id: string;
  name: string;
  avatar: string;
  score: number;
  correctAnswers?: number;
  previousScore?: number;
  joinedAt: string;
  lastAnswer?: number;
  lastAnswerText?: string;
  lastAnswerQuestionIndex?: number;
  lastAnswerCorrect?: boolean;
  lastEarnedPoints?: number;
  lastHeartbeat?: string;
  lastReaction?: { emoji: string; comment?: string; sentAt: string };
}

export interface SharedSessionState {
  players: SharedPlayer[];
  gameState: SharedGameState;
  currentQuestionIndex: number;
  timeLeft: number;
  updatedAt: string;
}

const DEFAULT_SESSION_STATE: SharedSessionState = {
  players: [],
  gameState: "waiting",
  currentQuestionIndex: 0,
  timeLeft: 0,
  updatedAt: new Date().toISOString(),
};

const getSessionKey = (gameCode: string) => `quiz-session-state-${gameCode}`;

export const ensureSessionState = (gameCode: string) => {
  const key = getSessionKey(gameCode);
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, JSON.stringify(DEFAULT_SESSION_STATE));
  }
};

export const readSessionState = (gameCode: string): SharedSessionState => {
  const key = getSessionKey(gameCode);
  const raw = localStorage.getItem(key);
  if (!raw) {
    return { ...DEFAULT_SESSION_STATE };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SharedSessionState>;
    return {
      players: Array.isArray(parsed.players) ? parsed.players : [],
      gameState: (parsed.gameState as SharedGameState) ?? "waiting",
      currentQuestionIndex: typeof parsed.currentQuestionIndex === "number" ? parsed.currentQuestionIndex : 0,
      timeLeft: typeof parsed.timeLeft === "number" ? parsed.timeLeft : 0,
      updatedAt: parsed.updatedAt && typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to parse session state", error);
    return { ...DEFAULT_SESSION_STATE };
  }
};

export const writeSessionState = (gameCode: string, state: SharedSessionState) => {
  const key = getSessionKey(gameCode);
  localStorage.setItem(key, JSON.stringify({
    ...state,
    updatedAt: new Date().toISOString(),
  }));
};

const pushStateToSupabase = (gameCode: string, state: SharedSessionState) => {
  // Never write players here — players manage their own entries via upsert_session_player RPC.
  // Writing players from the host's local state would overwrite concurrent player answers.
  supabase
    .from("session_state")
    .update({
      game_state: state.gameState,
      current_question_index: state.currentQuestionIndex,
      time_left: state.timeLeft,
      updated_at: state.updatedAt,
    })
    .eq("game_code", gameCode)
    .then(({ error }) => {
      if (error) console.error("[Supabase write error]", gameCode, state.gameState, error);
    });
};

// Players-only update: does NOT touch game_state/currentQuestionIndex/timeLeft.
// Used by player devices so they never overwrite host-controlled fields.
//
// Non-urgent writes are debounced per gameCode so rapid heartbeats (30 players × 1/5s)
// collapse into a single Supabase call instead of hammering the write API.
// Urgent writes (answer submissions) bypass the debounce and flush immediately.

const pendingPlayerWrites = new Map<string, ReturnType<typeof setTimeout>>();
const PLAYER_WRITE_DEBOUNCE_MS = 800;

const flushPlayerToSupabase = (gameCode: string, player: SharedPlayer) => {
  const isAnswer = player.lastAnswerQuestionIndex !== undefined;
  supabase
    .rpc("upsert_session_player", {
      p_game_code: gameCode,
      p_player: player as unknown as Record<string, unknown>,
    })
    .then(({ error }) => {
      if (error) {
        console.error("[Supabase player upsert error]", gameCode, error);
        if (isAnswer) {
          console.warn("[Answer write FAILED] player:", player.id, "q:", player.lastAnswerQuestionIndex);
        }
      }
    });
};

const pushSinglePlayerToSupabase = (gameCode: string, player: SharedPlayer, urgent = false) => {
  const pending = pendingPlayerWrites.get(gameCode);
  if (pending) clearTimeout(pending);
  pendingPlayerWrites.delete(gameCode);

  if (urgent) {
    flushPlayerToSupabase(gameCode, player);
    return;
  }

  const timer = setTimeout(() => {
    pendingPlayerWrites.delete(gameCode);
    flushPlayerToSupabase(gameCode, player);
  }, PLAYER_WRITE_DEBOUNCE_MS);
  pendingPlayerWrites.set(gameCode, timer);
};

export const patchSessionState = (
  gameCode: string,
  patch: Partial<Omit<SharedSessionState, "players">> & { players?: SharedPlayer[] }
) => {
  const current = readSessionState(gameCode);
  const next: SharedSessionState = {
    ...current,
    ...patch,
    players: patch.players ?? current.players,
    updatedAt: new Date().toISOString(),
  };
  writeSessionState(gameCode, next);
  pushStateToSupabase(gameCode, next);
  return next;
};

export const upsertPlayerInSession = (gameCode: string, player: SharedPlayer, urgent = false) => {
  const current = readSessionState(gameCode);
  const players = [...current.players];
  const index = players.findIndex((existing) => existing.id === player.id);

  const normalizedPlayer: SharedPlayer = {
    ...player,
    score: typeof player.score === "number" ? player.score : 0,
    correctAnswers: typeof player.correctAnswers === "number" ? player.correctAnswers : 0,
    joinedAt:
      player.joinedAt && isValid(new Date(player.joinedAt))
        ? new Date(player.joinedAt).toISOString()
        : new Date().toISOString(),
  };

  if (index >= 0) {
    players[index] = { ...players[index], ...normalizedPlayer };
  } else {
    players.push(normalizedPlayer);
  }

  // Only update players in localStorage (preserve local game state as-is)
  const next: SharedSessionState = { ...current, players, updatedAt: new Date().toISOString() };
  writeSessionState(gameCode, next);
  // Atomic RPC: upserts only this player, never overwrites others
  pushSinglePlayerToSupabase(gameCode, normalizedPlayer, urgent);
  return players;
};

export const removePlayerFromSession = (gameCode: string, playerId: string) => {
  const current = readSessionState(gameCode);
  const players = current.players.filter((player) => player.id !== playerId);
  const next: SharedSessionState = { ...current, players, updatedAt: new Date().toISOString() };
  writeSessionState(gameCode, next);
  supabase
    .rpc("remove_session_player", { p_game_code: gameCode, p_player_id: playerId })
    .then(({ error }) => {
      if (error) console.error("[Supabase player remove error]", gameCode, error);
    });
  return players;
};

export const clearSessionState = (gameCode: string) => {
  const key = getSessionKey(gameCode);
  localStorage.removeItem(key);
};

export const getSessionStorageKey = (gameCode: string) => getSessionKey(gameCode);

// --- Session history (past runs, stored in localStorage only) ---

export interface SessionRun {
  id: string;
  date: string;
  questionCount: number;
  players: Array<{
    id: string;
    name: string;
    avatar: string;
    score: number;
    correctAnswers: number;
  }>;
}

const getHistoryKey = (gameCode: string) => `quiz-session-history-${gameCode}`;
const MAX_HISTORY = 5;

export const readSessionHistory = (gameCode: string): SessionRun[] => {
  try {
    const raw = localStorage.getItem(getHistoryKey(gameCode));
    if (!raw) return [];
    return JSON.parse(raw) as SessionRun[];
  } catch {
    return [];
  }
};

export const appendSessionHistory = (gameCode: string, players: SharedPlayer[], questionCount: number) => {
  const history = readSessionHistory(gameCode);
  const run: SessionRun = {
    id: new Date().toISOString(),
    date: new Date().toISOString(),
    questionCount,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      correctAnswers: p.correctAnswers ?? 0,
    })),
  };
  const next = [run, ...history].slice(0, MAX_HISTORY);
  localStorage.setItem(getHistoryKey(gameCode), JSON.stringify(next));
};

export const resetSessionForNewRun = async (gameCode: string, quizData?: object): Promise<boolean> => {
  const resetState: SharedSessionState = {
    ...DEFAULT_SESSION_STATE,
    updatedAt: new Date().toISOString(),
  };
  writeSessionState(gameCode, resetState);

  const { error } = await supabase
    .from("session_state")
    .upsert(
      {
        game_code: gameCode,
        players: [],
        game_state: "waiting",
        current_question_index: 0,
        time_left: 0,
        updated_at: resetState.updatedAt,
        ...(quizData ? { quiz_data: quizData } : {}),
      },
      { onConflict: "game_code" }
    );

  if (error) {
    console.error("[resetSessionForNewRun error]", error.code, error.message);
    return false;
  }
  return true;
};

export const ensureSessionInSupabase = async (gameCode: string, quizData?: object): Promise<boolean> => {
  // Create row only if it doesn't exist (ignoreDuplicates prevents resetting active sessions)
  const { error: upsertError } = await supabase
    .from("session_state")
    .upsert(
      {
        game_code: gameCode,
        players: [],
        game_state: "waiting",
        current_question_index: 0,
        time_left: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "game_code", ignoreDuplicates: true }
    );

  if (upsertError) {
    console.error("[Supabase ensureSession error]", upsertError.code, upsertError.message, upsertError.details);
    throw new Error(`${upsertError.code}: ${upsertError.message}`);
  }

  // Always overwrite quiz_data so players get fresh questions
  if (quizData) {
    const { error: updateError } = await supabase
      .from("session_state")
      .update({ quiz_data: quizData })
      .eq("game_code", gameCode);

    if (updateError) {
      console.error("[Supabase quiz_data write error]", updateError.code, updateError.message);
      throw new Error(`quiz_data: ${updateError.code}: ${updateError.message}`);
    }
  }

  return true;
};

export const fetchSessionStateFromSupabase = async (gameCode: string): Promise<SharedSessionState | null> => {
  const { data } = await supabase
    .from("session_state")
    .select("*")
    .eq("game_code", gameCode)
    .single();

  if (!data) return null;

  return {
    players: Array.isArray(data.players) ? (data.players as SharedPlayer[]) : [],
    gameState: (data.game_state as SharedGameState) ?? "waiting",
    currentQuestionIndex: typeof data.current_question_index === "number" ? data.current_question_index : 0,
    timeLeft: typeof data.time_left === "number" ? data.time_left : 0,
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : new Date().toISOString(),
  };
};

export const subscribeToSessionState = (
  gameCode: string,
  callback: (state: SharedSessionState) => void
) => {
  const channel = supabase
    .channel(`session-${gameCode}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "session_state",
        filter: `game_code=eq.${gameCode}`,
      },
      (payload) => {
        if (!payload.new || typeof payload.new !== "object") return;
        const row = payload.new as Record<string, unknown>;
        const state: SharedSessionState = {
          players: Array.isArray(row.players) ? (row.players as SharedPlayer[]) : [],
          gameState: (row.game_state as SharedGameState) ?? "waiting",
          currentQuestionIndex: typeof row.current_question_index === "number" ? row.current_question_index : 0,
          timeLeft: typeof row.time_left === "number" ? row.time_left : 0,
          updatedAt: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
        };
        writeSessionState(gameCode, state);
        callback(state);
      }
    )
    .subscribe();

  return channel;
};

// --- Server-side scoring (Edge Functions) ---
// These replace direct writes to session_state/session_quiz_answers from the
// browser for anything answer-related — the client never holds an answer key
// or computes its own score (audit findings C-1/H-6).

/** supabase-js's FunctionsHttpError.message is a hardcoded generic string
 *  ("Edge Function returned a non-2xx status code") for every non-2xx
 *  response — the actual per-endpoint reason (404/409/500, each meaningfully
 *  different across submit-answer/create-session/advance-question) only
 *  lives in error.context (the raw Response). Surface the HTTP status at
 *  minimum so logs can distinguish "not found" from "not currently active"
 *  from "server error" instead of all looking identical. */
async function describeFunctionsError(error: unknown): Promise<string> {
  const context = (error as { context?: Response }).context;
  if (!(context instanceof Response)) return String(error);
  try {
    const body = await context.clone().json();
    return `HTTP ${context.status}: ${body?.error ?? JSON.stringify(body)}`;
  } catch {
    return `HTTP ${context.status}`;
  }
}

export const createLiveSession = async (
  gameCode: string,
  title: string,
  // Forwarded verbatim to the create-session edge function as JSON; the quiz's
  // own question shape (QuizSession.QuizQuestion) is broader than the question-
  // bank Question type, so keep this structurally loose to avoid a false mismatch.
  questions: unknown[],
  ambianceId?: string
): Promise<boolean> => {
  const { error } = await supabase.functions.invoke("create-session", {
    body: { game_code: gameCode, title, questions, ambiance_id: ambianceId ?? "arcade" },
  });
  if (error) console.error("[createLiveSession error]", gameCode, await describeFunctionsError(error));
  return !error;
};

export const advanceLiveQuestion = async (
  gameCode: string,
  questionIndex: number,
  gameState: SharedGameState,
  timeLeft: number
): Promise<{ ok: boolean; questionStartedAt: string | null }> => {
  const { data, error } = await supabase.functions.invoke("advance-question", {
    body: { game_code: gameCode, question_index: questionIndex, game_state: gameState, time_left: timeLeft },
  });
  if (error) {
    console.error("[advanceLiveQuestion error]", gameCode, await describeFunctionsError(error));
    return { ok: false, questionStartedAt: null };
  }
  return { ok: true, questionStartedAt: (data as { question_started_at: string | null }).question_started_at };
};

// Mirrors submit-answer's response shape (Task 5) — correctAnswer/correctValue/
// correctOrder/correctMatches/blanks together cover all 7 question types'
// answer-key shapes; only the field matching the answered question's type is
// non-null in any given response.
export interface SubmitAnswerResult {
  ok: boolean;
  correct: boolean;
  earnedPoints: number;
  correctAnswer: unknown;
  correctValue: unknown;
  correctOrder: number[] | null;
  correctMatches: { leftId: string; rightId: string }[] | null;
  blanks: unknown;
}

const EMPTY_ANSWER_KEY = {
  correctAnswer: null,
  correctValue: null,
  correctOrder: null,
  correctMatches: null,
  blanks: null,
} as const;

export const submitAnswerToServer = async (
  gameCode: string,
  playerId: string,
  questionIndex: number,
  answer: number | string | null
): Promise<SubmitAnswerResult> => {
  const { data, error } = await supabase.functions.invoke("submit-answer", {
    body: { game_code: gameCode, player_id: playerId, question_index: questionIndex, answer },
  });
  if (error) {
    console.error("[submitAnswerToServer error]", gameCode, await describeFunctionsError(error));
    return { ok: false, correct: false, earnedPoints: 0, ...EMPTY_ANSWER_KEY };
  }
  const result = data as {
    correct: boolean;
    earnedPoints: number;
    correctAnswer: unknown;
    correctValue: unknown;
    correctOrder: number[] | null;
    correctMatches: { leftId: string; rightId: string }[] | null;
    blanks: unknown;
  };
  return { ok: true, ...result };
};
