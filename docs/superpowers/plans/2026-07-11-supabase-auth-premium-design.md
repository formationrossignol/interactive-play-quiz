# Supabase Auth + Premium Design Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace localStorage-only auth with Supabase Auth (real accounts, TOTP MFA, password change/reset), migrate legacy local accounts, then unify page backgrounds and add route transitions/loading polish.

**Architecture:** `src/lib/auth.ts` is rewritten as a thin wrapper around `supabase.auth` that maintains a synchronous in-memory + localStorage cache of the current user, so the ~15 pages calling `getCurrentUser()` synchronously keep working unchanged. An `AuthGate` in `App.tsx` waits for session restoration before rendering routes. Legacy localStorage accounts are remapped to the new Supabase user id on first sign-in. Phase 2 removes opaque page backgrounds that hide the global `.ap-app` dot-grid motif and adds CSS route transitions + a Suspense loading fallback.

**Tech Stack:** React 18 + Vite + TypeScript, `@supabase/supabase-js` v2 (already installed), vitest (to add), Arcade Pop design tokens (`src/arcade-pop.css`).

**Spec:** `docs/superpowers/specs/2026-07-11-supabase-auth-premium-design-design.md`

---

## Reference: current state

- `src/lib/auth.ts` — localStorage auth (`quiz_users`, `quiz_passwords`, cache key `quiz_auth_user`). Exports: `User`, `Theme`, `Language`, `Plan`, `AUTH_STORAGE_KEY`, `getCurrentUser` (sync), `setCurrentUser`, `logout`, `login`, `register`.
- Consumers of `getCurrentUser` (sync, must keep working): Header, QuizBuilder component, questionBank lib, quizStorage lib (`rateQuiz`), pages MyFlashcards, ProfilePage, MyPolls, DiscoverQuizzes, ExamAdmin, CourseViewer, ExamBuilder, MyQuizzes, MyExams, QuestionBank, CourseBuilder, MyCourses.
- Only ProfilePage uses `setCurrentUser`.
- User-keyed localStorage data: `saved_quizzes` (field `userId`), `question_bank` (`userId`), `lms_courses` (`userId`), `lms_progress` (`userId`), `content_folders` (`userId`), `lms_exams` (`hostId`), `quiz_user_ratings` (`Record<userId, quizId[]>`). Exam attempts (`lms_exam_attempts`) use `participantId` (anonymous exam takers) — do NOT remap.
- i18n: `src/lib/i18n.ts` exports `translations = { en: {...}, fr: {...} }` and `t(key: keyof typeof translations.en)`. Add every new key to BOTH dictionaries.
- Supabase client: `src/lib/supabase.ts` exports `supabase`. Env in `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- No test infrastructure exists yet.

---

## Phase 1 — Supabase Auth

### Task 0: Supabase dashboard configuration (MANUAL — user does this)

**This task is for the human. Blocked tasks: end-to-end verification in Task 9 (code tasks 1–8 can proceed without it).**

- [ ] In https://supabase.com/dashboard project `bvhvesmugulsaunzbytm`: Authentication → Sign In / Up → ensure **Email** provider enabled, **Confirm email** ON.
- [ ] Authentication → Multi-Factor → enable **TOTP**.
- [ ] Authentication → URL Configuration → set Site URL to production URL; add redirect URLs: `http://localhost:8080/**` (check `vite.config.ts` for the actual dev port; Vite default is 5173) and `<production-url>/**`.

### Task 1: Vitest setup

**Files:**
- Modify: `package.json` (scripts + devDependency)

- [ ] **Step 1: Install vitest**

Run: `npm install -D vitest`

- [ ] **Step 2: Add test script**

In `package.json` scripts, after `"lint"`:

```json
"test": "vitest run"
```

- [ ] **Step 3: Verify runner works**

Run: `npx vitest run`
Expected: "No test files found" (exit code 1 — fine, no tests yet).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vitest"
```

### Task 2: Legacy data migration module (TDD)

**Files:**
- Create: `src/lib/authMigration.ts`
- Create: `src/lib/__tests__/authMigration.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/authMigration.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/authMigration.test.ts`
Expected: FAIL — cannot resolve `../authMigration`.

- [ ] **Step 3: Implement `src/lib/authMigration.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/authMigration.test.ts`
Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/authMigration.ts src/lib/__tests__/authMigration.test.ts
git commit -m "feat(auth): legacy localStorage account migration to Supabase user ids"
```

### Task 3: Rewrite `src/lib/auth.ts` on Supabase Auth

**Files:**
- Modify: `src/lib/auth.ts` (full rewrite)

No unit tests for this module (thin network wrapper around `supabase.auth`); verified by typecheck/build here and end-to-end in Task 9.

- [ ] **Step 1: Replace the full contents of `src/lib/auth.ts`**

