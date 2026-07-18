import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentUser } from '../auth';
import { saveQuiz, duplicateQuiz, getSavedQuizzes, QUIZ_STORAGE_KEY, type SavedQuiz } from '../quizStorage';
import { PlanLimitError } from '../plans';

vi.mock('../auth', () => ({ getCurrentUser: vi.fn() }));

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.get(k) ?? null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

const USER_ID = 'user-1';

const baseQuiz = (overrides: Partial<SavedQuiz> = {}): Omit<SavedQuiz, 'id' | 'createdAt' | 'userId'> => ({
  title: 'Q', description: '', questions: [{ id: 'q1' }], isPublic: false, isFavorite: false,
  tags: [], speedBonus: true, transitionTime: 5, category: 'Autre', type: 'quiz',
  ...overrides,
});

// IDs must be 6-digit strings — getSavedQuizzes() silently migrates any
// non-6-digit id to a random 6-digit code on first read, which would
// otherwise invalidate the ids seeded here before a test can reference them.
const seedQuizzes = (n: number, type: SavedQuiz['type'] = 'quiz') => {
  const quizzes: SavedQuiz[] = Array.from({ length: n }, (_, i) => ({
    ...baseQuiz({ type }),
    id: `10000${i}`,
    createdAt: '2026-01-01T00:00:00Z',
    userId: USER_ID,
  }));
  localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(quizzes));
};

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.mocked(getCurrentUser).mockReturnValue({
    id: USER_ID, email: 'a@b.com', username: 'A', createdAt: '2026-01-01T00:00:00Z',
  });
});

describe('saveQuiz cap enforcement', () => {
  it('throws PlanLimitError when a starter user already has 5 quizzes', () => {
    seedQuizzes(5, 'quiz');
    expect(() => saveQuiz(baseQuiz())).toThrow(PlanLimitError);
  });

  it('succeeds when under the cap', () => {
    seedQuizzes(4, 'quiz');
    const saved = saveQuiz(baseQuiz());
    expect(saved.id).toBeTruthy();
    expect(getSavedQuizzes()).toHaveLength(5);
  });

  it('does not block a poll save when the quiz cap is full (caps are per-kind)', () => {
    seedQuizzes(5, 'quiz');
    const saved = saveQuiz(baseQuiz({ type: 'poll' }));
    expect(saved.type).toBe('poll');
  });

  it('never throws for a pro-plan user, regardless of existing count', () => {
    vi.mocked(getCurrentUser).mockReturnValue({
      id: USER_ID, email: 'a@b.com', username: 'A', createdAt: '2026-01-01T00:00:00Z', plan: 'pro',
    });
    seedQuizzes(20, 'quiz');
    expect(() => saveQuiz(baseQuiz())).not.toThrow();
  });
});

describe('duplicateQuiz cap enforcement', () => {
  it('throws PlanLimitError when duplicating would exceed the starter cap', () => {
    seedQuizzes(5, 'quiz');
    expect(() => duplicateQuiz('100000')).toThrow(PlanLimitError);
  });
});
