import { getCurrentUser } from "./auth";
import {
  genId,
  getCourseById,
  getCourseProgress,
  type Course,
} from "./courseStorage";

export interface LearningPathStep {
  id: string;
  courseId: string;
  prerequisiteStepIds: string[];
  requiredCompletionPercentage: number;
}

export interface LearningPath {
  id: string;
  userId: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  isSequential: boolean;
  steps: LearningPathStep[];
}

export interface LearningPathStepState {
  step: LearningPathStep;
  course: Course | null;
  progressPercentage: number;
  isComplete: boolean;
  isLocked: boolean;
  unmetPrerequisiteStepIds: string[];
}

export interface LearningPathProgress {
  completedSteps: number;
  totalSteps: number;
  progressPercentage: number;
  isComplete: boolean;
  steps: LearningPathStepState[];
}

const LEARNING_PATHS_KEY = "lms_learning_paths";

const clampPercentage = (value: number): number =>
  Math.min(100, Math.max(1, Math.round(value)));

const getAllLearningPaths = (): LearningPath[] => {
  try {
    const raw = localStorage.getItem(LEARNING_PATHS_KEY);
    return raw ? (JSON.parse(raw) as LearningPath[]) : [];
  } catch {
    return [];
  }
};

const writeAllLearningPaths = (paths: LearningPath[]): void => {
  localStorage.setItem(LEARNING_PATHS_KEY, JSON.stringify(paths));
};

const normalizeStep = (step: LearningPathStep): LearningPathStep => ({
  ...step,
  prerequisiteStepIds: [...new Set(step.prerequisiteStepIds)].filter((id) => id !== step.id),
  requiredCompletionPercentage: clampPercentage(step.requiredCompletionPercentage),
});

const normalizePath = (path: LearningPath): LearningPath => {
  const previousStepIds = new Set<string>();
  const steps = path.steps.map((step) => {
    const normalized = normalizeStep(step);
    const prerequisiteStepIds = normalized.prerequisiteStepIds.filter((id) => previousStepIds.has(id));
    previousStepIds.add(normalized.id);
    return { ...normalized, prerequisiteStepIds };
  });
  return {
    ...path,
    title: path.title.trim(),
    description: path.description.trim(),
    steps,
  };
};

export const getUserLearningPaths = (userId: string): LearningPath[] =>
  getAllLearningPaths()
    .filter((path) => path.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

export const getLearningPathById = (id: string): LearningPath | null =>
  getAllLearningPaths().find((path) => path.id === id) ?? null;

export const createLearningPath = (
  data: Pick<LearningPath, "title" | "description" | "isSequential" | "steps">,
): LearningPath => {
  const user = getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const now = new Date().toISOString();
  const path = normalizePath({
    ...data,
    id: genId(),
    userId: user.id,
    createdAt: now,
    updatedAt: now,
  });
  writeAllLearningPaths([...getAllLearningPaths(), path]);
  return path;
};

export const updateLearningPath = (
  id: string,
  updates: Partial<Pick<LearningPath, "title" | "description" | "isSequential" | "steps">>,
): LearningPath | null => {
  const user = getCurrentUser();
  if (!user) return null;

  const paths = getAllLearningPaths();
  const index = paths.findIndex((path) => path.id === id && path.userId === user.id);
  if (index === -1) return null;

  paths[index] = normalizePath({
    ...paths[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  });
  writeAllLearningPaths(paths);
  return paths[index];
};

export const deleteLearningPath = (id: string): boolean => {
  const user = getCurrentUser();
  if (!user) return false;

  const paths = getAllLearningPaths();
  const owned = paths.some((path) => path.id === id && path.userId === user.id);
  if (!owned) return false;
  writeAllLearningPaths(paths.filter((path) => path.id !== id));
  return true;
};

export const duplicateLearningPath = (id: string): LearningPath | null => {
  const user = getCurrentUser();
  const source = getLearningPathById(id);
  if (!user || !source || source.userId !== user.id) return null;

  const idMap = new Map(source.steps.map((step) => [step.id, genId()]));
  return createLearningPath({
    title: `Copie de ${source.title}`,
    description: source.description,
    isSequential: source.isSequential,
    steps: source.steps.map((step) => ({
      ...step,
      id: idMap.get(step.id) ?? genId(),
      prerequisiteStepIds: step.prerequisiteStepIds
        .map((prerequisiteId) => idMap.get(prerequisiteId))
        .filter((prerequisiteId): prerequisiteId is string => Boolean(prerequisiteId)),
    })),
  });
};

export const getCourseCompletionPercentage = (course: Course, userId: string): number => {
  const lessonIds = course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id));
  if (lessonIds.length === 0) return 0;

  const completedIds = new Set(getCourseProgress(course.id, userId)?.completedLessonIds ?? []);
  const completed = lessonIds.filter((id) => completedIds.has(id)).length;
  return Math.round((completed / lessonIds.length) * 100);
};

export const evaluateLearningPath = (
  path: LearningPath,
  userId: string,
  resolveCourse: (courseId: string) => Course | null = getCourseById,
): LearningPathProgress => {
  const baseStates = path.steps.map((step) => {
    const course = resolveCourse(step.courseId);
    const progressPercentage = course ? getCourseCompletionPercentage(course, userId) : 0;
    return {
      step,
      course,
      progressPercentage,
      isComplete: progressPercentage >= clampPercentage(step.requiredCompletionPercentage),
    };
  });

  const completionByStepId = new Map(baseStates.map((state) => [state.step.id, state.isComplete]));
  const steps = baseStates.map((state, index): LearningPathStepState => {
    const prerequisites = new Set(state.step.prerequisiteStepIds);
    if (path.isSequential && index > 0) prerequisites.add(path.steps[index - 1].id);
    const unmetPrerequisiteStepIds = [...prerequisites].filter(
      (prerequisiteId) => !completionByStepId.get(prerequisiteId),
    );
    return {
      ...state,
      isLocked: unmetPrerequisiteStepIds.length > 0,
      unmetPrerequisiteStepIds,
    };
  });

  const completedSteps = steps.filter((state) => state.isComplete).length;
  const totalSteps = steps.length;
  return {
    completedSteps,
    totalSteps,
    progressPercentage: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
    isComplete: totalSteps > 0 && completedSteps === totalSteps,
    steps,
  };
};