```ts
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { migrateLegacyLocalData } from './authMigration';

export type Theme = 'light' | 'dark';
export type Language = 'en' | 'fr';
export type Plan = 'perso' | 'pro' | 'entreprise';

export interface User {
  id: string;
  email: string;
  username: string;
  createdAt: string;
  theme?: Theme;
  language?: Language;
  plan?: Plan;
}

export const AUTH_STORAGE_KEY = 'quiz_auth_user';

const mapUser = (u: SupabaseUser): User => ({
  id: u.id,
  email: u.email ?? '',
  username: (u.user_metadata?.username as string) || (u.email ?? '').split('@')[0],
  createdAt: u.created_at,
  theme: u.user_metadata?.theme as Theme | undefined,
  language: u.user_metadata?.language as Language | undefined,
  plan: u.user_metadata?.plan as Plan | undefined,
});

/* ── Synchronous cache ──────────────────────────────────────────
   Pages call getCurrentUser() synchronously; the cache mirrors the
   Supabase session (only once AAL requirements are satisfied). */

let cachedUser: User | null = (() => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
})();

const setCache = (user: User | null) => {
  cachedUser = user;
  if (user) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  else localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const getCurrentUser = (): User | null => cachedUser;

/* ── Session bootstrap ────────────────────────────────────────── */

const syncFromSession = async (session: Session | null) => {
  if (!session?.user) {
    setCache(null);
    return;
  }
  // A user with verified TOTP must complete the second factor before
  // the app treats them as signed in.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
    setCache(null);
    return;
  }
  setCache(mapUser(session.user));
  if (session.user.email) migrateLegacyLocalData(session.user.email, session.user.id);
};

let initPromise: Promise<void> | null = null;

/** Resolves once the persisted session (if any) has been restored. */
export const initAuth = (): Promise<void> => {
  if (!initPromise) {
    initPromise = (async () => {
      supabase.auth.onAuthStateChange((_event, session) => {
        // setTimeout: supabase-js forbids awaiting its own methods
        // synchronously inside this callback (deadlock).
        setTimeout(() => void syncFromSession(session), 0);
      });
      const { data } = await supabase.auth.getSession();
      await syncFromSession(data.session);
    })();
  }
  return initPromise;
};

/* ── Sign in / sign up / sign out ─────────────────────────────── */

export type LoginResult =
  | { status: 'ok'; user: User }
  | { status: 'mfa_required' }
  | { status: 'invalid_credentials' }
  | { status: 'email_not_confirmed' }
  | { status: 'error'; message: string };

export const login = async (email: string, password: string): Promise<LoginResult> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === 'email_not_confirmed') return { status: 'email_not_confirmed' };
    if (error.code === 'invalid_credentials') return { status: 'invalid_credentials' };
    return { status: 'error', message: error.message };
  }
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
    return { status: 'mfa_required' };
  }
  const user = mapUser(data.user);
  setCache(user);
  migrateLegacyLocalData(user.email, user.id);
  return { status: 'ok', user };
};

export type RegisterResult =
  | { status: 'ok'; user: User }
  | { status: 'confirm_email' }
  | { status: 'email_in_use' }
  | { status: 'error'; message: string };

export const register = async (
  email: string,
  username: string,
  password: string
): Promise<RegisterResult> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: `${window.location.origin}/auth`,
    },
  });
  if (error) {
    if (error.code === 'user_already_exists') return { status: 'email_in_use' };
    return { status: 'error', message: error.message };
  }
  if (!data.session) return { status: 'confirm_email' };
  const user = mapUser(data.user!);
  setCache(user);
  migrateLegacyLocalData(user.email, user.id);
  return { status: 'ok', user };
};

export const logout = () => {
  setCache(null);
  void supabase.auth.signOut();
};

/* ── Password management ──────────────────────────────────────── */

export const requestPasswordReset = async (email: string): Promise<boolean> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return !error;
};

export const updatePassword = async (
  newPassword: string
): Promise<{ ok: boolean; message?: string }> => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return error ? { ok: false, message: error.message } : { ok: true };
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<'ok' | 'wrong_password' | 'error'> => {
  const user = getCurrentUser();
  if (!user) return 'error';
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) return 'wrong_password';
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return error ? 'error' : 'ok';
};

/* ── Profile metadata ─────────────────────────────────────────── */

export const updateProfile = async (
  patch: Partial<Pick<User, 'username' | 'theme' | 'language' | 'plan'>>
): Promise<User | null> => {
  const { data, error } = await supabase.auth.updateUser({ data: patch });
  if (error || !data.user) return null;
  const user = mapUser(data.user);
  setCache(user);
  return user;
};

/* ── MFA (TOTP) ───────────────────────────────────────────────── */

export interface MfaEnrollment {
  factorId: string;
  qrCodeSvg: string; // SVG markup, render via <img src={`data:image/svg+xml;utf8,${encodeURIComponent(qrCodeSvg)}`}> or inline
  secret: string;
}

export const getVerifiedTotpFactor = async () => {
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp.find((f) => f.status === 'verified') ?? null;
};

export const enrollMfa = async (): Promise<MfaEnrollment | null> => {
  // Clear any stale unverified factor from an abandoned enrollment.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const f of existing?.all ?? []) {
    if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Authenticator',
  });
  if (error || !data) return null;
  return { factorId: data.id, qrCodeSvg: data.totp.qr_code, secret: data.totp.secret };
};

export const verifyMfaCode = async (factorId: string, code: string): Promise<boolean> => {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) return false;
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  return !error;
};

/** Completes a login that returned `mfa_required`. */
export const verifyMfaLogin = async (code: string): Promise<User | null> => {
  const factor = await getVerifiedTotpFactor();
  if (!factor) return null;
  const ok = await verifyMfaCode(factor.id, code);
  if (!ok) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const user = mapUser(data.user);
  setCache(user);
  migrateLegacyLocalData(user.email, user.id);
  return user;
};

/** Disables MFA. Requires a valid current TOTP code (raises session to AAL2). */
export const unenrollMfa = async (code: string): Promise<boolean> => {
  const factor = await getVerifiedTotpFactor();
  if (!factor) return false;
  const ok = await verifyMfaCode(factor.id, code);
  if (!ok) return false;
  const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
  return !error;
};
```

