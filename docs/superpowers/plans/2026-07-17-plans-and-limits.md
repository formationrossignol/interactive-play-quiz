# Plans (Starter / Pro / Entreprise) & limit enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing (unenforced) `Plan` concept into real limits — per-content-kind creation caps and a live-audience cap — enforced at the point of use, with Starter users able to see their usage, and upsell prompts pointing at `/pricing`.

**Architecture:** One pure module (`src/lib/plans.ts`) is the single source of truth for caps and plan labels, with zero data-access imports (no circular deps). Each existing storage module (`quizStorage.ts`, `examStorage.ts`, `courseStorage.ts`) imports from `plans.ts` and enforces its own cap locally using data it already owns. UI entry points (`QuizBuilderStart.tsx`, `ExamBuilder.tsx`, `CourseBuilder.tsx`) show a proactive blocker before the user invests time building; the storage layer is the authoritative safety net. Live-session participant caps are baked into `quiz_data`/`Exam` at creation time (same pattern already used for `ambianceId`), not resolved live at join time, so a participant's browser never needs to know the host's plan.

**Tech Stack:** React + TypeScript (Vite), Vitest for unit tests, Supabase (Postgres RPC + Edge Functions) for live quiz/poll sessions, localStorage for quiz/poll/flashcard/slide/exam/course content.

---

## Spec reference

This plan implements `docs/superpowers/specs/2026-07-17-plans-and-limits-design.md`, refined during plan-writing with two corrections discovered while reading the code:

1. **Scope widened beyond quiz** (per user feedback after the spec was written): caps apply to 6 content kinds — quiz, poll, flashcard, slide, exam, course — not just quiz. Starter caps: 5 each for quiz/poll/flashcard/slide/exam, **1** for course. Pro/Entreprise: unlimited on all.
2. **Exam audience cap mechanism**: the spec assumed a live "join" check like quiz/poll, but exams have no Supabase-backed table at all — `examStorage.ts` is 100% localStorage, with no cross-device sync. A participant's browser has no way to look up the host's plan at attempt time. Fix: bake the cap into the `Exam` record itself at `createExam()` time (`exam.maxParticipants`), exactly like `quiz_data.maxParticipants` is baked in at quiz/poll session creation. `startAttempt()` then just reads that stored field — no live plan lookup needed.

---

## File Structure

**Create:**
- `src/lib/plans.ts` — Plan type, `ContentKind` type, `CONTENT_CAPS`, `AUDIENCE_CAP`, `ADVANCED_QUIZ_TYPES`, `getPlan()`, `isQuestionTypeLocked()`, `PlanLimitError`, `AudienceCapError`. No imports from any storage module — this is the leaf dependency everything else points at.
- `src/lib/__tests__/plans.test.ts`
- `src/lib/planUsage.ts` — `getContentUsage(userId, plan)`, the only module allowed to import all three storage modules *and* `plans.ts` (used solely by `ProfilePage.tsx`).
- `src/components/PlanLimitBlocker.tsx` — reusable "you've hit your plan limit" full-screen card, styled like `JoinQuiz.tsx`'s existing "salle verrouillée" screen.
- `supabase/migrations/20260717160000_session_max_participants.sql` — extends `create_session_atomic` with `p_max_participants`.

**Modify:**
- `src/lib/auth.ts` — `Plan` type now re-exported from `plans.ts`; remove local `perso` literal.
- `src/lib/quizStorage.ts` — `saveQuiz()`/`duplicateQuiz()` throw `PlanLimitError` at cap.
- `src/lib/__tests__/quizStorage.test.ts` (new file)
- `src/lib/examStorage.ts` — `Exam.maxParticipants` field; `createExam()` throws `PlanLimitError` at cap and stores `maxParticipants`; `startAttempt()` throws `AudienceCapError` for a brand-new participant once distinct-participant count hits the cap.
- `src/lib/__tests__/examStorage.test.ts` (new file)
- `src/lib/courseStorage.ts` — `createCourse()` throws `PlanLimitError` at cap.
- `src/lib/__tests__/courseStorage.test.ts` (new file)
- `src/pages/QuizBuilderStart.tsx` — blocker screen for quiz/poll/flashcard/slide.
- `src/pages/ExamBuilder.tsx` — blocker screen (create-mode only) + upsell toast on `PlanLimitError`.
- `src/pages/CourseBuilder.tsx` — blocker screen (create-mode only) + upsell toast on `PlanLimitError`.
- `src/components/QuizBuilder.tsx` — lock advanced quiz question types for Starter; upsell toast on `PlanLimitError` from `saveQuiz()`.
- `src/pages/ExamRoom.tsx` — new `'full'` phase for `AudienceCapError`.
- `src/lib/sessionState.ts` — `createLiveSession()` gains a `maxParticipants` param.
- `src/components/QuizSession.tsx` — passes the host's `AUDIENCE_CAP` into `createLiveSession()`.
- `supabase/functions/create-session/index.ts` — accepts and forwards `max_participants`.
- `src/pages/JoinQuiz.tsx` — capacity check + "Session complète" screen.
- `src/pages/ProfilePage.tsx` — corrected `PLAN_META` numbers (rename `perso`→`starter`) + usage bars.
- `src/lib/i18n.ts` — reconcile Starter/Pro/Entreprise Pricing bullets (EN+FR) with real caps.

---

## Task 1: `src/lib/plans.ts` — the plan model

**Files:**
- Create: `src/lib/plans.ts`
- Test: `src/lib/__tests__/plans.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/plans.test.ts
import { describe, expect, it } from 'vitest';
import {
  AUDIENCE_CAP,
  CONTENT_CAPS,
  ADVANCED_QUIZ_TYPES,
  AudienceCapError,
  DEFAULT_PLAN,
  PlanLimitError,
  getPlan,
  isQuestionTypeLocked,
} from '../plans';

describe('getPlan', () => {
  it('defaults to starter when the user has no plan set', () => {
    expect(getPlan(null)).toBe('starter');
    expect(getPlan(undefined)).toBe('starter');
    expect(getPlan({})).toBe('starter');
    expect(getPlan({ plan: undefined })).toBe('starter');
  });

  it('returns the user\'s plan when set', () => {
    expect(getPlan({ plan: 'pro' })).toBe('pro');
    expect(getPlan({ plan: 'entreprise' })).toBe('entreprise');
  });
});

describe('CONTENT_CAPS', () => {
  it('caps starter at 5 for quiz/poll/flashcard/slide/exam and 1 for course', () => {
    expect(CONTENT_CAPS.starter).toEqual({
      quiz: 5, poll: 5, flashcard: 5, slide: 5, exam: 5, course: 1,
    });
  });

  it('is unlimited (null) on every kind for pro and entreprise', () => {
    for (const plan of ['pro', 'entreprise'] as const) {
      for (const kind of ['quiz', 'poll', 'flashcard', 'slide', 'exam', 'course'] as const) {
        expect(CONTENT_CAPS[plan][kind]).toBeNull();
      }
    }
  });
});

describe('AUDIENCE_CAP', () => {
  it('is 20 for starter, 200 for pro, unlimited for entreprise', () => {
    expect(AUDIENCE_CAP.starter).toBe(20);
    expect(AUDIENCE_CAP.pro).toBe(200);
    expect(AUDIENCE_CAP.entreprise).toBeNull();
  });
});

describe('isQuestionTypeLocked', () => {
  it('locks advanced quiz types for starter', () => {
    for (const type of ADVANCED_QUIZ_TYPES) {
      expect(isQuestionTypeLocked(type, 'starter')).toBe(true);
    }
  });

  it('never locks classic types', () => {
    for (const type of ['multiple-choice', 'true-false', 'short-answer']) {
      expect(isQuestionTypeLocked(type, 'starter')).toBe(false);
    }
  });

  it('never locks anything for pro or entreprise', () => {
    for (const type of ADVANCED_QUIZ_TYPES) {
      expect(isQuestionTypeLocked(type, 'pro')).toBe(false);
      expect(isQuestionTypeLocked(type, 'entreprise')).toBe(false);
    }
  });
});

describe('PlanLimitError', () => {
  it('carries the kind and cap, and has a human-readable message', () => {
    const err = new PlanLimitError('quiz', 5);
    expect(err.kind).toBe('quiz');
    expect(err.cap).toBe(5);
    expect(err.message).toContain('5');
    expect(err.name).toBe('PlanLimitError');
  });
});

describe('AudienceCapError', () => {
  it('has a participant-facing message and no plan-upsell wording', () => {
    const err = new AudienceCapError();
    expect(err.name).toBe('AudienceCapError');
    expect(err.message.toLowerCase()).not.toContain('pro');
  });
});

describe('DEFAULT_PLAN', () => {
  it('is starter', () => {
    expect(DEFAULT_PLAN).toBe('starter');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- plans.test.ts`
