import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentUser } from '../auth';
import { createCourse, duplicateCourse, getUserCourses, type Course } from '../courseStorage';
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

describe('duplicateCourse cap enforcement', () => {
  it('throws PlanLimitError when duplicating would exceed the starter cap (1)', () => {
    const created = createCourse(coursePayload());
    expect(() => duplicateCourse(created.id)).toThrow(PlanLimitError);
  });
});

describe('scorm lesson fields round-trip through a course', () => {
  it('persists scorm-specific fields on a lesson', () => {
    const created = createCourse({
      ...coursePayload(),
      modules: [{
        id: 'm1',
        title: 'Module 1',
        lessons: [{
          id: 'l1',
          title: 'SCORM lesson',
          content: '',
          type: 'scorm',
          scormPackageId: 'pkg-1',
          scormVersion: '1.2',
          scormLaunchPath: 'index_lms.html',
          scormTitle: 'Imported Course',
        }],
      }],
    });
    const lesson = getUserCourses(USER_ID)[0].modules[0].lessons[0];
    expect(lesson.type).toBe('scorm');
    expect(lesson.scormPackageId).toBe('pkg-1');
    expect(lesson.scormVersion).toBe('1.2');
    expect(lesson.scormLaunchPath).toBe('index_lms.html');
    expect(created.modules[0].lessons[0].scormTitle).toBe('Imported Course');
  });
});
