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
  supabase
    .from("session_state")
    .upsert({
      game_code: gameCode,
      players: state.players,
      game_state: state.gameState,
      current_question_index: state.currentQuestionIndex,
      time_left: state.timeLeft,
      updated_at: state.updatedAt,
    }, { onConflict: "game_code" })
    .then(() => {});
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

export const upsertPlayerInSession = (gameCode: string, player: SharedPlayer) => {
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

  patchSessionState(gameCode, { players });
  return players;
};

export const removePlayerFromSession = (gameCode: string, playerId: string) => {
  const current = readSessionState(gameCode);
  const players = current.players.filter((player) => player.id !== playerId);
  patchSessionState(gameCode, { players });
  return players;
};

export const clearSessionState = (gameCode: string) => {
  const key = getSessionKey(gameCode);
  localStorage.removeItem(key);
};

export const getSessionStorageKey = (gameCode: string) => getSessionKey(gameCode);

export const ensureSessionInSupabase = (gameCode: string) => {
  supabase
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
    )
    .then(() => {});
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
