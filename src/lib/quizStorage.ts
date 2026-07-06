import { getCurrentUser } from './auth';

export interface SavedQuiz {
  id: string;
  title: string;
  description: string;
  questions: any[];
  createdAt: string;
  userId: string;
  isPublic: boolean;
  isFavorite: boolean;
  tags: string[];
  speedBonus: boolean;
  transitionTime: number;
  category: string;
  type: 'quiz' | 'poll' | 'flashcard' | 'slide';
  headerImage?: string;
  theme?: string;
  font?: string;
  rating?: number;
  ratingCount?: number;
  folderId?: string | null;
  deletedAt?: string;
  trashedFromFolderId?: string | null;
}

export const QUIZ_STORAGE_KEY = 'saved_quizzes';

export const getSavedQuizzes = (): SavedQuiz[] => {
  try {
    const quizzesStr = localStorage.getItem(QUIZ_STORAGE_KEY);
    const quizzes: SavedQuiz[] = quizzesStr ? (JSON.parse(quizzesStr) as SavedQuiz[]) : [];

    // Migrate legacy non-6-digit IDs to proper game codes
    const valid6 = /^\d{6}$/;
    const existing = new Set(quizzes.filter(q => valid6.test(q.id)).map(q => q.id));
    let didMigrate = false;
    const migrated = quizzes.map(q => {
      if (valid6.test(q.id)) return q;
      let newId: string;
      do { newId = (Math.floor(Math.random() * 900000) + 100000).toString(); }
      while (existing.has(newId));
      existing.add(newId);
      didMigrate = true;
      return { ...q, id: newId };
    });
    if (didMigrate) localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(migrated));

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
    localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(kept));
  }
};

export const saveQuiz = (quiz: Omit<SavedQuiz, 'id' | 'createdAt' | 'userId'>): SavedQuiz => {
  const user = getCurrentUser();
  if (!user) throw new Error('User not authenticated');
  
  const newQuiz: SavedQuiz = {
    ...quiz,
    tags: quiz.tags || [],
    speedBonus: quiz.speedBonus ?? true,
    transitionTime: quiz.transitionTime ?? 5,
    category: quiz.category || 'Autre',
    type: quiz.type || 'quiz',
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

// Internal write — no ownership check. Used by rateQuiz which operates on others' public quizzes.
const writeQuiz = (id: string, updates: Partial<SavedQuiz>): SavedQuiz | null => {
  const quizzes = getSavedQuizzes();
  const index = quizzes.findIndex(q => q.id === id);
  if (index === -1) return null;
  quizzes[index] = { ...quizzes[index], ...updates };
  localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(quizzes));
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
  localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(quizzes));
  return true;
};

export const permanentlyDeleteQuiz = (id: string): boolean => {
  const user = getCurrentUser();
  if (!user) return false;
  const quizzes = getSavedQuizzes();
  const quiz = quizzes.find(q => q.id === id);
  if (!quiz || quiz.userId !== user.id) return false;
  localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(quizzes.filter(q => q.id !== id)));
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
  localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(quizzes));
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
