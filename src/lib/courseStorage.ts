import { getCurrentUser } from './auth';
import { CONTENT_CAPS, getPlan, PlanLimitError } from './plans';

export interface Lesson {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'quiz' | 'flashcard' | 'document' | 'video';
  linkedItemId?: string;
  estimatedMinutes?: number;
  documentName?: string;
  documentMimeType?: string;
  videoUrl?: string;
  videoType?: 'youtube' | 'url';
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  userId: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  isFavorite: boolean;
  modules: Module[];
  coverImage?: string;
  category: string;
  tags: string[];
  deletedAt?: string;
}

export interface CourseProgress {
  courseId: string;
  userId: string;
  completedLessonIds: string[];
  startedAt: string;
  lastAccessedAt: string;
}

const COURSES_KEY = 'lms_courses';
const PROGRESS_KEY = 'lms_progress';

export const genId = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const getAllCourses = (): Course[] => {
  try {
    const raw = localStorage.getItem(COURSES_KEY);
    return raw ? (JSON.parse(raw) as Course[]) : [];
  } catch { return []; }
};

const writeAllCourses = (courses: Course[]): void => {
  try {
    localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      throw new Error('Stockage plein. Réduisez la taille des fichiers importés ou supprimez des cours.');
    }
    throw e;
  }
};

export const getUserCourses = (userId: string): Course[] =>
  getAllCourses().filter((c) => c.userId === userId && !c.deletedAt);

export const getPublicCourses = (): Course[] =>
  getAllCourses().filter((c) => c.isPublic && !c.deletedAt);

export const getFavoriteCourses = (userId: string): Course[] =>
  getAllCourses().filter((c) => c.userId === userId && c.isFavorite && !c.deletedAt);

export const getTrashedCourses = (userId: string): Course[] =>
  getAllCourses().filter((c) => c.userId === userId && !!c.deletedAt);

export const getCourseById = (id: string): Course | null =>
  getAllCourses().find((c) => c.id === id) ?? null;

export const createCourse = (
  data: Omit<Course, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
): Course => {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const plan = getPlan(user);
  const cap = CONTENT_CAPS[plan].course;
  if (cap !== null && getUserCourses(user.id).length >= cap) throw new PlanLimitError('course', cap, plan);

  const now = new Date().toISOString();
  const course: Course = { ...data, id: genId(), userId: user.id, createdAt: now, updatedAt: now };
  const all = getAllCourses();
  all.push(course);
  writeAllCourses(all);
  return course;
};

export const updateCourse = (id: string, updates: Partial<Course>): Course | null => {
  const user = getCurrentUser();
  if (!user) return null;
  const all = getAllCourses();
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1 || all[idx].userId !== user.id) return null;
  all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
  writeAllCourses(all);
  return all[idx];
};

export const duplicateCourse = (id: string): Course | null => {
  const user = getCurrentUser();
  if (!user) return null;
  const orig = getCourseById(id);
  if (!orig || orig.userId !== user.id) return null;

  const plan = getPlan(user);
  const cap = CONTENT_CAPS[plan].course;
  if (cap !== null && getUserCourses(user.id).length >= cap) throw new PlanLimitError('course', cap, plan);

  const now = new Date().toISOString();
  const copy: Course = {
    ...orig,
    id: genId(),
    title: `Copie de ${orig.title}`,
    createdAt: now,
    updatedAt: now,
    isFavorite: false,
    deletedAt: undefined,
    modules: orig.modules.map((m) => ({
      ...m,
      id: genId(),
      lessons: m.lessons.map((l) => ({ ...l, id: genId() })),
    })),
  };
  const all = getAllCourses();
  all.push(copy);
  writeAllCourses(all);
  return copy;
};

export const trashCourse = (id: string): boolean =>
  !!updateCourse(id, { deletedAt: new Date().toISOString() });

export const permanentlyDeleteCourse = (id: string): boolean => {
  const user = getCurrentUser();
  if (!user) return false;
  const all = getAllCourses();
  const course = all.find((c) => c.id === id);
  if (!course || course.userId !== user.id) return false;
  writeAllCourses(all.filter((c) => c.id !== id));
  return true;
};

export const restoreCourse = (id: string): Course | null =>
  updateCourse(id, { deletedAt: undefined });

export const toggleCourseFavorite = (id: string): Course | null => {
  const course = getCourseById(id);
  if (!course) return null;
  return updateCourse(id, { isFavorite: !course.isFavorite });
};

export const purgeExpiredCourses = (userId: string): void => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const all = getAllCourses();
  const kept = all.filter((c) => {
    if (c.userId !== userId || !c.deletedAt) return true;
    return new Date(c.deletedAt) > cutoff;
  });
  if (kept.length !== all.length) writeAllCourses(kept);
};

// Progress

const getAllProgress = (): CourseProgress[] => {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as CourseProgress[]) : [];
  } catch { return []; }
};

const writeAllProgress = (progress: CourseProgress[]): void => {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
};

export const getCourseProgress = (courseId: string, userId: string): CourseProgress | null =>
  getAllProgress().find((p) => p.courseId === courseId && p.userId === userId) ?? null;

export const markLessonComplete = (
  courseId: string,
  lessonId: string,
  userId: string,
): CourseProgress => {
  const all = getAllProgress();
  const idx = all.findIndex((p) => p.courseId === courseId && p.userId === userId);
  const now = new Date().toISOString();
  if (idx === -1) {
    const prog: CourseProgress = {
      courseId,
      userId,
      completedLessonIds: [lessonId],
      startedAt: now,
      lastAccessedAt: now,
    };
    all.push(prog);
    writeAllProgress(all);
    return prog;
  }
  if (!all[idx].completedLessonIds.includes(lessonId)) {
    all[idx].completedLessonIds.push(lessonId);
  }
  all[idx].lastAccessedAt = now;
  writeAllProgress(all);
  return all[idx];
};

export const unmarkLessonComplete = (
  courseId: string,
  lessonId: string,
  userId: string,
): void => {
  const all = getAllProgress();
  const idx = all.findIndex((p) => p.courseId === courseId && p.userId === userId);
  if (idx === -1) return;
  all[idx].completedLessonIds = all[idx].completedLessonIds.filter((id) => id !== lessonId);
  all[idx].lastAccessedAt = new Date().toISOString();
  writeAllProgress(all);
};

export const resetCourseProgress = (courseId: string, userId: string): void => {
  writeAllProgress(getAllProgress().filter((p) => !(p.courseId === courseId && p.userId === userId)));
};