Expected: FAIL — `Cannot find module '../plans'`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/plans.ts

export type Plan = 'starter' | 'pro' | 'entreprise';

export type ContentKind = 'quiz' | 'poll' | 'flashcard' | 'slide' | 'exam' | 'course';

export const DEFAULT_PLAN: Plan = 'starter';

/** Creation caps per plan per content kind. null = unlimited. */
export const CONTENT_CAPS: Record<Plan, Record<ContentKind, number | null>> = {
  starter: { quiz: 5, poll: 5, flashcard: 5, slide: 5, exam: 5, course: 1 },
  pro: { quiz: null, poll: null, flashcard: null, slide: null, exam: null, course: null },
  entreprise: { quiz: null, poll: null, flashcard: null, slide: null, exam: null, course: null },
};

/**
 * "How many people can experience this content" — quiz/poll live rooms and
 * exam attempts (distinct participants) both read this, via two different
 * mechanisms (see examStorage.ts). null = unlimited.
 */
export const AUDIENCE_CAP: Record<Plan, number | null> = {
  starter: 20,
  pro: 200,
  entreprise: null,
};

/** Quiz-builder-only gating. Poll/flashcard/exam question types are unaffected. */
export const ADVANCED_QUIZ_TYPES = ['ranking', 'matching', 'fill-blank', 'slider'] as const;

export const PLAN_LABELS: Record<Plan, string> = {
  starter: 'Starter',
  pro: 'Pro',
  entreprise: 'Entreprise',
};

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  quiz: 'quiz',
  poll: 'sondages',
  flashcard: 'jeux de cartes',
  slide: 'présentations',
  exam: 'examens',
  course: 'cours',
};

export function getPlan(user: { plan?: Plan } | null | undefined): Plan {
  return user?.plan ?? DEFAULT_PLAN;
}

export function isQuestionTypeLocked(type: string, plan: Plan): boolean {
  return plan === 'starter' && (ADVANCED_QUIZ_TYPES as readonly string[]).includes(type);
}

/**
 * Thrown by the storage layer when a creation would exceed the user's plan
 * cap. Creator-facing — the catching UI shows an "Upgrade to Pro" action.
 */
export class PlanLimitError extends Error {
  kind: ContentKind;
  cap: number;

  constructor(kind: ContentKind, cap: number) {
    super(
      `Limite du plan Starter atteinte (${cap} ${CONTENT_KIND_LABELS[kind]} max). ` +
      `Passez au plan Pro pour continuer.`
    );
    this.name = 'PlanLimitError';
    this.kind = kind;
    this.cap = cap;
  }
}

/**
 * Thrown when a live room or exam is at its audience cap. Participant-
 * facing — the catching UI must NOT offer a plan upsell (the participant
 * isn't the account holder).
 */
