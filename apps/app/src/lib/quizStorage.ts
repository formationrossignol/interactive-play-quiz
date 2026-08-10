import { getCurrentUser } from './auth';
import { CONTENT_CAPS, getPlan, PlanLimitError, type ContentKind } from './plans';
import { StorageQuotaError } from './errorTaxonomy';

export interface SavedQuiz {
  id: string;
  title: string;
  description: string;
  // Heterogeneous stored question shapes (quiz/poll/flashcard/slide) — kept
  // loose deliberately; the strict Question union is narrower than runtime data.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  questions: any[];
  createdAt: string;
  userId: string;
  isPublic: boolean;
  isFavorite: boolean;
  /** Marks this item as a reusable starting point rather than live content — surfaced in the "Mes modèles" shortcut. */
  isTemplate?: boolean;
  tags: string[];
  speedBonus: boolean;
  transitionTime: number;
  /** Pause (seconds) before the answer countdown starts, so players can read the question. Quiz only. */
  readingTime?: number;
  category: string;
  type: 'quiz' | 'poll' | 'flashcard' | 'slide';
  headerImage?: string;
  theme?: string;
  font?: string;
  ambianceId?: string;
  /** Player emoji reactions during the lobby and final screen. Defaults to true for legacy quizzes. */
  liveReactionsEnabled?: boolean;
  /** Player text chat shown at the end of a live quiz. Defaults to true for legacy quizzes. */
  endChatEnabled?: boolean;
  /** Optional one-time purchase configuration. It is effective only while the quiz is public. */
  monetization?: {
    enabled: boolean;
    priceCents: number;
    currency: 'eur';
  };
  creatorName?: string;
  rating?: number;
  ratingCount?: number;
  folderId?: string | null;
  deletedAt?: string;
  trashedFromFolderId?: string | null;
}

export const QUIZ_STORAGE_KEY = 'saved_quizzes';

function isQuotaExceeded(e: unknown): boolean {
  return e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
}

/** Frees space by dropping every stale `quiz-`/`poll-` one-shot play-cache
 *  entry (written by setQuizPlayCache below). These accumulate forever — one
 *  per quiz ever launched on this device — and are never cleaned up
 *  elsewhere, so a long-lived browser profile eventually blows the
 *  localStorage quota on an unrelated write. `exceptKey` protects the entry
 *  the caller is about to (re)write from being purged out from under itself. */
function purgeStalePlayCaches(exceptKey?: string): void {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k !== exceptKey && (k.startsWith('quiz-') || k.startsWith('poll-'))) {
      localStorage.removeItem(k);
    }
  }
}

/** Writes a one-shot `quiz-<code>`/`poll-<code>` play cache entry. On
 *  QuotaExceededError, purges stale entries (see purgeStalePlayCaches) and
 *  retries once. */
export function setQuizPlayCache(key: string, value: unknown): void {
  const payload = JSON.stringify(value);
  try {
    localStorage.setItem(key, payload);
  } catch {
    purgeStalePlayCaches(key);
    try {
      localStorage.setItem(key, payload);
    } catch {
      // Still full after purge (huge single quiz, or quota consumed by
      // unrelated keys) — swallow so play navigation isn't blocked; the
      // player screen re-fetches from Supabase when the cache is empty.
    }
  }
}

/** Quota-safe write for the `saved_quizzes` blob itself: on
 *  QuotaExceededError, purges stale play caches (the usual growth driver)
 *  and retries once before giving up with an actionable StorageQuotaError —
 *  callers (QuizBuilder.save et al.) previously let the raw DOMException
 *  bubble up as an unclassified crash. */
export function writeQuizStore(quizzes: SavedQuiz[]): void {
  const payload = JSON.stringify(quizzes);
  try {
    localStorage.setItem(QUIZ_STORAGE_KEY, payload);
  } catch (e) {
    if (!isQuotaExceeded(e)) throw e;
    purgeStalePlayCaches();
    try {
      localStorage.setItem(QUIZ_STORAGE_KEY, payload);
    } catch {
      throw new StorageQuotaError(
        "Stockage local plein. Ce contenu est trop volumineux pour cet appareil — réduisez la taille des images ou supprimez d'anciens quiz, puis réessayez.",
      );
    }
  }
}

/** 6-char game code, same non-ambiguous alphabet as examStorage.ts's
 *  genJoinCode (excludes I/O/0/1) — replaces the old 6-digit-numeric-only
 *  format (900,000 combinations, enumerable) with ~1.07 billion. Existing
 *  numeric ids already stored keep working: they're a subset of validGameCode
 *  below, so nothing forces a re-migration of quizzes created before this
 *  changed. */
const GAME_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function genGameCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += GAME_CODE_ALPHABET[Math.floor(Math.random() * GAME_CODE_ALPHABET.length)];
  return code;
}
const validGameCode = /^[A-Z0-9]{6}$/;

