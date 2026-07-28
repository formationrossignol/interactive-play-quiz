import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser } from "../auth";
import {
  createCourse,
  markLessonComplete,
  type Course,
} from "../courseStorage";
import {
  createLearningPath,
  duplicateLearningPath,
  evaluateLearningPath,
  getUserLearningPaths,
} from "../learningPathStorage";

vi.mock("../auth", () => ({ getCurrentUser: vi.fn() }));

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
  removeItem(key: string) { this.store.delete(key); }
  clear() { this.store.clear(); }
}

const USER_ID = "learner-1";

const coursePayload = (title: string): Omit<Course, "id" | "userId" | "createdAt" | "updatedAt"> => ({
  title,
  description: "",
  isPublic: false,
  isFavorite: false,
  category: "Autre",
  tags: [],
  modules: [{
    id: `${title}-module`,
    title: "Module",
    lessons: [
      { id: `${title}-lesson-1`, title: "Leçon 1", content: "", type: "text" },
      { id: `${title}-lesson-2`, title: "Leçon 2", content: "", type: "text" },
    ],
  }],
});

beforeEach(() => {
  vi.stubGlobal("localStorage", new MemoryStorage());
  vi.mocked(getCurrentUser).mockReturnValue({
    id: USER_ID,
    email: "learner@example.com",
    username: "Learner",
    createdAt: "2026-01-01T00:00:00Z",
    plan: "pro",
  });
});

describe("learning path progression", () => {
  it("unlocks sequential steps only after the previous threshold is reached", () => {
    const foundations = createCourse(coursePayload("Fondations"));
    const advanced = createCourse(coursePayload("Avancé"));
    const path = createLearningPath({
      title: "Parcours",
      description: "",
      isSequential: true,
      steps: [
        {
          id: "step-1",
          courseId: foundations.id,
          prerequisiteStepIds: [],
          requiredCompletionPercentage: 50,
        },
        {
          id: "step-2",
          courseId: advanced.id,
          prerequisiteStepIds: [],
          requiredCompletionPercentage: 100,
        },
      ],
    });

    expect(evaluateLearningPath(path, USER_ID).steps[1].isLocked).toBe(true);

    markLessonComplete(foundations.id, "Fondations-lesson-1", USER_ID);
    const progress = evaluateLearningPath(path, USER_ID);
    expect(progress.steps[0].isComplete).toBe(true);
    expect(progress.steps[1].isLocked).toBe(false);
  });

  it("supports explicit prerequisites in a flexible path", () => {
    const first = createCourse(coursePayload("Premier"));
    const second = createCourse(coursePayload("Second"));
    const path = createLearningPath({
      title: "Parcours libre",
      description: "",
      isSequential: false,
      steps: [
        { id: "first", courseId: first.id, prerequisiteStepIds: [], requiredCompletionPercentage: 100 },
        { id: "second", courseId: second.id, prerequisiteStepIds: ["first"], requiredCompletionPercentage: 100 },
      ],
    });

    expect(evaluateLearningPath(path, USER_ID).steps[1].unmetPrerequisiteStepIds).toEqual(["first"]);
  });

  it("duplicates steps with remapped prerequisite ids", () => {
    const first = createCourse(coursePayload("A"));
    const second = createCourse(coursePayload("B"));
    const path = createLearningPath({
      title: "Original",
      description: "",
      isSequential: false,
      steps: [
        { id: "a", courseId: first.id, prerequisiteStepIds: [], requiredCompletionPercentage: 100 },
        { id: "b", courseId: second.id, prerequisiteStepIds: ["a"], requiredCompletionPercentage: 80 },
      ],
    });

    const copy = duplicateLearningPath(path.id);
    expect(copy).not.toBeNull();
    expect(getUserLearningPaths(USER_ID)).toHaveLength(2);
    expect(copy?.steps[1].prerequisiteStepIds).toEqual([copy?.steps[0].id]);
  });
});