Note: `setCurrentUser` is intentionally removed. Its only caller (ProfilePage) is updated in Task 8.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: errors ONLY in `src/pages/ProfilePage.tsx` (imports removed `setCurrentUser`) — fixed in Task 8. If `tsconfig.app.json` has `noEmit` issues, use `npm run build` and read the TS errors. No errors in `src/lib/auth.ts` itself.

- [ ] **Step 3: Run existing tests**

Run: `npx vitest run`
Expected: authMigration tests still PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat(auth): rewrite auth on Supabase (sessions, password mgmt, TOTP MFA)"
```

### Task 4: AuthGate + reset-password route in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add imports and AuthGate**

In `src/App.tsx`, change line 1 and add after the `queryClient` declaration (line 51):

```tsx
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { initAuth } from "@/lib/auth";
```

```tsx
const AuthGate = ({ children }: { children: ReactNode }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void initAuth().then(() => setReady(true));
  }, []);
  if (!ready) return null;
  return <>{children}</>;
};
```

Wrap the router: replace `<BrowserRouter>` opening tag context so the tree reads:

```tsx
<AuthGate>
  <BrowserRouter>
    ...
  </BrowserRouter>
</AuthGate>
```

- [ ] **Step 2: Add the reset-password route**

Add with the other lazy imports:

```tsx
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
```

Add above the catch-all route:

```tsx
<Route path="/reset-password" element={<ResetPassword />} />
```

- [ ] **Step 3: Create a placeholder page so the build passes**

Create `src/pages/ResetPassword.tsx` (replaced with the real page in Task 7):

```tsx
const ResetPassword = () => null;
export default ResetPassword;
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: only the known ProfilePage error from Task 3 (if build fails on it, temporarily note and continue — Task 8 fixes it; otherwise PASS).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/pages/ResetPassword.tsx
git commit -m "feat(auth): session bootstrap gate and reset-password route"
```

### Task 5: i18n keys

**Files:**
- Modify: `src/lib/i18n.ts` (`translations.en` and `translations.fr`)

- [ ] **Step 1: Add keys to the `en` dictionary**

```ts
    // Auth & security
    forgotPassword: "Forgot password?",
    resetEmailSent: "If an account exists for this email, a reset link has been sent.",
    backToLogin: "Back to login",
    confirmEmailTitle: "Check your inbox",
    confirmEmailBody: "We sent you a confirmation link. Click it to activate your account.",
    emailNotConfirmed: "Please confirm your email before signing in.",
    invalidCredentials: "Incorrect email or password",
    security: "Security",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmNewPassword: "Confirm new password",
    changePasswordAction: "Change password",
    passwordChanged: "Password changed",
    wrongCurrentPassword: "Current password is incorrect",
    passwordTooShort: "Password must be at least 8 characters",
    passwordsDontMatch: "Passwords don't match",
    newPasswordTitle: "Choose a new password",
    passwordUpdated: "Password updated, you are signed in",
    mfaTitle: "Two-factor authentication (2FA)",
    mfaStatusOn: "2FA is enabled on your account",
    mfaStatusOff: "Protect your account with a one-time code from an authenticator app",
    mfaEnable: "Enable 2FA",
    mfaDisable: "Disable 2FA",
    mfaScanQr: "Scan this QR code with your authenticator app (Google Authenticator, 1Password...), then enter the 6-digit code.",
    mfaSecretFallback: "Or enter this key manually:",
    mfaCodeLabel: "6-digit code",
    mfaInvalidCode: "Invalid code, try again",
    mfaActivated: "Two-factor authentication enabled",
    mfaDeactivated: "Two-factor authentication disabled",
    mfaLoginPrompt: "Enter the 6-digit code from your authenticator app",
    verify: "Verify",
    cancel: "Cancel",
    send: "Send",
