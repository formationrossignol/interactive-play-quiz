import { beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateLegacyLocalData } from '../authMigration';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.get(k) ?? null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

const OLD_ID = 'legacy-123';
const NEW_ID = 'supabase-uuid-456';
const EMAIL = 'admin@example.com';

const seedLegacyUser = () => {
  localStorage.setItem('quiz_users', JSON.stringify([
    { id: OLD_ID, email: EMAIL, username: 'Admin', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'other-1', email: 'other@example.com', username: 'Other', createdAt: '2026-01-01T00:00:00Z' },
  ]));
  localStorage.setItem('quiz_passwords', JSON.stringify({ [OLD_ID]: 'hash-a', 'other-1': 'hash-b' }));
};

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});

describe('migrateLegacyLocalData', () => {
  it('returns false when no legacy user matches the email', () => {
    expect(migrateLegacyLocalData('nobody@example.com', NEW_ID)).toBe(false);
  });

  it('remaps userId fields across all user-keyed stores', () => {
    seedLegacyUser();
    localStorage.setItem('saved_quizzes', JSON.stringify([
      { id: 'q1', userId: OLD_ID, title: 'Quiz A' },
      { id: 'q2', userId: 'other-1', title: 'Quiz B' },
    ]));
    localStorage.setItem('question_bank', JSON.stringify([{ id: 'b1', userId: OLD_ID }]));
    localStorage.setItem('lms_courses', JSON.stringify([{ id: 'c1', userId: OLD_ID }]));
    localStorage.setItem('lms_progress', JSON.stringify([{ courseId: 'c1', userId: OLD_ID }]));
    localStorage.setItem('content_folders', JSON.stringify([{ id: 'f1', userId: OLD_ID }]));
    localStorage.setItem('lms_exams', JSON.stringify([{ id: 'e1', hostId: OLD_ID }]));

    expect(migrateLegacyLocalData(EMAIL, NEW_ID)).toBe(true);

    expect(JSON.parse(localStorage.getItem('saved_quizzes')!)).toEqual([
      { id: 'q1', userId: NEW_ID, title: 'Quiz A' },
      { id: 'q2', userId: 'other-1', title: 'Quiz B' },
    ]);
    expect(JSON.parse(localStorage.getItem('question_bank')!)[0].userId).toBe(NEW_ID);
    expect(JSON.parse(localStorage.getItem('lms_courses')!)[0].userId).toBe(NEW_ID);
    expect(JSON.parse(localStorage.getItem('lms_progress')!)[0].userId).toBe(NEW_ID);
    expect(JSON.parse(localStorage.getItem('content_folders')!)[0].userId).toBe(NEW_ID);
    expect(JSON.parse(localStorage.getItem('lms_exams')!)[0].hostId).toBe(NEW_ID);
  });

  it('matches email case-insensitively', () => {
    seedLegacyUser();
    expect(migrateLegacyLocalData('ADMIN@Example.COM', NEW_ID)).toBe(true);
  });

  it('remaps the ratings map key and merges with existing entries', () => {
    seedLegacyUser();
    localStorage.setItem('quiz_user_ratings', JSON.stringify({ [OLD_ID]: ['q1', 'q2'], [NEW_ID]: ['q2', 'q3'] }));
    migrateLegacyLocalData(EMAIL, NEW_ID);
    const ratings = JSON.parse(localStorage.getItem('quiz_user_ratings')!);
    expect(ratings[OLD_ID]).toBeUndefined();
    expect([...ratings[NEW_ID]].sort()).toEqual(['q1', 'q2', 'q3']);
  });

  it('removes the migrated legacy account and its password hash', () => {
    seedLegacyUser();
    migrateLegacyLocalData(EMAIL, NEW_ID);
    const users = JSON.parse(localStorage.getItem('quiz_users')!);
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('other-1');
    const passwords = JSON.parse(localStorage.getItem('quiz_passwords')!);
    expect(passwords[OLD_ID]).toBeUndefined();
    expect(passwords['other-1']).toBe('hash-b');
  });

  it('removes quiz_users and quiz_passwords keys entirely when last legacy user migrates', () => {
    localStorage.setItem('quiz_users', JSON.stringify([{ id: OLD_ID, email: EMAIL, username: 'Admin', createdAt: '2026-01-01T00:00:00Z' }]));
    localStorage.setItem('quiz_passwords', JSON.stringify({ [OLD_ID]: 'hash-a' }));
    migrateLegacyLocalData(EMAIL, NEW_ID);
    expect(localStorage.getItem('quiz_users')).toBeNull();
    expect(localStorage.getItem('quiz_passwords')).toBeNull();
  });

  it('is idempotent — second call is a no-op returning false', () => {
    seedLegacyUser();
    localStorage.setItem('saved_quizzes', JSON.stringify([{ id: 'q1', userId: OLD_ID }]));
    expect(migrateLegacyLocalData(EMAIL, NEW_ID)).toBe(true);
    expect(migrateLegacyLocalData(EMAIL, NEW_ID)).toBe(false);
    expect(JSON.parse(localStorage.getItem('saved_quizzes')!)[0].userId).toBe(NEW_ID);
  });

  it('survives corrupted JSON in a data store without throwing', () => {
    seedLegacyUser();
    localStorage.setItem('saved_quizzes', '{not json');
    expect(() => migrateLegacyLocalData(EMAIL, NEW_ID)).not.toThrow();
  });
});
