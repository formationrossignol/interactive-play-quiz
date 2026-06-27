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
}

const QUIZ_STORAGE_KEY = 'saved_quizzes';

export const getSavedQuizzes = (): SavedQuiz[] => {
  try {
    const quizzesStr = localStorage.getItem(QUIZ_STORAGE_KEY);
    return quizzesStr ? (JSON.parse(quizzesStr) as SavedQuiz[]) : [];
  } catch {
    return [];
  }
};

export const getUserQuizzes = (userId: string): SavedQuiz[] => {
  return getSavedQuizzes().filter(q => q.userId === userId);
};

export const getPublicQuizzes = (): SavedQuiz[] => {
  return getSavedQuizzes().filter(q => q.isPublic);
};

export const getFavoriteQuizzes = (userId: string): SavedQuiz[] => {
  return getSavedQuizzes().filter(q => q.userId === userId && q.isFavorite);
};

export const getUserFlashcardSets = (userId: string): SavedQuiz[] => {
  return getSavedQuizzes().filter((q) => q.userId === userId && q.type === 'flashcard');
};

export const getFavoriteFlashcardSets = (userId: string): SavedQuiz[] => {
  return getSavedQuizzes().filter((q) => q.userId === userId && q.type === 'flashcard' && q.isFavorite);
};

export const getPublicFlashcardSets = (): SavedQuiz[] => {
  return getSavedQuizzes().filter((q) => q.type === 'flashcard' && q.isPublic);
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

export const updateQuiz = (id: string, updates: Partial<SavedQuiz>): SavedQuiz | null => {
  const quizzes = getSavedQuizzes();
  const index = quizzes.findIndex(q => q.id === id);
  
  if (index === -1) return null;
  
  quizzes[index] = { ...quizzes[index], ...updates };
  localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(quizzes));
  
  return quizzes[index];
};

export const deleteQuiz = (id: string): boolean => {
  const quizzes = getSavedQuizzes();
  const filtered = quizzes.filter(q => q.id !== id);
  
  if (filtered.length === quizzes.length) return false;
  
  localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(filtered));
  return true;
};

export const toggleFavorite = (id: string): SavedQuiz | null => {
  const quizzes = getSavedQuizzes();
  const quiz = quizzes.find(q => q.id === id);
  
  if (!quiz) return null;
  
  return updateQuiz(id, { isFavorite: !quiz.isFavorite });
};

export const rateQuiz = (id: string, rating: number): SavedQuiz | null => {
  const quizzes = getSavedQuizzes();
  const quiz = quizzes.find(q => q.id === id);
  
  if (!quiz || !quiz.isPublic) return null;
  
  const currentRating = quiz.rating || 0;
  const currentCount = quiz.ratingCount || 0;
  const newCount = currentCount + 1;
  const newRating = (currentRating * currentCount + rating) / newCount;
  
  return updateQuiz(id, { 
    rating: newRating,
    ratingCount: newCount 
  });
};

export const getQuizById = (id: string): SavedQuiz | null => {
  const quizzes = getSavedQuizzes();
  return quizzes.find(q => q.id === id) || null;
};
