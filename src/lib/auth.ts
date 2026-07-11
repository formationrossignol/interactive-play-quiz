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
  /** SVG markup; render via data:image/svg+xml URI. */
  qrCodeSvg: string;
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