export class AudienceCapError extends Error {
  constructor() {
    super('Capacité maximale atteinte. Contactez l\'organisateur.');
    this.name = 'AudienceCapError';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- plans.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/plans.ts src/lib/__tests__/plans.test.ts
git commit -m "feat(plans): add plan model with content caps and audience cap"
```

---

## Task 2: Rename `perso` → `starter` in `auth.ts`

**Files:**
- Modify: `src/lib/auth.ts:9`

- [ ] **Step 1: Update the `Plan` type to re-export from `plans.ts`**

In `src/lib/auth.ts`, replace:

```ts
export type Plan = 'perso' | 'pro' | 'entreprise';
```

with:

```ts
export type { Plan } from './plans';
```

- [ ] **Step 2: Verify no other file still uses the literal `'perso'`**

Run: `grep -rn "'perso'" src`
Expected: no output (the only 5 references — `auth.ts` type, and 4 in `ProfilePage.tsx` — are handled here and in Task 17).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: errors in `ProfilePage.tsx` only (still uses `'perso'` — fixed in Task 17). If `auth.ts` itself has no other errors, this step is correct so far.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts
git commit -m "refactor(auth): re-export Plan from plans.ts, drop perso literal"
```

---

## Task 3: `quizStorage.ts` — cap enforcement for quiz/poll/flashcard/slide

**Files:**
- Modify: `src/lib/quizStorage.ts:1-2` (imports), `:101-131` (`saveQuiz`), `:241-267` (`duplicateQuiz`)
- Test: `src/lib/__tests__/quizStorage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/quizStorage.test.ts
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

const seedQuizzes = (n: number, type: SavedQuiz['type'] = 'quiz') => {
  const quizzes: SavedQuiz[] = Array.from({ length: n }, (_, i) => ({
    ...baseQuiz({ type }),
    id: `q${i}`,
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
    expect(() => duplicateQuiz('q0')).toThrow(PlanLimitError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- quizStorage.test.ts`
Expected: FAIL — cap tests fail because `saveQuiz`/`duplicateQuiz` don't check caps yet (the 5-quiz test saves a 6th quiz without throwing).

- [ ] **Step 3: Implement the cap checks**

In `src/lib/quizStorage.ts`, add the import:

```ts
import { getCurrentUser } from './auth';
import { CONTENT_CAPS, getPlan, PlanLimitError, type ContentKind } from './plans';
```

Replace the body of `saveQuiz`:

```ts
export const saveQuiz = (
  quiz: Omit<SavedQuiz, 'id' | 'createdAt' | 'userId' | 'speedBonus' | 'transitionTime' | 'category'> &
    Partial<Pick<SavedQuiz, 'speedBonus' | 'transitionTime' | 'category'>>,
): SavedQuiz => {
  const user = getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  const type = quiz.type || 'quiz';
  const cap = CONTENT_CAPS[getPlan(user)][type as ContentKind];
  if (cap !== null) {
    const used = getUserQuizzes(user.id).filter((q) => q.type === type).length;
    if (used >= cap) throw new PlanLimitError(type as ContentKind, cap);
  }

  const newQuiz: SavedQuiz = {
    ...quiz,
    tags: quiz.tags || [],
    speedBonus: quiz.speedBonus ?? true,
    transitionTime: quiz.transitionTime ?? 5,
    category: quiz.category || 'Autre',
    type,
    id: (() => {
      const existing = new Set(getSavedQuizzes().map((q) => q.id));
      let candidate: string;
      do { candidate = (Math.floor(Math.random() * 900000) + 100000).toString(); }
      while (existing.has(candidate));
      return candidate;
    })(),
    createdAt: new Date().toISOString(),
    userId: user.id
  };

  const quizzes = getSavedQuizzes();
  quizzes.push(newQuiz);
  localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(quizzes));

  return newQuiz;
};
```

Replace the body of `duplicateQuiz`:

```ts
export const duplicateQuiz = (id: string): SavedQuiz | null => {
  const user = getCurrentUser();
  if (!user) return null;
  const original = getQuizById(id);
  if (!original || original.userId !== user.id) return null;

  const cap = CONTENT_CAPS[getPlan(user)][original.type as ContentKind];
  if (cap !== null) {
    const used = getUserQuizzes(user.id).filter((q) => q.type === original.type).length;
    if (used >= cap) throw new PlanLimitError(original.type as ContentKind, cap);
  }

  const existing = new Set(getSavedQuizzes().map((q) => q.id));
  let newId: string;
  do { newId = (Math.floor(Math.random() * 900000) + 100000).toString(); }
  while (existing.has(newId));

  const copy: SavedQuiz = {
    ...original,
    id: newId,
    title: `Copie de ${original.title}`,
    createdAt: new Date().toISOString(),
    isFavorite: false,
    rating: undefined,
    ratingCount: undefined,
    folderId: original.folderId ?? null,
  };

  const quizzes = getSavedQuizzes();
  quizzes.push(copy);
  localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(quizzes));
  return copy;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- quizStorage.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/quizStorage.ts src/lib/__tests__/quizStorage.test.ts
git commit -m "feat(quizStorage): enforce plan caps on saveQuiz/duplicateQuiz"
```

---

## Task 4: `examStorage.ts` — cap enforcement + audience cap

**Files:**
- Modify: `src/lib/examStorage.ts:1-2` (imports), `:19-39` (`Exam` interface), `:102-118` (`createExam`), `:175-220` (`startAttempt`)
- Test: `src/lib/__tests__/examStorage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/examStorage.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentUser } from '../auth';
import { createExam, getHostExams, startAttempt, type Exam, type Attempt } from '../examStorage';
import { PlanLimitError, AudienceCapError } from '../plans';

vi.mock('../auth', () => ({ getCurrentUser: vi.fn() }));
vi.mock('../quizStorage', () => ({
  getQuizById: () => ({ id: 'quiz-1', questions: [{ id: 'a' }, { id: 'b' }] }),
}));

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.get(k) ?? null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

const USER_ID = 'host-1';

const examPayload = (): Omit<Exam, 'id' | 'hostId' | 'joinCode' | 'createdAt' | 'updatedAt' | 'maxParticipants'> => ({
  title: 'Exam', description: '', quizId: 'quiz-1', openAt: '2026-01-01T00:00:00Z',
  closeAt: '2026-01-02T00:00:00Z', durationMinutes: null, maxAttempts: 3,
  shuffleQuestions: false, shuffleAnswers: false, passingScore: 70,
  showResultsPolicy: 'immediately', showDetailPolicy: 'score-only',
  scoreRetentionPolicy: 'best', status: 'draft',
});

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.mocked(getCurrentUser).mockReturnValue({
    id: USER_ID, email: 'h@b.com', username: 'H', createdAt: '2026-01-01T00:00:00Z',
  });
});

describe('createExam cap enforcement', () => {
  it('throws PlanLimitError when a starter host already has 5 exams', () => {
    for (let i = 0; i < 5; i++) createExam(examPayload());
    expect(getHostExams(USER_ID)).toHaveLength(5);
    expect(() => createExam(examPayload())).toThrow(PlanLimitError);
  });

  it('stores the starter audience cap (20) on the exam', () => {
    const exam = createExam(examPayload());
    expect(exam.maxParticipants).toBe(20);
  });

  it('stores null (unlimited) for a pro host', () => {
    vi.mocked(getCurrentUser).mockReturnValue({
      id: USER_ID, email: 'h@b.com', username: 'H', createdAt: '2026-01-01T00:00:00Z', plan: 'pro',
    });
    const exam = createExam(examPayload());
    expect(exam.maxParticipants).toBeNull();
  });
});

describe('startAttempt audience cap', () => {
  const makeExam = (maxParticipants: number | null): Exam => ({
    id: 'exam-1', hostId: USER_ID, quizId: 'quiz-1', title: 'E', description: '',
    openAt: '2026-01-01T00:00:00Z', closeAt: '2026-01-02T00:00:00Z', durationMinutes: null,
    maxAttempts: 3, shuffleQuestions: false, shuffleAnswers: false, passingScore: 70,
    showResultsPolicy: 'immediately', showDetailPolicy: 'score-only', scoreRetentionPolicy: 'best',
    status: 'open', joinCode: 'ABC123', createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z', maxParticipants,
  });

  const seedSubmittedAttempt = (examId: string, participantId: string) => {
    const raw = localStorage.getItem('lms_exam_attempts');
    const attempts: Attempt[] = raw ? JSON.parse(raw) : [];
    attempts.push({
      id: `att-${participantId}`, examId, participantId, participantName: participantId,
      participantEmail: `${participantId}@b.com`, startedAt: '2026-01-01T00:00:00Z',
      submittedAt: '2026-01-01T00:10:00Z', timeUsedSeconds: 600, questionOrder: ['a', 'b'],
      answers: {}, score: 1, percentage: 50, passed: false, submissionMode: 'manual',
      status: 'submitted', logs: [],
    });
    localStorage.setItem('lms_exam_attempts', JSON.stringify(attempts));
  };

  it('blocks a brand-new participant once the audience cap is reached', () => {
    const exam = makeExam(2);
    seedSubmittedAttempt(exam.id, 'p1');
    seedSubmittedAttempt(exam.id, 'p2');
    expect(() => startAttempt(exam, 'p3', 'P3', 'p3@b.com')).toThrow(AudienceCapError);
  });

  it('never blocks a participant who already has an attempt (retakes)', () => {
    const exam = makeExam(1);
    seedSubmittedAttempt(exam.id, 'p1');
    expect(() => startAttempt(exam, 'p1', 'P1', 'p1@b.com')).not.toThrow();
  });

  it('never blocks when maxParticipants is null', () => {
    const exam = makeExam(null);
    for (let i = 0; i < 5; i++) seedSubmittedAttempt(exam.id, `p${i}`);
    expect(() => startAttempt(exam, 'p5', 'P5', 'p5@b.com')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- examStorage.test.ts`
Expected: FAIL — `Exam` has no `maxParticipants` property (TS error) and no cap logic exists yet.

- [ ] **Step 3: Implement**

In `src/lib/examStorage.ts`, add the import and extend `Exam`:

```ts
import { getCurrentUser } from './auth';
import { getQuizById } from './quizStorage';
import { CONTENT_CAPS, AUDIENCE_CAP, getPlan, PlanLimitError, AudienceCapError } from './plans';
```

```ts
export interface Exam {
  id: string;
  hostId: string;
  quizId: string;
  title: string;
  description: string;
  openAt: string;        // ISO datetime
  closeAt: string;       // ISO datetime
  durationMinutes: number | null;  // null = no time limit
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  passingScore: number;            // percentage 0–100
  showResultsPolicy: ShowResultsPolicy;
  showDetailPolicy: ShowDetailPolicy;
  scoreRetentionPolicy: ScoreRetentionPolicy;
  status: ExamStatus;
  joinCode: string;
  /** Host's plan-derived audience cap, baked in at creation (host has no
   *  Supabase-synced session to re-check plan against at attempt time). */
  maxParticipants: number | null;
  createdAt: string;
  updatedAt: string;
}
```

Replace `createExam`:

```ts
export const createExam = (
  data: Omit<Exam, 'id' | 'hostId' | 'joinCode' | 'createdAt' | 'updatedAt' | 'maxParticipants'>,
): Exam => {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const plan = getPlan(user);
  const cap = CONTENT_CAPS[plan].exam;
  if (cap !== null && getHostExams(user.id).length >= cap) throw new PlanLimitError('exam', cap);

  const all = readExams();
  const now = new Date().toISOString();
  const exam: Exam = {
    ...data,
    id: genExamId(),
    hostId: user.id,
    joinCode: uniqueJoinCode(all),
    maxParticipants: AUDIENCE_CAP[plan],
    createdAt: now,
    updatedAt: now,
  };
  all.push(exam);
  writeExams(all);
  return exam;
};
```

In `startAttempt`, insert the audience-cap check between the "resume existing" check and question-order generation:

```ts
export const startAttempt = (
  exam: Exam,
  participantId: string,
  participantName: string,
  participantEmail: string,
): Attempt => {
  const quiz = getQuizById(exam.quizId);
  if (!quiz) throw new Error('Quiz introuvable');

  const existing = getAttemptsForParticipant(exam.id, participantId);
  const completed = existing.filter((a) => a.status !== 'in-progress');
  if (completed.length >= exam.maxAttempts) throw new Error('Nombre maximum de tentatives atteint');

  const active = getActiveAttempt(exam.id, participantId);
  if (active) return active; // resume existing

  if (exam.maxParticipants !== null && existing.length === 0) {
    const distinctParticipants = new Set(getAttemptsForExam(exam.id).map((a) => a.participantId));
    if (distinctParticipants.size >= exam.maxParticipants) throw new AudienceCapError();
  }

  let qIds = quiz.questions.map((q: { id: string }) => q.id);
  // ...unchanged from here
```

(Leave the rest of `startAttempt` — question shuffling, attempt construction — exactly as it is today.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- examStorage.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/examStorage.ts src/lib/__tests__/examStorage.test.ts
git commit -m "feat(examStorage): enforce exam creation cap and distinct-participant audience cap"
```

---

## Task 5: `courseStorage.ts` — cap enforcement

**Files:**
- Modify: `src/lib/courseStorage.ts:1` (imports), `:87-98` (`createCourse`)
- Test: `src/lib/__tests__/courseStorage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/courseStorage.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentUser } from '../auth';
import { createCourse, getUserCourses, type Course } from '../courseStorage';
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

const coursePayload = (): Omit<Course, 'id' | 'userId' | 'createdAt' | 'updatedAt'> => ({
  title: 'Course', description: '', isPublic: false, isFavorite: false,
  modules: [], category: 'Autre', tags: [],
});

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.mocked(getCurrentUser).mockReturnValue({
    id: USER_ID, email: 'a@b.com', username: 'A', createdAt: '2026-01-01T00:00:00Z',
  });
});

