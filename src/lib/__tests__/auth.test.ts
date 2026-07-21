// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const singleMock = vi.fn();
const eqMock = vi.fn(() => ({ single: singleMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn((_table: string) => ({ select: selectMock }));

const signInWithPasswordMock = vi.fn();
const getAuthenticatorAssuranceLevelMock = vi.fn();

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPasswordMock(...args),
      mfa: {
        getAuthenticatorAssuranceLevel: () => getAuthenticatorAssuranceLevelMock(),
      },
    },
  },
}));

// login() also runs migrateLegacyLocalData as a side effect; stub it so the
// test only exercises the plan-sourcing behavior under test.
vi.mock('../authMigration', () => ({
  migrateLegacyLocalData: vi.fn(),
}));

import { fetchPlan, login } from '../auth';

beforeEach(() => {
  singleMock.mockReset();
  eqMock.mockClear();
  selectMock.mockClear();
  fromMock.mockClear();
  signInWithPasswordMock.mockReset();
  getAuthenticatorAssuranceLevelMock.mockReset();
  localStorage.clear();
});

describe('fetchPlan', () => {
  it('returns the plan from the profiles row', async () => {
    singleMock.mockResolvedValue({ data: { plan: 'pro', role: 'user' }, error: null });
    expect(await fetchPlan('user-1')).toBe('pro');
    expect(fromMock).toHaveBeenCalledWith('profiles');
    expect(selectMock).toHaveBeenCalledWith('plan, role');
    expect(eqMock).toHaveBeenCalledWith('id', 'user-1');
  });

  it('defaults to starter when the query errors', async () => {
    singleMock.mockResolvedValue({ data: null, error: new Error('boom') });
    expect(await fetchPlan('user-1')).toBe('starter');
  });

  it('defaults to starter when no row is found', async () => {
    singleMock.mockResolvedValue({ data: null, error: null });
    expect(await fetchPlan('user-1')).toBe('starter');
  });

  it('bumps admins on the starter row to pro', async () => {
    singleMock.mockResolvedValue({ data: { plan: 'starter', role: 'admin' }, error: null });
    expect(await fetchPlan('user-1')).toBe('pro');
  });

  it('keeps entreprise for an admin already on entreprise', async () => {
    singleMock.mockResolvedValue({ data: { plan: 'entreprise', role: 'admin' }, error: null });
    expect(await fetchPlan('user-1')).toBe('entreprise');
  });
});

describe('login', () => {
  it('never uses user_metadata.plan even when set to an elevated value', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          created_at: '2026-01-01T00:00:00.000Z',
          // Simulates a tampered/pre-fix value (or an attacker retrying the
          // old devtools trick) — mapUser must never read this field.
          user_metadata: { plan: 'entreprise' },
        },
        session: { user: {} },
      },
      error: null,
    });
    getAuthenticatorAssuranceLevelMock.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal1' },
      error: null,
    });
    singleMock.mockResolvedValue({ data: { plan: 'starter' }, error: null });

    const result = await login('test@example.com', 'password');

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.user.plan).toBe('starter'); // NOT 'entreprise' from user_metadata
    }
  });
});