export const getSavedQuizzes = (): SavedQuiz[] => {
  try {
    const quizzesStr = localStorage.getItem(QUIZ_STORAGE_KEY);
    const quizzes: SavedQuiz[] = quizzesStr ? (JSON.parse(quizzesStr) as SavedQuiz[]) : [];

    // Migrate legacy ids that don't even look like a game code (free-form
    // strings predating game codes entirely) — anything already 6 alphanumeric
    // chars, digits-only or not, is left as-is.
    const existing = new Set(quizzes.filter(q => validGameCode.test(q.id)).map(q => q.id));
    let didMigrate = false;
    const migrated = quizzes.map(q => {
      if (validGameCode.test(q.id)) return q;
      let newId: string;
      do { newId = genGameCode(); }
      while (existing.has(newId));
      existing.add(newId);
      didMigrate = true;
      return { ...q, id: newId };
    });
    // Best-effort: a quota failure here must not make getSavedQuizzes() look
    // empty (its own try/catch below would otherwise swallow it and return
    // []) — the migrated ids are still valid to use in-memory even if this
    // particular write never lands.
    if (didMigrate) { try { writeQuizStore(migrated); } catch { /* retried on next read */ } }

    return migrated;
  } catch {
    return [];
  }
};

export const getUserQuizzes = (userId: string): SavedQuiz[] => {
  return getSavedQuizzes().filter(q => q.userId === userId && !q.deletedAt);
};

export const getPublicQuizzes = (): SavedQuiz[] => {
  return getSavedQuizzes().filter(q => q.isPublic && !q.deletedAt);
};

export const getFavoriteQuizzes = (userId: string): SavedQuiz[] => {
  return getSavedQuizzes().filter(q => q.userId === userId && q.isFavorite && !q.deletedAt);
};

export const getUserFlashcardSets = (userId: string): SavedQuiz[] => {
  return getSavedQuizzes().filter((q) => q.userId === userId && q.type === 'flashcard' && !q.deletedAt);
};

export const getFavoriteFlashcardSets = (userId: string): SavedQuiz[] => {
  return getSavedQuizzes().filter((q) => q.userId === userId && q.type === 'flashcard' && q.isFavorite && !q.deletedAt);
};

export const getPublicFlashcardSets = (): SavedQuiz[] => {
  return getSavedQuizzes().filter((q) => q.type === 'flashcard' && q.isPublic && !q.deletedAt);
};

export const getTrashedItems = (userId: string, type?: SavedQuiz['type']): SavedQuiz[] => {
  return getSavedQuizzes().filter(q =>
    q.userId === userId && !!q.deletedAt && (!type || q.type === type)
  );
};

export const purgeExpiredTrash = (userId: string): void => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const all = getSavedQuizzes();
  const kept = all.filter(q => {
    if (q.userId !== userId || !q.deletedAt) return true;
    return new Date(q.deletedAt) > cutoff;
  });
  if (kept.length !== all.length) {
    writeQuizStore(kept);
  }
};

export const saveQuiz = (
  quiz: Omit<SavedQuiz, 'id' | 'createdAt' | 'userId' | 'speedBonus' | 'transitionTime' | 'category'> &
    Partial<Pick<SavedQuiz, 'speedBonus' | 'transitionTime' | 'category'>>,
): SavedQuiz => {
  const user = getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  const type = quiz.type || 'quiz';
  const plan = getPlan(user);
  const cap = CONTENT_CAPS[plan][type as ContentKind];
  if (cap !== null) {
    const used = getUserQuizzes(user.id).filter((q) => q.type === type).length;
    if (used >= cap) throw new PlanLimitError(type as ContentKind, cap, plan);
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
      do { candidate = genGameCode(); }
      while (existing.has(candidate));
      return candidate;
    })(),
    createdAt: new Date().toISOString(),
    userId: user.id
  };
  
  const quizzes = getSavedQuizzes();
  quizzes.push(newQuiz);
  writeQuizStore(quizzes);

  return newQuiz;
};

// Internal write — no ownership check. Used by rateQuiz which operates on others' public quizzes.
const writeQuiz = (id: string, updates: Partial<SavedQuiz>): SavedQuiz | null => {
  const quizzes = getSavedQuizzes();
  const index = quizzes.findIndex(q => q.id === id);
  if (index === -1) return null;
  quizzes[index] = { ...quizzes[index], ...updates };
  writeQuizStore(quizzes);
  return quizzes[index];
};

export const updateQuiz = (id: string, updates: Partial<SavedQuiz>): SavedQuiz | null => {
  const user = getCurrentUser();
  const quizzes = getSavedQuizzes();
  const index = quizzes.findIndex(q => q.id === id);

  if (index === -1) return null;
  if (!user || quizzes[index].userId !== user.id) return null;

  return writeQuiz(id, updates);
};

export const deleteQuiz = (id: string): boolean => {
  const user = getCurrentUser();
  if (!user) return false;
  const quizzes = getSavedQuizzes();
  const index = quizzes.findIndex(q => q.id === id);
  if (index === -1) return false;
  if (quizzes[index].userId !== user.id) return false;
  quizzes[index] = {
    ...quizzes[index],
    deletedAt: new Date().toISOString(),
    trashedFromFolderId: quizzes[index].folderId ?? null,
    folderId: null,
  };
  writeQuizStore(quizzes);
  return true;
};

