import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from '../supabase';
import { createLiveSession, advanceLiveQuestion, submitAnswerToServer } from '../sessionState';

const invokeMock = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  invokeMock.mockReset();
});

describe('createLiveSession', () => {
  it('invokes create-session with game_code, title, questions and returns true on success', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });
    const ok = await createLiveSession('123456', 'My Quiz', [{ id: 'q1', type: 'multiple-choice' } as any]);
    expect(ok).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith('create-session', {
      body: { game_code: '123456', title: 'My Quiz', questions: [{ id: 'q1', type: 'multiple-choice' }] },
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