```

- [ ] **Step 2: Add the same keys to the `fr` dictionary**

```ts
    // Auth & security
    forgotPassword: "Mot de passe oublié ?",
    resetEmailSent: "Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.",
    backToLogin: "Retour à la connexion",
    confirmEmailTitle: "Vérifiez votre boîte mail",
    confirmEmailBody: "Nous vous avons envoyé un lien de confirmation. Cliquez dessus pour activer votre compte.",
    emailNotConfirmed: "Veuillez confirmer votre email avant de vous connecter.",
    invalidCredentials: "Email ou mot de passe incorrect",
    security: "Sécurité",
    currentPassword: "Mot de passe actuel",
    newPassword: "Nouveau mot de passe",
    confirmNewPassword: "Confirmer le nouveau mot de passe",
    changePasswordAction: "Changer le mot de passe",
    passwordChanged: "Mot de passe modifié",
    wrongCurrentPassword: "Mot de passe actuel incorrect",
    passwordTooShort: "Le mot de passe doit contenir au moins 8 caractères",
    passwordsDontMatch: "Les mots de passe ne correspondent pas",
    newPasswordTitle: "Choisissez un nouveau mot de passe",
    passwordUpdated: "Mot de passe mis à jour, vous êtes connecté",
    mfaTitle: "Authentification à deux facteurs (2FA)",
    mfaStatusOn: "La 2FA est activée sur votre compte",
    mfaStatusOff: "Protégez votre compte avec un code à usage unique depuis une app d'authentification",
    mfaEnable: "Activer la 2FA",
    mfaDisable: "Désactiver la 2FA",
    mfaScanQr: "Scannez ce QR code avec votre app d'authentification (Google Authenticator, 1Password...), puis saisissez le code à 6 chiffres.",
    mfaSecretFallback: "Ou saisissez cette clé manuellement :",
    mfaCodeLabel: "Code à 6 chiffres",
    mfaInvalidCode: "Code invalide, réessayez",
    mfaActivated: "Authentification à deux facteurs activée",
    mfaDeactivated: "Authentification à deux facteurs désactivée",
    mfaLoginPrompt: "Saisissez le code à 6 chiffres de votre app d'authentification",
    verify: "Vérifier",
    cancel: "Annuler",
    send: "Envoyer",
```

Before adding, check neither dict already defines a key with the same name (grep each key name); if one exists (e.g. `cancel`), skip the duplicate and reuse the existing key in later tasks.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no NEW errors (ProfilePage error from Task 3 may remain).

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n.ts
git commit -m "feat(i18n): auth and security strings (en/fr)"
```

### Task 6: AuthPage — async flows, MFA step, forgot password, confirm-email notice

**Files:**
- Modify: `src/pages/AuthPage.tsx`

- [ ] **Step 1: Rewrite state and handlers**

Replace imports and the component top (lines 1–35) with:

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { login, register, requestPasswordReset, verifyMfaLogin, getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

type View = "login" | "register" | "mfa" | "forgot" | "confirm-email";

const AuthPage = () => {
  const navigate = useNavigate();
  useSEO({ title: "Connexion", path: "/auth", noindex: true });
  const [view, setView] = useState<View>("login");
  const [busy, setBusy] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ email: "", username: "", password: "" });
  const [mfaCode, setMfaCode] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");

  // Already signed in (e.g. arriving from the email confirmation link)
  useEffect(() => {
    if (getCurrentUser()) navigate("/");
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await login(loginData.email, loginData.password);
    setBusy(false);
    if (result.status === "ok") {
      toast.success(t("loginSuccess"));
      navigate("/");
    } else if (result.status === "mfa_required") {
      setView("mfa");
    } else if (result.status === "email_not_confirmed") {
      toast.error(t("emailNotConfirmed"));
    } else if (result.status === "invalid_credentials") {
      toast.error(t("invalidCredentials"));
    } else {
      toast.error(result.message);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerData.password.length < 8) { toast.error(t("passwordTooShort")); return; }
    setBusy(true);
    const result = await register(registerData.email, registerData.username, registerData.password);
    setBusy(false);
    if (result.status === "ok") {
      toast.success(t("registerSuccess"));
      navigate("/");
    } else if (result.status === "confirm_email") {
      setView("confirm-email");
    } else if (result.status === "email_in_use") {
      toast.error(t("emailAlreadyUsed"));
    } else {
      toast.error(result.message);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const user = await verifyMfaLogin(mfaCode);
    setBusy(false);
    if (user) {
      toast.success(t("loginSuccess"));
      navigate("/");
    } else {
      toast.error(t("mfaInvalidCode"));
      setMfaCode("");
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await requestPasswordReset(forgotEmail);
    setBusy(false);
    toast.success(t("resetEmailSent"));
    setView("login");
  };
```

Keep the existing `inputStyle` / `labelStyle` constants unchanged.

- [ ] **Step 2: Update the JSX**

- The tab switcher (`.ap-seg`) shows only when `view === "login" || view === "register"`; its buttons call `setView("login")` / `setView("register")`.
- Existing login form: keep, add under the submit button:

```tsx
<button
  type="button"
  onClick={() => setView("forgot")}
  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 700, color: "var(--ap-brand)", fontFamily: "var(--ap-font-body)" }}
>
  {t("forgotPassword")}
</button>
```

Add `disabled={busy}` to both submit buttons.

- New MFA view (inside the card, when `view === "mfa"`):

```tsx
{view === "mfa" && (
  <form onSubmit={handleMfaVerify} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
    <p className="ap-muted" style={{ fontSize: "14px", margin: 0 }}>{t("mfaLoginPrompt")}</p>
    <div>
      <label style={labelStyle}>{t("mfaCodeLabel")}</label>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        autoFocus
        value={mfaCode}
        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
        style={{ ...inputStyle, textAlign: "center", fontSize: "22px", letterSpacing: "8px" }}
        placeholder="000000"
      />
    </div>
    <button type="submit" className="ap-btn ap-btn--pill" disabled={busy} style={{ width: "100%" }}>
      {t("verify")}
    </button>
    <button type="button" onClick={() => setView("login")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 700, color: "var(--ap-muted)", fontFamily: "var(--ap-font-body)" }}>
      {t("backToLogin")}
    </button>
  </form>
)}
```

- New forgot view (`view === "forgot"`): one email input (reuse `inputStyle`, label `t("email")`), submit button `t("send")` calling `handleForgot`, plus the same "back to login" button.
- New confirm-email view (`view === "confirm-email"`): static block —

```tsx
{view === "confirm-email" && (
  <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "12px" }}>
    <h2 className="ap-h3" style={{ margin: 0 }}>{t("confirmEmailTitle")}</h2>
    <p className="ap-muted" style={{ fontSize: "14px", margin: 0 }}>{t("confirmEmailBody")}</p>
    <button type="button" onClick={() => setView("login")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 700, color: "var(--ap-brand)", fontFamily: "var(--ap-font-body)" }}>
      {t("backToLogin")}
    </button>
  </div>
)}
```

- Guard existing forms with `view === "login"` / `view === "register"` (replacing the old `tab === ...` conditions).

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: no errors from AuthPage.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AuthPage.tsx
git commit -m "feat(auth): async login/register, MFA step, forgot-password and confirm-email views"
```