export const permanentlyDeleteQuiz = (id: string): boolean => {
  const user = getCurrentUser();
  if (!user) return false;
  const quizzes = getSavedQuizzes();
  const quiz = quizzes.find(q => q.id === id);
  if (!quiz || quiz.userId !== user.id) return false;
  writeQuizStore(quizzes.filter(q => q.id !== id));
  return true;
};

export const restoreFromTrash = (id: string): SavedQuiz | null => {
  const user = getCurrentUser();
  if (!user) return null;
  const quizzes = getSavedQuizzes();
  const index = quizzes.findIndex(q => q.id === id);
  if (index === -1) return null;
  if (quizzes[index].userId !== user.id) return null;
  quizzes[index] = {
    ...quizzes[index],
    deletedAt: undefined,
    folderId: quizzes[index].trashedFromFolderId ?? null,
    trashedFromFolderId: undefined,
  };
  writeQuizStore(quizzes);
  return quizzes[index];
};

export const toggleFavorite = (id: string): SavedQuiz | null => {
  const quizzes = getSavedQuizzes();
  const quiz = quizzes.find(q => q.id === id);

  if (!quiz) return null;

  return updateQuiz(id, { isFavorite: !quiz.isFavorite });
};

const RATINGS_STORAGE_KEY = 'quiz_user_ratings';

export const rateQuiz = (id: string, rating: number): SavedQuiz | null => {
  const user = getCurrentUser();
  if (!user) return null;

  const quizzes = getSavedQuizzes();
  const quiz = quizzes.find(q => q.id === id);

  if (!quiz || !quiz.isPublic) return null;

  // Prevent the same user from rating the same quiz twice
  const ratingsStr = localStorage.getItem(RATINGS_STORAGE_KEY);
  let ratings: Record<string, string[]> = {};
  try { ratings = ratingsStr ? JSON.parse(ratingsStr) : {}; } catch { ratings = {}; }
  const userRated = ratings[user.id] ?? [];
  if (userRated.includes(id)) return quiz;
  ratings[user.id] = [...userRated, id];
  localStorage.setItem(RATINGS_STORAGE_KEY, JSON.stringify(ratings));

  const currentRating = quiz.rating || 0;
  const currentCount = quiz.ratingCount || 0;
  const newCount = currentCount + 1;
  const newRating = (currentRating * currentCount + rating) / newCount;

  // Use internal write — rater doesn't own the quiz
  return writeQuiz(id, { rating: newRating, ratingCount: newCount });
};

export const getQuizById = (id: string): SavedQuiz | null => {
  const quizzes = getSavedQuizzes();
  return quizzes.find(q => q.id === id) || null;
};

export const duplicateQuiz = (id: string): SavedQuiz | null => {
  const user = getCurrentUser();
  if (!user) return null;
  const original = getQuizById(id);
  if (!original || original.userId !== user.id) return null;

  const plan = getPlan(user);
  const cap = CONTENT_CAPS[plan][original.type as ContentKind];
  if (cap !== null) {
    const used = getUserQuizzes(user.id).filter((q) => q.type === original.type).length;
    if (used >= cap) throw new PlanLimitError(original.type as ContentKind, cap, plan);
  }

  const existing = new Set(getSavedQuizzes().map((q) => q.id));
  let newId: string;
  do { newId = genGameCode(); }
  while (existing.has(newId));

  const copy: SavedQuiz = {
    ...original,
    id: newId,
    title: `Copie de ${original.title}`,
    createdAt: new Date().toISOString(),
    isFavorite: false,
    isTemplate: false,
    rating: undefined,
    ratingCount: undefined,
    folderId: original.folderId ?? null,
  };

  const quizzes = getSavedQuizzes();
  quizzes.push(copy);
  writeQuizStore(quizzes);
  return copy;
};

/** Clones `id` into a new item flagged `isTemplate: true` — the "Enregistrer
 *  comme template" action in the builder. Reuses "Dupliquer" (already resets
 *  isTemplate on its own copies) so instantiating a template back into
 *  regular content is just the existing duplicate flow. */
export const saveQuizAsTemplate = (id: string): SavedQuiz | null => {
  const user = getCurrentUser();
  if (!user) return null;
  const original = getQuizById(id);
  if (!original || original.userId !== user.id) return null;

  const plan = getPlan(user);
  const cap = CONTENT_CAPS[plan][original.type as ContentKind];
  if (cap !== null) {
    const used = getUserQuizzes(user.id).filter((q) => q.type === original.type).length;
    if (used >= cap) throw new PlanLimitError(original.type as ContentKind, cap, plan);
  }

  const existing = new Set(getSavedQuizzes().map((q) => q.id));
  let newId: string;
  do { newId = genGameCode(); }
  while (existing.has(newId));

  const template: SavedQuiz = {
    ...original,
    id: newId,
    title: `Modèle : ${original.title}`,
    createdAt: new Date().toISOString(),
    isFavorite: false,
    isTemplate: true,
    isPublic: false,
    rating: undefined,
    ratingCount: undefined,
    folderId: null,
  };

  const quizzes = getSavedQuizzes();
  quizzes.push(template);
  writeQuizStore(quizzes);
  return template;
};
