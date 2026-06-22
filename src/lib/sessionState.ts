import { isValid } from "date-fns";
import { supabase } from "./supabase";

export type SharedGameState =
  | "waiting"
  | "transition"
  | "question"
  | "answer-distribution"
  | "leaderboard"
  | "final";

export interface SharedPlayer {
  id: string;
  name: string;
  avatar: string;
  score: number;
  correctAnswers?: number;
  previousScore?: number;
  joinedAt: string;
  lastAnswer?: number;
  lastAnswerQuestionIndex?: number;
  lastHeartbeat?: string;
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