### Task 7: ResetPassword page

**Files:**
- Modify: `src/pages/ResetPassword.tsx` (replace the Task 4 placeholder)

- [ ] **Step 1: Implement the page**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { updatePassword } from "@/lib/auth";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: "var(--ap-font-body)",
  fontWeight: 700,
  fontSize: "15px",
  color: "var(--ap-ink)",
  background: "var(--ap-card)",
  border: "2px solid var(--ap-line)",
  borderRadius: "var(--ap-r-sm)",
  padding: "12px 15px",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 800,
  fontSize: "11px",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  color: "var(--ap-muted)",
  marginBottom: "7px",
  fontFamily: "var(--ap-font-body)",
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error(t("passwordTooShort")); return; }
    if (password !== confirm) { toast.error(t("passwordsDontMatch")); return; }
    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (result.ok) {
      toast.success(t("passwordUpdated"));
      navigate("/");
    } else {
      toast.error(result.message ?? t("loginError"));
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div className="ap-card ap-card--floaty" style={{ width: "100%", maxWidth: "420px", padding: "32px" }}>
        <h1 className="ap-h3" style={{ marginBottom: "20px" }}>{t("newPasswordTitle")}</h1>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>{t("newPassword")}</label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} placeholder="••••••••" />
          </div>
          <div>
            <label style={labelStyle}>{t("confirmNewPassword")}</label>
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inputStyle} placeholder="••••••••" />
          </div>
          <button type="submit" className="ap-btn ap-btn--pill" disabled={busy} style={{ width: "100%" }}>
            {t("saveChanges")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
```

The recovery link signs the user in automatically (Supabase handles the URL hash); `updateUser({ password })` then works on that session. Known limitation: an MFA-enrolled user landing here at AAL1 gets an error toast from Supabase; they can sign in normally and use Settings → Security instead.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS (ProfilePage error may remain until Task 8).

- [ ] **Step 3: Commit**

```bash
git add src/pages/ResetPassword.tsx
git commit -m "feat(auth): reset-password page"
```

### Task 8: Security section (password change + MFA) and ProfilePage integration

**Files:**
- Create: `src/components/SecuritySection.tsx`
- Modify: `src/pages/ProfilePage.tsx`

- [ ] **Step 1: Create `src/components/SecuritySection.tsx`**

```tsx
import { useEffect, useState } from "react";
import { changePassword, enrollMfa, verifyMfaCode, unenrollMfa, getVerifiedTotpFactor, type MfaEnrollment } from "@/lib/auth";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { ShieldCheck, Shield, KeyRound } from "lucide-react";

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: "var(--ap-font-body)",
  fontWeight: 700,
  fontSize: "14px",
  color: "var(--ap-ink)",
  background: "var(--ap-card)",
  border: "2px solid var(--ap-line)",
  borderRadius: "var(--ap-r-sm)",
  padding: "11px 14px",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 800,
  fontSize: "11px",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  color: "var(--ap-muted)",
  marginBottom: "7px",
  fontFamily: "var(--ap-font-body)",
};

const codeInputStyle: React.CSSProperties = {
  ...inputStyle,
  textAlign: "center",
  fontSize: "20px",
  letterSpacing: "6px",
};

