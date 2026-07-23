import { getCurrentUser } from './auth';
import { CONTENT_CAPS, getPlan, PlanLimitError } from './plans';

export interface Lesson {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'quiz' | 'poll' | 'flashcard' | 'document' | 'video' | 'iframe' | 'file-upload';
  linkedItemId?: string; // quiz/poll/flashcard: id of the linked saved_quizzes item
  estimatedMinutes?: number;
  documentName?: string;
  documentMimeType?: string;
  videoUrl?: string;
  videoType?: 'youtube' | 'url';
  iframeUrl?: string; // iframe: embedded page URL
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
  overview?: string; // longer intro shown at the top of the course viewer
  objectives?: string[]; // bullet list of learning objectives
}

export interface CourseProgress {
  courseId: string;
  userId: string;
  completedLessonIds: string[];
  startedAt: string;
  lastAccessedAt: string;
}

/** A learner's file submission for a 'file-upload' lesson (one per learner per lesson; resubmitting replaces it). */
export interface CourseSubmission {
  id: string;
  courseId: string;
  lessonId: string;
  userId: string;
  fileName: string;
  fileUrl: string; // data URL, same storage approach as course cover images
  submittedAt: string;
}

/** A learner's rating + written review of a course (one per learner per course). */
export interface CourseReview {
  id: string;
  courseId: string;
  userId: string;
  userName: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
}

const COURSES_KEY = 'lms_courses';
const PROGRESS_KEY = 'lms_progress';
const SUBMISSIONS_KEY = 'lms_submissions';
const REVIEWS_KEY = 'lms_course_reviews';

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

// File-upload submissions

const getAllSubmissions = (): CourseSubmission[] => {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_KEY);
    return raw ? (JSON.parse(raw) as CourseSubmission[]) : [];
  } catch { return []; }
};

const writeAllSubmissions = (submissions: CourseSubmission[]): void => {
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions));
};

export const getSubmission = (courseId: string, lessonId: string, userId: string): CourseSubmission | null =>
  getAllSubmissions().find((s) => s.courseId === courseId && s.lessonId === lessonId && s.userId === userId) ?? null;

/** Submits (or replaces) the learner's file for a file-upload lesson. */
export const submitLessonFile = (
  courseId: string,
  lessonId: string,
  fileName: string,
  fileUrl: string,
): CourseSubmission => {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const all = getAllSubmissions();
  const idx = all.findIndex((s) => s.courseId === courseId && s.lessonId === lessonId && s.userId === user.id);
  const submission: CourseSubmission = {
    id: idx >= 0 ? all[idx].id : genId(),
    courseId,
    lessonId,
    userId: user.id,
    fileName,
    fileUrl,
    submittedAt: new Date().toISOString(),
  };
  if (idx >= 0) all[idx] = submission; else all.push(submission);
  writeAllSubmissions(all);
  return submission;
};

export const removeSubmission = (courseId: string, lessonId: string, userId: string): void => {
  writeAllSubmissions(getAllSubmissions().filter((s) => !(s.courseId === courseId && s.lessonId === lessonId && s.userId === userId)));
};

// Ratings & reviews

const getAllReviews = (): CourseReview[] => {
  try {
    const raw = localStorage.getItem(REVIEWS_KEY);
    return raw ? (JSON.parse(raw) as CourseReview[]) : [];
  } catch { return []; }
};

const writeAllReviews = (reviews: CourseReview[]): void => {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
};

export const getCourseReviews = (courseId: string): CourseReview[] =>
  getAllReviews()
    .filter((r) => r.courseId === courseId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const getUserCourseReview = (courseId: string, userId: string): CourseReview | null =>
  getAllReviews().find((r) => r.courseId === courseId && r.userId === userId) ?? null;

export const getCourseRatingSummary = (courseId: string): { average: number; count: number } => {
  const reviews = getCourseReviews(courseId);
  if (reviews.length === 0) return { average: 0, count: 0 };
  const sum = reviews.reduce((s, r) => s + r.rating, 0);
  return { average: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length };
};

/** Submits (or replaces) the learner's rating + review for a course. */
export const submitCourseReview = (courseId: string, rating: number, comment: string): CourseReview => {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const all = getAllReviews();
  const idx = all.findIndex((r) => r.courseId === courseId && r.userId === user.id);
  const review: CourseReview = {
    id: idx >= 0 ? all[idx].id : genId(),
    courseId,
    userId: user.id,
    userName: user.username,
    rating: Math.min(5, Math.max(1, Math.round(rating))),
    comment: comment.trim(),
    createdAt: new Date().toISOString(),
  };
  if (idx >= 0) all[idx] = review; else all.push(review);
  writeAllReviews(all);
  return review;
};
