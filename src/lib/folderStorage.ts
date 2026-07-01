import { getSavedQuizzes, QUIZ_STORAGE_KEY } from './quizStorage';
import type { SavedQuiz } from './quizStorage';

const FOLDERS_KEY = 'content_folders';

export interface Folder {
  id: string;
  name: string;
  userId: string;
  type: 'quiz' | 'poll' | 'flashcard';
  createdAt: string;
}

const getAllFolders = (): Folder[] => {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    return raw ? (JSON.parse(raw) as Folder[]) : [];
  } catch {
    return [];
  }
};

const writeFolders = (folders: Folder[]): void => {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
};

export const getFolders = (userId: string, type: Folder['type']): Folder[] => {
  return getAllFolders()
    .filter((f) => f.userId === userId && f.type === type)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
};

export const createFolder = (name: string, userId: string, type: Folder['type']): Folder => {
  const existing = new Set(getAllFolders().map((f) => f.id));
  let id: string;
  do { id = Math.random().toString(36).slice(2, 10); }
  while (existing.has(id));

  const folder: Folder = { id, name: name.trim(), userId, type, createdAt: new Date().toISOString() };
  const folders = getAllFolders();
  folders.push(folder);
  writeFolders(folders);
  return folder;
};

export const renameFolder = (id: string, name: string): Folder | null => {
  const folders = getAllFolders();
  const idx = folders.findIndex((f) => f.id === id);
  if (idx === -1) return null;
  folders[idx] = { ...folders[idx], name: name.trim() };
  writeFolders(folders);
  return folders[idx];
};

export const deleteFolder = (id: string): boolean => {
  const folders = getAllFolders();
  const idx = folders.findIndex((f) => f.id === id);
  if (idx === -1) return false;

  // Move items in this folder back to root
  const quizzes = getSavedQuizzes();
  const updated = quizzes.map((q) => (q.folderId === id ? { ...q, folderId: null } : q));
  localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(updated));

  writeFolders(folders.filter((f) => f.id !== id));
  return true;
};

export const moveToFolder = (quizId: string, folderId: string | null): boolean => {
  const quizzes = getSavedQuizzes();
  const idx = quizzes.findIndex((q) => q.id === quizId);
  if (idx === -1) return false;
  quizzes[idx] = { ...quizzes[idx], folderId };
  localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(quizzes));
  return true;
};

export const getFolderItemCount = (folderId: string, userId: string, type: SavedQuiz['type']): number => {
  return getSavedQuizzes().filter(
    (q) => q.folderId === folderId && q.userId === userId && q.type === type,
  ).length;
};