export const SecuritySection = () => {
  /* Password change */
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  /* MFA */
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [enrollCode, setEnrollCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);
  const [mfaBusy, setMfaBusy] = useState(false);

  useEffect(() => {
    void getVerifiedTotpFactor().then((f) => setMfaEnabled(!!f));
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) { toast.error(t("passwordTooShort")); return; }
    if (newPw !== confirmPw) { toast.error(t("passwordsDontMatch")); return; }
    setPwBusy(true);
    const result = await changePassword(currentPw, newPw);
    setPwBusy(false);
    if (result === "ok") {
      toast.success(t("passwordChanged"));
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } else if (result === "wrong_password") {
      toast.error(t("wrongCurrentPassword"));
    } else {
      toast.error(t("loginError"));
    }
  };

  const handleStartEnroll = async () => {
    setMfaBusy(true);
    const data = await enrollMfa();
    setMfaBusy(false);
    if (data) setEnrollment(data);
    else toast.error(t("loginError"));
  };

  const handleVerifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollment) return;
    setMfaBusy(true);
    const ok = await verifyMfaCode(enrollment.factorId, enrollCode);
    setMfaBusy(false);
    if (ok) {
      toast.success(t("mfaActivated"));
      setMfaEnabled(true);
      setEnrollment(null);
      setEnrollCode("");
    } else {
      toast.error(t("mfaInvalidCode"));
      setEnrollCode("");
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaBusy(true);
    const ok = await unenrollMfa(disableCode);
    setMfaBusy(false);
    if (ok) {
      toast.success(t("mfaDeactivated"));
      setMfaEnabled(false);
      setShowDisable(false);
      setDisableCode("");
    } else {
      toast.error(t("mfaInvalidCode"));
      setDisableCode("");
    }
  };

  return (
    <div className="ap-card ap-card--floaty" style={{ padding: "28px 32px" }}>
      <h2 className="ap-h3" style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
        <KeyRound style={{ width: 18, height: 18 }} />
        {t("security")}
      </h2>

      {/* Change password */}
      <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "28px" }}>
        <div>
          <label style={labelStyle}>{t("currentPassword")}</label>
          <input type="password" required autoComplete="current-password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t("newPassword")}</label>
          <input type="password" required minLength={8} autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t("confirmNewPassword")}</label>
          <input type="password" required autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} style={inputStyle} />
        </div>
        <button type="submit" className="ap-btn ap-btn--pill" disabled={pwBusy} style={{ alignSelf: "flex-start" }}>
          {t("changePasswordAction")}
        </button>
      </form>

      {/* MFA */}
      <div style={{ borderTop: "2px solid var(--ap-line)", paddingTop: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          {mfaEnabled ? <ShieldCheck style={{ width: 18, height: 18, color: "var(--ap-quiz)" }} /> : <Shield style={{ width: 18, height: 18, color: "var(--ap-muted)" }} />}
          <span style={{ fontFamily: "var(--ap-font-display)", fontWeight: 700, fontSize: "15px", color: "var(--ap-ink)" }}>{t("mfaTitle")}</span>
        </div>
        <p className="ap-muted" style={{ fontSize: "13px", marginBottom: "16px" }}>
          {mfaEnabled ? t("mfaStatusOn") : t("mfaStatusOff")}
        </p>

        {mfaEnabled === false && !enrollment && (
          <button className="ap-btn ap-btn--pill" disabled={mfaBusy} onClick={handleStartEnroll}>
            {t("mfaEnable")}
          </button>
        )}

        {enrollment && (
          <form onSubmit={handleVerifyEnroll} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p className="ap-muted" style={{ fontSize: "13px", margin: 0 }}>{t("mfaScanQr")}</p>
            <div style={{ background: "#fff", borderRadius: "var(--ap-r-md)", padding: "12px", width: "fit-content", border: "2px solid var(--ap-line)" }}>
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(enrollment.qrCodeSvg)}`}
                alt="QR code"
                width={180}
                height={180}
              />
            </div>
            <p className="ap-muted" style={{ fontSize: "12px", margin: 0, wordBreak: "break-all" }}>
              {t("mfaSecretFallback")} <code>{enrollment.secret}</code>
            </p>
            <div style={{ maxWidth: "220px" }}>
              <label style={labelStyle}>{t("mfaCodeLabel")}</label>
              <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoFocus value={enrollCode} onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, ""))} style={codeInputStyle} placeholder="000000" />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button type="submit" className="ap-btn ap-btn--pill" disabled={mfaBusy}>{t("verify")}</button>
              <button type="button" className="ap-btn ap-btn--pill ap-btn--ghost" onClick={() => { setEnrollment(null); setEnrollCode(""); }}>{t("cancel")}</button>
            </div>
          </form>
        )}

        {mfaEnabled && !showDisable && (
          <button className="ap-btn ap-btn--pill ap-btn--ghost" onClick={() => setShowDisable(true)}>
            {t("mfaDisable")}
          </button>
        )}

        {mfaEnabled && showDisable && (
          <form onSubmit={handleDisable} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ maxWidth: "220px" }}>
              <label style={labelStyle}>{t("mfaCodeLabel")}</label>
              <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoFocus value={disableCode} onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))} style={codeInputStyle} placeholder="000000" />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button type="submit" className="ap-btn ap-btn--pill" disabled={mfaBusy}>{t("mfaDisable")}</button>
              <button type="button" className="ap-btn ap-btn--pill ap-btn--ghost" onClick={() => { setShowDisable(false); setDisableCode(""); }}>{t("cancel")}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
```

Note: check `--ap-quiz` exists in `src/arcade-pop.css` (grep `--ap-quiz:`); if named differently, use the green/success token defined there.

- [ ] **Step 2: Integrate into ProfilePage**

In `src/pages/ProfilePage.tsx`:

1. Line 4: replace the import with

```tsx
import { getCurrentUser, updateProfile, User as AuthUser, type Theme, type Language, type Plan } from "@/lib/auth";
```

2. Add: `import { SecuritySection } from "@/components/SecuritySection";`

3. Replace `handleSave` (lines 107–118) with:

```tsx
  const handleSave = async () => {
    if (!user) return;
    if (!username.trim()) { toast.error(t("usernameRequired")); return; }
    const updatedUser = await updateProfile({ username: username.trim(), theme, language });
    if (!updatedUser) { toast.error(t("loginError")); return; }
    setUser(updatedUser);
    setI18nLanguage(language);
    document.documentElement.classList.toggle("dark", theme === "dark");
    toast.success(t("profileUpdated"));
    setTimeout(() => window.location.reload(), 500);
  };
```

4. After the Preferences card (`</div>` closing it, line ~322), add:

```tsx
          {/* Security */}
          <SecuritySection />
```

- [ ] **Step 3: Verify build and tests**

Run: `npm run build && npx vitest run`
Expected: build PASS (ProfilePage error gone), tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/SecuritySection.tsx src/pages/ProfilePage.tsx
git commit -m "feat(auth): security section — password change and TOTP MFA management"
```

### Task 9: Phase 1 end-to-end verification (needs Task 0 done)

**Files:** none (manual verification)

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Walk the flows in a browser**

1. Register a new account → "check your inbox" view → click the email link → land signed in.
2. Logout → login with wrong password → `invalidCredentials` toast; correct password → home.
3. Settings → Security → change password (wrong current → error; valid → success) → logout → login with new password.
4. Settings → Security → enable 2FA → scan QR with an authenticator → verify code → badge on. Logout → login → MFA code step → in.
5. Disable 2FA with a code → login again without MFA step.
6. Forgot password → email received → reset page → new password → signed in.
7. Legacy migration: in the browser console seed a legacy user (`localStorage.setItem('quiz_users', JSON.stringify([{id:'old-1',email:'<your-test-email>',username:'X',createdAt:''}]))` and a quiz `localStorage.setItem('saved_quizzes', JSON.stringify([{id:'q1',userId:'old-1',title:'T',type:'quiz',questions:[]}]))`), reload, sign in with that email → My Quizzes shows the quiz; `quiz_users` gone.

- [ ] **Step 3: Fix anything broken, commit fixes**

```bash
git add -A && git commit -m "fix(auth): issues found in end-to-end verification"
```

(Skip the commit if nothing needed fixing.)

---

## Phase 2 — Backgrounds + fluidity

### Task 10: Remove opaque page backgrounds hiding the dot-grid motif

**Files (root page wrappers — remove ONLY the `backgroundColor`/`background` declaration, keep the rest of the style):**
- `src/pages/AuthPage.tsx:67`
- `src/pages/ProfilePage.tsx:132`
- `src/pages/Pricing.tsx:62`
- `src/pages/Confidentialite.tsx:17`
- `src/pages/Features.tsx:33`
- `src/pages/Contact.tsx:164`
- `src/pages/Help.tsx:113`
- `src/pages/CGU.tsx:17`
- `src/pages/MentionsLegales.tsx:17`
- `src/pages/About.tsx:46`
- `src/pages/JoinQuiz.tsx:115`
- `src/pages/JoinExam.tsx:49`
- `src/pages/MyFlashcards.tsx:372`
- `src/pages/MyPolls.tsx:400`
- `src/pages/QuizBuilderStart.tsx:58`
- `src/pages/DiscoverQuizzes.tsx:74`
- `src/pages/QuizResults.tsx:125`
- `src/pages/PollResults.tsx:159`
- `src/pages/MyExams.tsx:28`
- `src/pages/QuestionBank.tsx:335`
- `src/pages/CourseBuilder.tsx:253`
- `src/pages/ExamBuilder.tsx:149`
- `src/pages/CourseViewer.tsx:235`

Line numbers may have drifted; relocate with:

```bash
grep -rn "var(--ap-paper)" src/pages | grep -i "minheight\|min-h\|100vh"
```

- [ ] **Step 1: Remove the opaque background from each root wrapper listed above**

Example (`ProfilePage.tsx`): `{ minHeight: "100vh", backgroundColor: "var(--ap-paper)" }` → `{ minHeight: "100vh" }`.

Do NOT touch:
- Inner elements using `var(--ap-paper)` as a surface color (e.g. `PollResults.tsx:36`, `CourseViewer.tsx:329`, borders, chips).
- Live session screens with deliberate dark themed backgrounds (LiveQuizPage, ExamRoom, PreviewPage, QuizSession/PollSession components).

- [ ] **Step 2: Visual check**

Run `npm run dev`, visit: home, settings, my-quizzes, my-exams, pricing, auth, question-bank — dot motif visible on all, in light AND dark theme (toggle in settings). CourseViewer: if the motif hurts reading comfort there, restore its background and note it as a deliberate exception.

- [ ] **Step 3: Commit**

```bash
git add src/pages
git commit -m "style: unify page backgrounds — dot-grid motif visible on all standard pages"
```

### Task 11: Route transitions

**Files:**
- Create: `src/components/RouteTransition.tsx`
- Modify: `src/App.tsx`, `src/arcade-pop.css`

- [ ] **Step 1: Create `src/components/RouteTransition.tsx`**

```tsx
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

/** Re-mounts children on navigation so the enter animation replays. */
export const RouteTransition = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  return (
    <div key={location.pathname} className="ap-route-enter">
      {children}
    </div>
  );
};
```

- [ ] **Step 2: Add CSS to `src/arcade-pop.css`** (after the `.ap-app` block)

```css
/* ── Route transitions ─────────────────────────────────────────── */
@media (prefers-reduced-motion: no-preference) {
  .ap-route-enter { animation: ap-route-in .18s ease-out both; }
}
@keyframes ap-route-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: none; }
}
```

- [ ] **Step 3: Wire into App.tsx**

Import `RouteTransition` and wrap the `<Routes>` element (inside `<Suspense>`):

```tsx
<Suspense fallback={<RouteFallback />}>
  <RouteTransition>
    <Routes>
      ...
    </Routes>
  </RouteTransition>