describe('createCourse cap enforcement', () => {
  it('throws PlanLimitError when a starter user already has 1 course', () => {
    createCourse(coursePayload());
    expect(getUserCourses(USER_ID)).toHaveLength(1);
    expect(() => createCourse(coursePayload())).toThrow(PlanLimitError);
  });

  it('never throws for a pro-plan user', () => {
    vi.mocked(getCurrentUser).mockReturnValue({
      id: USER_ID, email: 'a@b.com', username: 'A', createdAt: '2026-01-01T00:00:00Z', plan: 'pro',
    });
    createCourse(coursePayload());
    expect(() => createCourse(coursePayload())).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- courseStorage.test.ts`
Expected: FAIL — second `createCourse()` call in the first test doesn't throw.

- [ ] **Step 3: Implement**

In `src/lib/courseStorage.ts`, add the import:

```ts
import { getCurrentUser } from './auth';
import { CONTENT_CAPS, getPlan, PlanLimitError } from './plans';
```

Replace `createCourse`:

```ts
export const createCourse = (
  data: Omit<Course, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
): Course => {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const cap = CONTENT_CAPS[getPlan(user)].course;
  if (cap !== null && getUserCourses(user.id).length >= cap) throw new PlanLimitError('course', cap);

  const now = new Date().toISOString();
  const course: Course = { ...data, id: genId(), userId: user.id, createdAt: now, updatedAt: now };
  const all = getAllCourses();
  all.push(course);
  writeAllCourses(all);
  return course;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- courseStorage.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/courseStorage.ts src/lib/__tests__/courseStorage.test.ts
git commit -m "feat(courseStorage): enforce plan cap on createCourse"
```

---

## Task 6: `planUsage.ts` — usage summary for the Profile page

**Files:**
- Create: `src/lib/planUsage.ts`

- [ ] **Step 1: Implement**

No unit test for this one — it's a thin aggregator over three already-tested storage modules, exercised end-to-end by the Profile page manual check in Task 19.

```ts
// src/lib/planUsage.ts
import { getUserQuizzes } from './quizStorage';
import { getHostExams } from './examStorage';
import { getUserCourses } from './courseStorage';
import { CONTENT_CAPS, type ContentKind, type Plan } from './plans';

export interface ContentUsage {
  used: number;
  cap: number | null;
}

const QUIZ_STORAGE_KINDS: ContentKind[] = ['quiz', 'poll', 'flashcard', 'slide'];

/** Usage for all 6 content kinds, for the given user under the given plan. */
export function getContentUsage(userId: string, plan: Plan): Record<ContentKind, ContentUsage> {
  const quizzes = getUserQuizzes(userId);
  const caps = CONTENT_CAPS[plan];

  const usage = {} as Record<ContentKind, ContentUsage>;
  for (const kind of QUIZ_STORAGE_KINDS) {
    usage[kind] = { used: quizzes.filter((q) => q.type === kind).length, cap: caps[kind] };
  }
  usage.exam = { used: getHostExams(userId).length, cap: caps.exam };
  usage.course = { used: getUserCourses(userId).length, cap: caps.course };
  return usage;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/planUsage.ts
git commit -m "feat(plans): add getContentUsage aggregator for the Profile page"
```

---

## Task 7: `PlanLimitBlocker.tsx` — reusable blocker screen

**Files:**
- Create: `src/components/PlanLimitBlocker.tsx`

- [ ] **Step 1: Implement**

Styled to match the existing "salle verrouillée" screen in `src/pages/JoinQuiz.tsx:161-178`.

```tsx
// src/components/PlanLimitBlocker.tsx
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";

interface PlanLimitBlockerProps {
  title: string;
  description: string;
}

export const PlanLimitBlocker = ({ title, description }: PlanLimitBlockerProps) => {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div className="ap-card ap-card--floaty" style={{ maxWidth: 440, width: "100%", textAlign: "center", padding: "40px" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--ap-brand-soft)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
          <Lock style={{ width: 32, height: 32, color: "var(--ap-brand)" }} strokeWidth={2} />
        </div>
        <h2 className="ap-h2" style={{ fontSize: "24px", marginBottom: "12px" }}>{title}</h2>
        <p className="ap-muted" style={{ fontSize: "15px", marginBottom: "24px" }}>{description}</p>
        <button className="ap-btn ap-btn--pill" onClick={() => navigate("/pricing")}>
          Passer au plan Pro
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/PlanLimitBlocker.tsx
git commit -m "feat(ui): add reusable PlanLimitBlocker screen"
```

---

## Task 8: `QuizBuilderStart.tsx` — blocker for quiz/poll/flashcard/slide

**Files:**
- Modify: `src/pages/QuizBuilderStart.tsx:1-38`

- [ ] **Step 1: Add imports and the cap check**

Add to the top imports:

```tsx
import { getCurrentUser } from "@/lib/auth";
import { getUserQuizzes } from "@/lib/quizStorage";
import { CONTENT_CAPS, CONTENT_KIND_LABELS, getPlan, type ContentKind } from "@/lib/plans";
import { PlanLimitBlocker } from "@/components/PlanLimitBlocker";
```

Right after `const quizType = ...` (line 33), add:

```tsx
const user = getCurrentUser();
const plan = getPlan(user);
const cap = CONTENT_CAPS[plan][quizType as ContentKind];
const used = user ? getUserQuizzes(user.id).filter((q) => q.type === quizType).length : 0;
const atCap = cap !== null && used >= cap;
```

- [ ] **Step 2: Render the blocker before the picker**

Right after the `pageTitle`/`previewTemplates` declarations (before the `return (` on line 57), insert:

```tsx
if (atCap) {
  return (
    <div style={{ minHeight: "100vh" }}>
      <Header subtitle={pageTitle} />
      <PlanLimitBlocker
        title="Limite du plan Starter atteinte"
        description={`Le plan Starter est limité à ${cap} ${CONTENT_KIND_LABELS[quizType as ContentKind]}. Passez au plan Pro pour créer sans limite.`}
      />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 4: Manual verify**

Run: `npm run dev`, log in as a user, set `plan: 'starter'` in Supabase `user_metadata` (or leave unset — starter is the default), create 5 quizzes, then navigate to `/builder-start?type=quiz`. Expected: blocker screen instead of the template picker. Navigate to `/builder-start?type=poll` — expected: normal picker (poll cap is independent of quiz cap).

- [ ] **Step 5: Commit**

```bash
git add src/pages/QuizBuilderStart.tsx
git commit -m "feat(builder-start): block quiz/poll/flashcard/slide creation at plan cap"
```

---

## Task 9: `ExamBuilder.tsx` — blocker + upsell toast

**Files:**
- Modify: `src/pages/ExamBuilder.tsx:1-6` (imports), `:56-67` (cap check), `:139-141` (catch block), `:148` (blocker render)

- [ ] **Step 1: Add imports and the cap check**

Add to the top imports:

```ts
import { getHostExams } from '@/lib/examStorage';
import { CONTENT_CAPS, getPlan, PlanLimitError } from '@/lib/plans';
import { PlanLimitBlocker } from '@/components/PlanLimitBlocker';
```

Right after `const quizzes = ...` (line 67), add:

```ts
const cap = CONTENT_CAPS[getPlan(user)].exam;
const used = user ? getHostExams(user.id).length : 0;
const atCap = !examId && cap !== null && used >= cap;
```

- [ ] **Step 2: Render the blocker before the form**

Right before `return (` (line 148), insert:

```tsx
if (atCap) {
  return (
    <PlanLimitBlocker
      title="Limite du plan Starter atteinte"
      description={`Le plan Starter est limité à ${cap} examens. Passez au plan Pro pour en créer davantage.`}
    />
  );
}
```

- [ ] **Step 3: Surface `PlanLimitError` in the save catch block**

Replace the `catch` block inside `handleSave` (currently `catch (e) { toast.error((e as Error).message); }` at line 139-141 — no change needed here since `PlanLimitError.message` is already the upsell copy):

```ts
} catch (e) {
  if (e instanceof PlanLimitError) {
    toast.error(e.message, { action: { label: 'Passer Pro', onClick: () => navigate('/pricing') } });
  } else {
    toast.error((e as Error).message);
  }
} finally {
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 5: Manual verify**

Create 5 exams as a starter user, navigate to `/exam-builder` (no `examId`). Expected: blocker screen. Navigate to an existing exam's edit URL (`?examId=...`) — expected: normal edit form (blocker only applies to creation).

- [ ] **Step 6: Commit**

```bash
git add src/pages/ExamBuilder.tsx
git commit -m "feat(exam-builder): block exam creation at plan cap, upsell toast on save"
```

---

## Task 10: `CourseBuilder.tsx` — blocker + upsell toast

**Files:**
- Modify: `src/pages/CourseBuilder.tsx:1-18` (imports), `:78-95` (cap check), `:134-136` (catch block), `:254-256` (blocker render)

- [ ] **Step 1: Add imports and the cap check**

Add to the top imports:

```ts
import { getUserCourses } from "@/lib/courseStorage";
import { CONTENT_CAPS, getPlan, PlanLimitError } from "@/lib/plans";
import { PlanLimitBlocker } from "@/components/PlanLimitBlocker";
```

(`getUserCourses` joins the existing `courseStorage` import list; `createCourse, getCourseById, genId, updateCourse, type Course, type Lesson, type Module` stay as-is.)

Right after `const userFlashcards = ...` (line 94), add:

```ts
const cap = CONTENT_CAPS[getPlan(user)].course;
const usedCourses = user ? getUserCourses(user.id).length : 0;
const atCap = !courseId && cap !== null && usedCourses >= cap;
```

- [ ] **Step 2: Render the blocker before the main page**

Right before `return (` (line 254), insert:

```tsx
if (atCap) {
  return (
    <div style={{ minHeight: "100vh" }}>
      <Header subtitle="Créateur de cours" />
      <PlanLimitBlocker
        title="Limite du plan Starter atteinte"
        description={`Le plan Starter est limité à ${cap} cours. Passez au plan Pro pour en créer davantage.`}
      />
    </div>
  );
}
```

- [ ] **Step 3: Surface `PlanLimitError` in the save catch block**

Replace the `catch` block inside `handleSave` (line 134-136):

```ts
} catch (e) {
  if (e instanceof PlanLimitError) {
    toast.error(e.message, { action: { label: 'Passer Pro', onClick: () => navigate('/pricing') } });
  } else {
    toast.error(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
  }
} finally {
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 5: Manual verify**

Create 1 course as a starter user, navigate to `/course-builder` (no `courseId`). Expected: blocker screen (tightest cap in the system — verify it really is 1, not 5).

- [ ] **Step 6: Commit**

```bash
git add src/pages/CourseBuilder.tsx
git commit -m "feat(course-builder): block course creation at plan cap (1 for starter)"
```

---

## Task 11: `QuizBuilder.tsx` — lock advanced question types + save upsell

**Files:**
- Modify: `src/components/QuizBuilder.tsx:23` (imports), `:470` (plan), `:679-707` (`handleSaveQuiz` catch), `:784-799` (type dropdown)

- [ ] **Step 1: Add imports and compute `plan`**

Add to the imports (near line 23):

```ts
import { getCurrentUser } from "@/lib/auth";
import { getPlan, isQuestionTypeLocked, PlanLimitError } from "@/lib/plans";
```

Right after `const user = getCurrentUser();` (line 470), add:

```ts
const plan = getPlan(user);
```

- [ ] **Step 2: Lock advanced types in the type-picker dropdown**

In `renderCenterEditor` (the function containing the dropdown, around line 784-799), replace the `getAvailableTypes().map(...)` block:

```tsx
{getAvailableTypes().map(type => {
  const m = QTYPE_META[type] || { label: type, dot: "var(--ap-muted)" };
  const locked = !isPoll && isQuestionTypeLocked(type, plan);
  return (
    <DropdownMenuItem
      key={type}
      className="gap-2 rounded-xl text-sm cursor-pointer"
      onSelect={() => {
        if (locked) {
          toast.error("Type de question réservé au plan Pro", {
            action: { label: "Passer Pro", onClick: () => navigate("/pricing") },
          });
          return;
        }
        const defaults = getDefaultQuestion(type);
        upd({ ...defaults, id: q.id, question: q.question, image: q.image });
      }}
      style={locked ? { opacity: 0.5 } : undefined}
    >
      <i style={{ width: 7, height: 7, borderRadius: 2, background: m.dot, display: "inline-block", flexShrink: 0 }} />
      {m.label}
      {locked && (
        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 800, color: "var(--ap-brand)", background: "var(--ap-brand-soft)", padding: "2px 6px", borderRadius: 999 }}>
          Pro
        </span>
      )}
    </DropdownMenuItem>
  );
})}
```

- [ ] **Step 3: Surface `PlanLimitError` in `handleSaveQuiz`**

Replace the `catch` block at the end of `handleSaveQuiz` (line 706):

```ts
} catch (e) {
  if (e instanceof PlanLimitError) {
    toast.error(e.message, { action: { label: "Passer Pro", onClick: () => navigate("/pricing") } });
  } else {
    toast.error("Erreur lors de l'enregistrement");
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 5: Manual verify**

As a starter user, open the quiz builder, add a question, open the type dropdown. Expected: "Classement", "Association", "Lacune", "Curseur" show a dimmed "Pro" badge; clicking one shows an upsell toast and doesn't change the question type. "QCM", "Vrai/Faux", "Réponse courte" work normally. Switch the same account to `plan: 'pro'` and confirm all types are selectable.

- [ ] **Step 6: Commit**

```bash
git add src/components/QuizBuilder.tsx
git commit -m "feat(quiz-builder): lock advanced question types for starter plan"
```

---

## Task 12: `ExamRoom.tsx` — handle `AudienceCapError`

**Files:**
- Modify: `src/pages/ExamRoom.tsx:49` (`Phase` type), `:117-129` (`handleStart`), `:233-242` (render)

- [ ] **Step 1: Add the `'full'` phase and import `AudienceCapError`**

Add near the top imports:

```ts
import { AudienceCapError } from '@/lib/plans';
```

Update the `Phase` type (line 49):

```ts
type Phase = 'loading' | 'not-found' | 'not-open' | 'identify' | 'ready' | 'taking' | 'submitted' | 'exhausted' | 'full';
```

- [ ] **Step 2: Distinguish the error in `handleStart`**

Replace `handleStart` (lines 117-129):

```ts
const handleStart = () => {
  if (!exam || !participant) return;
  try {
    const att = startAttempt(exam, participant.id, participant.name, participant.email);
    setAttempt(att);
    setAnswers(att.answers ?? {});
    elapsedRef.current = att.timeUsedSeconds;
    setElapsed(att.timeUsedSeconds);
    setPhase('taking');
  } catch (e) {
    setPhase(e instanceof AudienceCapError ? 'full' : 'exhausted');
  }
};
```

- [ ] **Step 3: Render the `'full'` screen**

Right after the `exhausted` phase block (after line 242), insert:

```tsx
if (phase === 'full') return (
  <Screen>
    <BigIcon>🚪</BigIcon>
    <Title>Capacité maximale atteinte</Title>
    <Sub>Cet examen a atteint son nombre maximum de participants. Contactez l'organisateur.</Sub>
  </Screen>
);
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 5: Manual verify**

Create a starter-plan exam (`maxParticipants` = 20). This is impractical to hit manually with 20 real browser sessions — instead, temporarily lower the seeded `AUDIENCE_CAP.starter` value in a local scratch edit to `1`, take the exam once as participant A (submit), then attempt as participant B via a fresh join code session. Expected: participant B sees "Capacité maximale atteinte", not "Tentatives épuisées". Revert the scratch edit before committing.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ExamRoom.tsx
git commit -m "feat(exam-room): show capacity-reached screen distinct from attempts-exhausted"
```

---

## Task 13: `sessionState.ts` + `QuizSession.tsx` — wire `maxParticipants` into session creation

**Files:**
- Modify: `src/lib/sessionState.ts:454-468` (`createLiveSession`), `src/components/QuizSession.tsx:1-30` (imports), `:433` (call site)

- [ ] **Step 1: Extend `createLiveSession`**

In `src/lib/sessionState.ts`, replace the `createLiveSession` function (lines 454-468):

```ts
export const createLiveSession = async (
  gameCode: string,
  title: string,
  questions: unknown[],
  ambianceId?: string,
  maxParticipants?: number | null
): Promise<boolean> => {
  const { error } = await supabase.functions.invoke("create-session", {
    body: { game_code: gameCode, title, questions, ambiance_id: ambianceId ?? "arcade", max_participants: maxParticipants ?? null },
  });
  if (error) console.error("[createLiveSession error]", gameCode, await describeFunctionsError(error));
  return !error;
};
```

- [ ] **Step 2: Pass the host's audience cap at the call site**

In `src/components/QuizSession.tsx`, add the import:

```ts
import { getCurrentUser } from "@/lib/auth";
import { AUDIENCE_CAP, getPlan } from "@/lib/plans";
```

Replace the `createLiveSession` call (line 433):

```ts
const ok = await createLiveSession(
  quiz.gameCode, quiz.title, quiz.questions, quiz.ambianceId,
  AUDIENCE_CAP[getPlan(getCurrentUser())]
);
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sessionState.ts src/components/QuizSession.tsx
git commit -m "feat(session): pass host's plan audience cap into createLiveSession"
```

---

## Task 14: SQL migration — extend `create_session_atomic`

**Files:**
- Create: `supabase/migrations/20260717160000_session_max_participants.sql`

- [ ] **Step 1: Write the migration**

Follows the exact pattern of `20260717120000_session_control.sql` (which added `p_ambiance_id` and `control`).

```sql
-- Bake the host's plan-derived participant cap into quiz_data at session
-- (re)creation, mirroring how ambiance_id was added
-- (20260714120000_create_session_ambiance.sql) and control was added
-- (20260717120000_session_control.sql). Read by JoinQuiz.tsx to block
-- joins once the room is at capacity.
drop function if exists create_session_atomic(text, text, jsonb, jsonb, text);

create or replace function create_session_atomic(
  p_game_code text,
  p_title text,
  p_public_questions jsonb,
  p_private_questions jsonb,
  p_ambiance_id text default 'arcade',
  p_max_participants int default null
) returns void
language plpgsql
as $$
begin
  insert into session_quiz_answers (game_code, questions, created_at)
  values (p_game_code, p_private_questions, now())
  on conflict (game_code) do update
    set questions = excluded.questions, created_at = excluded.created_at;

  insert into session_state (
    game_code, players, game_state, current_question_index,
    time_left, question_started_at, quiz_data, control, updated_at
  )
  values (
    p_game_code, '[]'::jsonb, 'waiting', 0,
    0, null,
    jsonb_build_object(
      'title', p_title, 'questions', p_public_questions,
      'ambianceId', p_ambiance_id, 'maxParticipants', p_max_participants
    ),
    '{}'::jsonb,
    now()
  )
  on conflict (game_code) do update
    set players = '[]'::jsonb,
        game_state = 'waiting',
        current_question_index = 0,
        time_left = 0,
        question_started_at = null,
        quiz_data = excluded.quiz_data,
        control = '{}'::jsonb,
        updated_at = now();
end;
$$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260717160000_session_max_participants.sql
git commit -m "feat(db): extend create_session_atomic with p_max_participants"
```

Deployment (running the migration against the linked project) happens in Task 19's manual verification pass, not here — this repo's other recent migrations follow the same commit-then-deploy-separately pattern (see project memory: prod schema deploys are a distinct, explicit step).

---

## Task 15: `create-session` edge function — accept & forward `max_participants`

**Files:**
- Modify: `supabase/functions/create-session/index.ts:17-22` (`CreateSessionBody`), `:49` (destructure), `:78-83` (rpc call)

- [ ] **Step 1: Extend the request body type**

Replace the `CreateSessionBody` interface (lines 17-22):

```ts
interface CreateSessionBody {
  game_code: string;
  title: string;
  questions: FullQuestion[];
  ambiance_id?: string;
  max_participants?: number | null;
}
```

- [ ] **Step 2: Destructure and forward it**

Replace the destructure line (line 49):

```ts
const { game_code, title, questions, ambiance_id, max_participants } = body;
```

Replace the rpc call (lines 78-83):

```ts
const { error: rpcError } = await supabase.rpc("create_session_atomic", {
  p_game_code: game_code,
  p_title: title,
  p_public_questions: publicQuestions,
  p_private_questions: questions,
  p_ambiance_id: ambiance_id ?? "arcade",
  p_max_participants: max_participants ?? null,
});
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/create-session/index.ts
git commit -m "feat(create-session): accept and forward max_participants"
```

---

## Task 16: `JoinQuiz.tsx` — capacity check + "Session complète" screen

**Files:**
- Modify: `src/pages/JoinQuiz.tsx:10-32` (fetch helpers), `:37-39` (state), `:84-122` (effects), `:124-144` (`handleAvatarComplete`), `:161-178` (render, add capacity screen)

- [ ] **Step 1: Add a capacity-fetching helper next to `fetchRoomLocked`**

Replace lines 10-18 (the `fetchRoomLocked` block) with `fetchRoomLocked` plus a new `fetchCapacity`:

```tsx
/** Read the host's control state (room lock etc.) for a session. */
const fetchRoomLocked = async (gameCode: string): Promise<boolean> => {
  const { data } = await supabase
    .from("session_state")
    .select("control")
    .eq("game_code", gameCode)
    .single();
  return normalizeControl((data as { control?: unknown } | null)?.control).locked;
};

/** Read the baked-in participant cap (quiz_data.maxParticipants) and the
 *  current player count, so a join can be blocked once the room is full.
 *  Error-tolerant like fetchRoomLocked — a query failure just reports "not full". */
const fetchCapacity = async (gameCode: string): Promise<{ full: boolean }> => {
  const { data } = await supabase
    .from("session_state")
    .select("quiz_data, players")
    .eq("game_code", gameCode)
    .single();
  const maxParticipants = (data as { quiz_data?: { maxParticipants?: number | null } } | null)?.quiz_data?.maxParticipants;
  if (maxParticipants === null || maxParticipants === undefined) return { full: false };
  const players = (data as { players?: unknown[] } | null)?.players;
  const count = Array.isArray(players) ? players.length : 0;
  return { full: count >= maxParticipants };
};
```

- [ ] **Step 2: Add `roomFull` state**

Right after `const [roomLocked, setRoomLocked] = useState(false);` (line 39), add:

```tsx
const [roomFull, setRoomFull] = useState(false);
```

- [ ] **Step 3: Check capacity alongside the lock state**

In the effect that calls `fetchRoomLocked(gameCode).then(setRoomLocked);` (line 111), add directly below it:

```tsx
fetchCapacity(gameCode).then(({ full }) => setRoomFull(full));
```

In the 3s polling effect (lines 116-122), extend the interval body:

```tsx
useEffect(() => {
  if (!gameCode || quizExists !== true) return;
  const interval = setInterval(async () => {
    setRoomLocked(await fetchRoomLocked(gameCode));
    setRoomFull((await fetchCapacity(gameCode)).full);
  }, 3000);
  return () => clearInterval(interval);
}, [gameCode, quizExists]);
```

- [ ] **Step 4: Re-check at submit time**

In `handleAvatarComplete` (lines 124-144), add a capacity re-check alongside the existing lock re-check:

```tsx
const handleAvatarComplete = async (name: string, avatar: string) => {
  if (!gameCode) return;
  // Re-check at submit time — the host may have locked the room or it may
  // have filled up while the player was picking an avatar.
  if (await fetchRoomLocked(gameCode)) {
    setRoomLocked(true);
    toast.error("Salle verrouillée", { description: "L'hôte a fermé l'accès, impossible de rejoindre." });
    return;
  }
  if ((await fetchCapacity(gameCode)).full) {
    setRoomFull(true);
    toast.error("Session complète", { description: "Le nombre maximum de participants est atteint." });
    return;
  }
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const player = { id, name, avatar, score: 0, correctAnswers: 0, joinedAt: new Date().toISOString() };
  try {
    sessionStorage.setItem(`quiz-player-${gameCode}`, JSON.stringify(player));
  } catch {
    // ignore storage errors — PlayerView will handle missing session
  }
  navigate(`/quiz/${gameCode}?player=${encodeURIComponent(name)}`);
};
```

- [ ] **Step 5: Render the "Session complète" screen**

Right after the `roomLocked` block (after line 178), insert:

```tsx
if (roomFull) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--ap-paper)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div className="ap-card ap-card--floaty" style={{ maxWidth: 440, width: "100%", textAlign: "center", padding: "40px" }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--ap-brand-soft)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
          <Lock style={{ width: 32, height: 32, color: 'var(--ap-brand)' }} strokeWidth={2} />
        </div>
        <h2 className="ap-h2" style={{ fontSize: "24px", marginBottom: "12px" }}>Session complète</h2>
        <p className="ap-muted" style={{ fontSize: "15px", marginBottom: "24px" }}>
          Le nombre maximum de participants pour cette session est atteint.
        </p>
        <button className="ap-btn ap-btn--pill" onClick={() => navigate("/")}>
          Retour
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 7: Manual verify**

Requires the deployed migration + edge function from Tasks 14-15. Host a quiz as a starter-plan user, temporarily set `AUDIENCE_CAP.starter` to `1` in a local scratch edit for testing, join with one player (fills the room), then try to join with a second player. Expected: second player sees "Session complète". Revert the scratch edit before committing.

- [ ] **Step 8: Commit**

```bash
git add src/pages/JoinQuiz.tsx
git commit -m "feat(join): block joining once the live-session participant cap is reached"
```

---

## Task 17: `ProfilePage.tsx` — correct `PLAN_META`, add usage bars

**Files:**
- Modify: `src/pages/ProfilePage.tsx:4` (imports), `:46-74` (`PLAN_META`), `:90` (`useState`), `:102` (fallback), `:204-246` (plan card — add usage section)

- [ ] **Step 1: Update imports**

Replace line 4:

```tsx
import { getCurrentUser, updateProfile, User as AuthUser, type Theme, type Language } from "@/lib/auth";
```

Add:

```tsx
import { type Plan, CONTENT_KIND_LABELS, type ContentKind } from "@/lib/plans";
import { getContentUsage, type ContentUsage } from "@/lib/planUsage";
```

- [ ] **Step 2: Rename `perso` → `starter` and correct the numbers in `PLAN_META`**

Replace the `PLAN_META` block (lines 46-74):

```tsx
const PLAN_META: Record<Plan, {
  label: string;
  color: string;
  colorDeep: string;
  icon: React.ElementType;
  features: string[];
}> = {
  starter: {
    label: 'Starter',
    color: '--ap-brand',
    colorDeep: '--ap-brand-deep',
    icon: User,
    features: [
      '5 quiz, sondages, jeux de cartes et présentations',
      '1 cours',
      "Jusqu'à 20 participants en direct",
      'Types de questions classiques',
    ],
  },
  pro: {
    label: 'Pro',
    color: '--ap-poll',
    colorDeep: '--ap-poll-deep',
    icon: Zap,
    features: [
      'Quiz, sondages, jeux de cartes, présentations, examens et cours illimités',
      "Jusqu'à 200 participants en direct",
      'Tous les types de questions',
      'Statistiques avancées',
    ],
  },
  entreprise: {
    label: 'Entreprise',
    color: '--ap-pres',
    colorDeep: '--ap-pres-deep',
    icon: Building2,
    features: [
      'Tout Pro inclus',
      'Participants illimités',
      'Single sign-on (SSO)',
      'Marque blanche et templates personnalisés',
    ],
  },
};
```

- [ ] **Step 3: Rename the `useState` default and the fallback**

Replace line 90:

```tsx
const [plan, setPlan] = useState<Plan>("starter");
```

Replace line 102:

```tsx
setPlan(currentUser.plan || "starter");
```

- [ ] **Step 4: Add a usage state and compute it**

Right after the `stats` state block (around line 91, next to the existing `stats` `useState`), add:

```tsx
const [usage, setUsage] = useState<Record<ContentKind, ContentUsage> | null>(null);
```

In the same `useEffect` that currently sets `stats` (around line 93-109), add right after `setPlan(currentUser.plan || "starter");`:

```tsx
setUsage(getContentUsage(currentUser.id, currentUser.plan || "starter"));
```

- [ ] **Step 5: Render usage bars in the plan card**

Inside the plan-card IIFE (the `(() => { const meta = PLAN_META[plan]; ... })()` block, lines 203-246), right after the `<ul>` of features and before the `{!isEntreprise && (...)}` upgrade button, add a usage section that only renders for `starter`:

```tsx
{plan === 'starter' && usage && (
  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
    {(Object.keys(usage) as ContentKind[]).map((kind) => {
      const { used, cap } = usage[kind];
      if (cap === null) return null;
      const pct = Math.min(100, (used / cap) * 100);
      return (
        <div key={kind}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, color: "var(--ap-muted)", marginBottom: "4px", textTransform: "capitalize" }}>
            <span>{CONTENT_KIND_LABELS[kind]}</span>
            <span>{used} / {cap}</span>
          </div>
          <div style={{ height: "6px", borderRadius: "999px", background: "var(--ap-line)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: used >= cap ? "var(--ap-flash)" : "var(--ap-brand)", borderRadius: "999px" }} />
          </div>
        </div>
      );
    })}
  </div>
)}
```

- [ ] **Step 6: Fix the upgrade button's plan comparison**

Replace line 241 (`Passer à {plan === 'perso' ? 'Pro' : 'Entreprise'}`):

```tsx
Passer à {plan === 'starter' ? 'Pro' : 'Entreprise'}
```

- [ ] **Step 7: Verify no `'perso'` literal remains anywhere**

Run: `grep -rn "'perso'" src`
Expected: no output.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 9: Manual verify**

Run: `npm run dev`, open `/profile` as a starter user with a mix of content created. Expected: plan card shows "Starter", corrected feature list, and a progress bar per kind with a real "X / cap" count. Create content up to a cap and confirm the bar turns red-ish (uses the `--ap-flash` color) and reads e.g. "5 / 5".

- [ ] **Step 10: Commit**

```bash
git add src/pages/ProfilePage.tsx
git commit -m "feat(profile): rename perso to starter, show plan usage bars"
```

---

## Task 18: `i18n.ts` — reconcile Pricing copy with real caps

**Files:**
- Modify: `src/lib/i18n.ts:55-75` (EN), `:450-470` (FR)

- [ ] **Step 1: Update the English strings**

Replace lines 55-75:

```ts
    pricingPlanStarter: "Starter",
    pricingPlanStarterDesc: "Perfect for trying Brivia with small teams.",
    pricingPlanStarterPrice: "Free",
    pricingPlanStarterCta: "Create your first quiz",
    pricingStarterFeature1: "Up to 5 quizzes, polls, flashcard sets and presentations",
    pricingStarterFeature2: "1 course, classic question types only",
    pricingStarterFeature3: "Host sessions with up to 20 participants",
    pricingPlanPro: "Pro",
    pricingPlanProDesc: "For facilitators who need advanced customization and analytics.",
    pricingPlanProPrice: "$19",
    pricingPlanProCta: "Upgrade to Pro",
    pricingProFeature1: "Unlimited quizzes, polls, flashcards, presentations, exams and courses",
    pricingProFeature2: "Up to 200 live participants per session, every question type",
    pricingProFeature3: "Detailed performance reports and exports",
    pricingPlanEnterprise: "Enterprise",
    pricingPlanEnterpriseDesc: "Tailored onboarding and security for large organizations.",
    pricingPlanEnterprisePrice: "Custom",
    pricingPlanEnterpriseCta: "Contact sales",
    pricingEnterpriseFeature1: "Unlimited participants and events",
    pricingEnterpriseFeature2: "Single sign-on (SSO) and custom white-label templates",
    pricingEnterpriseFeature3: "Dedicated success manager and training",
```

- [ ] **Step 2: Update the French strings**

Replace lines 450-470:

```ts
    pricingPlanStarter: "Starter",
    pricingPlanStarterDesc: "Idéal pour découvrir Brivia avec une petite équipe.",
    pricingPlanStarterPrice: "Gratuit",
    pricingPlanStarterCta: "Créer mon premier quiz",
    pricingStarterFeature1: "Jusqu'à 5 quiz, sondages, jeux de cartes et présentations",
    pricingStarterFeature2: "1 cours, types de questions classiques uniquement",
    pricingStarterFeature3: "Jusqu'à 20 participants par session",
    pricingPlanPro: "Pro",
    pricingPlanProDesc: "Pour les animateurs qui veulent personnalisation avancée et analyses détaillées.",
    pricingPlanProPrice: "19 €",
    pricingPlanProCta: "Passer en Pro",
    pricingProFeature1: "Quiz, sondages, flashcards, présentations, examens et cours illimités",
    pricingProFeature2: "Jusqu'à 200 participants en direct, tous les types de questions",
    pricingProFeature3: "Rapports détaillés et exports de performances",
    pricingPlanEnterprise: "Entreprise",
    pricingPlanEnterpriseDesc: "Accompagnement sur-mesure et sécurité renforcée pour les grandes organisations.",
    pricingPlanEnterprisePrice: "Sur devis",
    pricingPlanEnterpriseCta: "Contacter les ventes",
    pricingEnterpriseFeature1: "Participants et événements illimités",
    pricingEnterpriseFeature2: "Single sign-on (SSO) et templates personnalisés en marque blanche",
    pricingEnterpriseFeature3: "Success manager dédié et formations",
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors (string values only, keys unchanged).

- [ ] **Step 4: Manual verify**

Run: `npm run dev`, open `/pricing` in both languages (use the language switcher). Expected: Starter/Pro/Entreprise bullets now state the real caps and match what `ProfilePage.tsx` shows.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n.ts
git commit -m "docs(pricing): reconcile Starter/Pro/Entreprise copy with enforced caps"
```

---

## Task 19: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit test suite**

Run: `npm test`
Expected: all tests pass, including the new `plans.test.ts`, `quizStorage.test.ts`, `examStorage.test.ts`, `courseStorage.test.ts`.

- [ ] **Step 2: Full typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors introduced by this feature.

- [ ] **Step 4: Deploy the migration and edge function**

Per this project's existing deploy pattern (Management API HTTPS, not direct `psql` — see project memory on the prod Supabase deploy state): apply `20260717160000_session_max_participants.sql` and redeploy the `create-session` edge function to the linked Supabase project. Confirm by creating a fresh live session and checking `session_state.quiz_data->>'maxParticipants'` is populated.

- [ ] **Step 5: End-to-end browser walkthrough**

Run: `npm run dev`. With a starter-plan test account:
1. Create 5 quizzes → 6th is blocked at `/builder-start?type=quiz`.
2. Create 1 course → 2nd is blocked at `/course-builder`.
3. Open the quiz builder, confirm advanced question types show a "Pro" badge and can't be selected.
4. Open `/profile`, confirm the plan card shows "Starter" with correct usage bars for all 6 kinds.
5. Switch the test account's `plan` to `pro` in Supabase `user_metadata`, reload, confirm all blockers disappear and `/profile` shows "illimité"/no bars.
6. Open `/pricing` and confirm the bullet copy matches what was just observed.

- [ ] **Step 6: Final commit (if any cleanup was needed)**

```bash
git status
# If clean, no commit needed. If manual-verify scratch edits were left in
# (e.g. a temporarily lowered AUDIENCE_CAP), revert them now.
```
