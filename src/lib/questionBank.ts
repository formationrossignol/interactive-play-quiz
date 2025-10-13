import { getCurrentUser } from "@/lib/auth";
import type { QuizQuestionType } from "@/lib/questionTypes";

export type QuestionDifficulty = "easy" | "medium" | "hard";

export interface QuestionBankItem {
  id: string;
  userId: string;
  title: string;
  topic?: string;
  difficulty?: QuestionDifficulty;
  tags?: string[];
  question: any;
  createdAt: string;
  updatedAt: string;
}

const QUESTION_BANK_STORAGE_KEY = "question_bank";

const generateId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getStoredQuestionBank = (): QuestionBankItem[] => {
  const stored = localStorage.getItem(QUESTION_BANK_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

const persistQuestionBank = (items: QuestionBankItem[]) => {
  localStorage.setItem(QUESTION_BANK_STORAGE_KEY, JSON.stringify(items));
};

export const getQuestionBankForUser = (userId: string): QuestionBankItem[] => {
  return getStoredQuestionBank().filter((item) => item.userId === userId);
};

export const addQuestionToBank = (
  data: Omit<QuestionBankItem, "id" | "createdAt" | "updatedAt" | "userId">
): QuestionBankItem => {
  const user = getCurrentUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  const now = new Date().toISOString();
  const newItem: QuestionBankItem = {
    ...data,
    id: generateId(),
    userId: user.id,
    createdAt: now,
    updatedAt: now,
  };

  const items = getStoredQuestionBank();
  items.push(newItem);
  persistQuestionBank(items);

  return newItem;
};

export const updateQuestionBankItem = (
  id: string,
  updates: Partial<Omit<QuestionBankItem, "id" | "userId" | "createdAt">>
): QuestionBankItem | null => {
  const items = getStoredQuestionBank();
  const index = items.findIndex((item) => item.id === id);

  if (index === -1) return null;

  const updatedItem: QuestionBankItem = {
    ...items[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  items[index] = updatedItem;
  persistQuestionBank(items);

  return updatedItem;
};

export const deleteQuestionBankItem = (id: string): boolean => {
  const items = getStoredQuestionBank();
  const filtered = items.filter((item) => item.id !== id);

  if (filtered.length === items.length) {
    return false;
  }

  persistQuestionBank(filtered);
  return true;
};

export const duplicateQuestionBankItem = (id: string): QuestionBankItem | null => {
  const items = getStoredQuestionBank();
  const item = items.find((entry) => entry.id === id);

  if (!item) {
    return null;
  }

  const clone = {
    ...item,
    id: generateId(),
    title: `${item.title} (copy)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  items.push(clone);
  persistQuestionBank(items);

  return clone;
};

export const getQuestionBankItemById = (id: string): QuestionBankItem | null => {
  const items = getStoredQuestionBank();
  return items.find((item) => item.id === id) ?? null;
};

export const sanitizeQuestionForBank = (question: any) => {
  if (!question) return question;

  const sanitized = { ...question };

  if (!sanitized.type) {
    sanitized.type = "multiple-choice" as QuizQuestionType;
  }

  return sanitized;
};