</Suspense>
```

(`RouteFallback` comes in Task 12 — if doing this task first, keep `fallback={null}` for now.)

- [ ] **Step 4: Verify**

`npm run dev` → navigate between pages: content fades/slides in subtly. macOS: System Settings → Accessibility → Display → Reduce motion ON → no animation.

- [ ] **Step 5: Commit**

```bash
git add src/components/RouteTransition.tsx src/App.tsx src/arcade-pop.css
git commit -m "feat(ui): soft route transitions with reduced-motion support"
```

### Task 12: Route loading fallback (replace blank flash)

**Files:**
- Create: `src/components/RouteFallback.tsx`
- Modify: `src/App.tsx`, `src/arcade-pop.css`

- [ ] **Step 1: Create `src/components/RouteFallback.tsx`**

```tsx
/** Shown while a lazy route chunk loads — replaces the blank flash. */
export const RouteFallback = () => (
  <div
    style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}
    role="status"
    aria-label="Loading"
  >
    <div className="ap-route-loader">
      <span /><span /><span />
    </div>
  </div>
);
```

- [ ] **Step 2: Add CSS to `src/arcade-pop.css`** (after the route transition block)

```css
/* ── Route loader ──────────────────────────────────────────────── */
.ap-route-loader { display: flex; gap: 8px; }
.ap-route-loader span {
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--ap-brand);
  animation: ap-loader-bounce .9s ease-in-out infinite;
}
.ap-route-loader span:nth-child(2) { background: var(--ap-poll); animation-delay: .15s; }
.ap-route-loader span:nth-child(3) { background: var(--ap-pres); animation-delay: .3s; }
@keyframes ap-loader-bounce {
  0%, 60%, 100% { transform: none; }
  30% { transform: translateY(-8px); }
}
@media (prefers-reduced-motion: reduce) {
  .ap-route-loader span { animation: none; }
}
```

Check `--ap-poll` and `--ap-pres` exist in the token block at the top of `arcade-pop.css` (they are referenced by ProfilePage already); substitute any missing one with `--ap-brand`.

- [ ] **Step 3: Use as Suspense fallback in App.tsx**

```tsx
import { RouteFallback } from "@/components/RouteFallback";
```

`<Suspense fallback={null}>` → `<Suspense fallback={<RouteFallback />}>`.

- [ ] **Step 4: Verify**

`npm run dev` → hard-reload with devtools network throttling (Fast 4G) → bouncing dots appear instead of a blank screen while chunks load.

- [ ] **Step 5: Commit**

```bash
git add src/components/RouteFallback.tsx src/App.tsx src/arcade-pop.css
git commit -m "feat(ui): branded route loading fallback"
```

### Task 13: Card hover unification on dashboards

**Files:**
- Modify (audit list): `src/pages/MyQuizzes.tsx`, `src/pages/MyPolls.tsx`, `src/pages/MyFlashcards.tsx`, `src/pages/MyCourses.tsx`, `src/pages/MyExams.tsx`, `src/pages/QuestionBank.tsx`, `src/pages/DiscoverQuizzes.tsx`

`arcade-pop.css` already defines `.ap-card--hover` (translateY(-3px) + shadow). Interactive content cards should use it.

- [ ] **Step 1: Audit**

```bash
grep -n "className=\"ap-card" src/pages/MyQuizzes.tsx src/pages/MyPolls.tsx src/pages/MyFlashcards.tsx src/pages/MyCourses.tsx src/pages/MyExams.tsx src/pages/QuestionBank.tsx src/pages/DiscoverQuizzes.tsx
```

- [ ] **Step 2: For each clickable list/grid card (one that navigates or opens something on click) missing `ap-card--hover`, add the class**

Example: `className="ap-card"` → `className="ap-card ap-card--hover"`. Do NOT add it to static cards (stats, empty states, info panels).

- [ ] **Step 3: Verify visually**

`npm run dev` → each dashboard: hover a card → consistent lift + shadow, same feel across all dashboards.

- [ ] **Step 4: Commit**

```bash
git add src/pages
git commit -m "style: consistent hover lift on clickable dashboard cards"
```

### Task 14: Final verification

- [ ] **Step 1: Full check**

Run: `npm run lint && npm run build && npx vitest run`
Expected: all PASS (pre-existing lint warnings unrelated to this work are acceptable — compare with `git stash` if unsure).

- [ ] **Step 2: Smoke pass in browser**

Home → auth (login w/ MFA) → my-quizzes → settings (change password UI, MFA badge) → pricing → dark mode toggle → motif everywhere, transitions smooth, loader on cold navigation.

- [ ] **Step 3: Commit anything outstanding**

```bash
git add -A && git commit -m "chore: final polish pass fixes"
```

(Skip if clean.)
