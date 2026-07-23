/**
 * One-shot migration of legacy localStorage accounts to Supabase user ids.
 * Called after every successful sign-in; idempotent (the matched legacy
 * account is deleted after remapping, so subsequent calls find nothing).
 */

interface LegacyUser {
  id: string;
  email: string;
  username: string;
  createdAt: string;
}

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) =>
  localStorage.setItem(key, JSON.stringify(value));

/** Rewrites `field` from oldId to newId on every item of the array stored at `key`. */
const remapField = (key: string, field: string, oldId: string, newId: string) => {
  const items = readJson<Record<string, unknown>[]>(key, []);
  let changed = false;
  for (const item of items) {
    if (item[field] === oldId) {
      item[field] = newId;
      changed = true;
    }
  }
  if (changed) writeJson(key, items);
};

export const migrateLegacyLocalData = (email: string, newUserId: string): boolean => {
  const legacyUsers = readJson<LegacyUser[]>('quiz_users', []);
  const legacy = legacyUsers.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );
  if (!legacy) return false;
  const oldId = legacy.id;

  remapField('saved_quizzes', 'userId', oldId, newUserId);
  remapField('question_bank', 'userId', oldId, newUserId);
  remapField('lms_courses', 'userId', oldId, newUserId);
  remapField('lms_progress', 'userId', oldId, newUserId);
  remapField('content_folders', 'userId', oldId, newUserId);
  remapField('lms_exams', 'hostId', oldId, newUserId);

  const ratings = readJson<Record<string, string[]>>('quiz_user_ratings', {});
  if (ratings[oldId]) {
    ratings[newUserId] = [...new Set([...(ratings[newUserId] ?? []), ...ratings[oldId]])];
    delete ratings[oldId];
    writeJson('quiz_user_ratings', ratings);
  }

  const remaining = legacyUsers.filter((u) => u.id !== oldId);
  if (remaining.length) writeJson('quiz_users', remaining);
  else localStorage.removeItem('quiz_users');

  const passwords = readJson<Record<string, string>>('quiz_passwords', {});
  delete passwords[oldId];
  if (Object.keys(passwords).length) writeJson('quiz_passwords', passwords);
  else localStorage.removeItem('quiz_passwords');

  return true;
};
