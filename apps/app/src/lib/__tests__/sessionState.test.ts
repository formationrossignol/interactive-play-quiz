import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    rpc: vi.fn(),
  },
}));

import { supabase } from '../supabase';
import {
  createLiveSession,
  advanceLiveQuestion,
  submitAnswerToServer,
  upsertPlayerInSession,
} from '../sessionState';

const invokeMock = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;
const rpcMock = supabase.rpc as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  invokeMock.mockReset();
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: null, error: null });
  localStorage.clear();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('player write debounce', () => {
  const player = (id: string, lastHeartbeat = '2026-08-21T10:00:00.000Z') => ({
    id,
    name: id,
    avatar: '🎮',
    score: 0,
    joinedAt: '2026-08-21T09:00:00.000Z',
    lastHeartbeat,
  });

  it('flushes pending heartbeats independently for different players in one game', async () => {
    upsertPlayerInSession('123456', player('player-1'));
    upsertPlayerInSession('123456', player('player-2'));
    await vi.advanceTimersByTimeAsync(800);

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock).toHaveBeenCalledWith('upsert_session_player', {
      p_game_code: '123456',
      p_player: expect.objectContaining({ id: 'player-1' }),
    });
    expect(rpcMock).toHaveBeenCalledWith('upsert_session_player', {
      p_game_code: '123456',
      p_player: expect.objectContaining({ id: 'player-2' }),
    });
  });

  it('still collapses multiple pending heartbeats for the same player', async () => {
    upsertPlayerInSession('123456', player('player-1'));
    upsertPlayerInSession('123456', player('player-1', '2026-08-21T10:00:05.000Z'));
    await vi.advanceTimersByTimeAsync(800);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('upsert_session_player', {
      p_game_code: '123456',
      p_player: expect.objectContaining({
        id: 'player-1',
        lastHeartbeat: '2026-08-21T10:00:05.000Z',
      }),
    });
  });
});

describe('createLiveSession', () => {
  it('invokes create-session with game_code, title, questions and returns true on success', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });
    const ok = await createLiveSession('123456', 'My Quiz', [{ id: 'q1', type: 'multiple-choice' }]);
    expect(ok).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith('create-session', {
      body: {
        game_code: '123456',
        title: 'My Quiz',
        questions: [{ id: 'q1', type: 'multiple-choice' }],
        ambiance_id: 'arcade',
        max_participants: null,
        live_reactions_enabled: true,
        end_chat_enabled: true,
      },
    });
  });

  it('forwards disabled live interaction settings', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });
    await createLiveSession('123456', 'My Quiz', [], 'calm', 20, false, false);
    expect(invokeMock).toHaveBeenCalledWith('create-session', {
      body: {
        game_code: '123456',
        title: 'My Quiz',
        questions: [],
        ambiance_id: 'calm',
        max_participants: 20,
        live_reactions_enabled: false,
        end_chat_enabled: false,
      },
    });
  });

  it('returns false when the function call errors', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('boom') });
    const ok = await createLiveSession('123456', 'My Quiz', []);
    expect(ok).toBe(false);
  });
});

describe('advanceLiveQuestion', () => {
  it('invokes advance-question with the expected payload', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true, question_started_at: '2026-01-01T00:00:00.000Z' }, error: null });
    const result = await advanceLiveQuestion('123456', 2, 'question', 30);
    expect(result).toEqual({ ok: true, questionStartedAt: '2026-01-01T00:00:00.000Z' });
    expect(invokeMock).toHaveBeenCalledWith('advance-question', {
      body: { game_code: '123456', question_index: 2, game_state: 'question', time_left: 30 },
    });
  });

  it('returns ok:false when the function call errors', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('boom') });
    const result = await advanceLiveQuestion('123456', 2, 'question', 30);
    expect(result).toEqual({ ok: false, questionStartedAt: null });
  });
});

describe('submitAnswerToServer', () => {
  it('invokes submit-answer and returns the full parsed result on success', async () => {
    // submit-answer's actual response shape (Task 5, after review fixes)
    // covers all 7 question types' answer-key fields, not just correctAnswer.
    invokeMock.mockResolvedValue({
      data: {
        correct: true,
        earnedPoints: 80,
        correctAnswer: 2,
        correctValue: null,
        correctOrder: null,
        correctMatches: null,
        blanks: null,
      },
      error: null,
    });
    const result = await submitAnswerToServer('123456', 'player-1', 0, 2);
    expect(result).toEqual({
      ok: true,
      correct: true,
      earnedPoints: 80,
      correctAnswer: 2,
      correctValue: null,
      correctOrder: null,
      correctMatches: null,
      blanks: null,
    });
    expect(invokeMock).toHaveBeenCalledWith('submit-answer', {
      body: { game_code: '123456', player_id: 'player-1', question_index: 0, answer: 2 },
    });
  });

  it('returns ok:false with all answer-key fields null when the function call errors', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('network') });
    const result = await submitAnswerToServer('123456', 'player-1', 0, 2);
    expect(result).toEqual({
      ok: false,
      correct: false,
      earnedPoints: 0,
      correctAnswer: null,
      correctValue: null,
      correctOrder: null,
      correctMatches: null,
      blanks: null,
    });
  });
});
