import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentUser } from '../auth';
import { createCourse, getUserCourses, type Course } from '../courseStorage';
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
