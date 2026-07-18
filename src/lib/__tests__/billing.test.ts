// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
vi.mock('../supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invokeMock(...args) } },
}));

const fetchPlanMock = vi.fn();
const refreshCurrentUserMock = vi.fn();
vi.mock('../auth', () => ({
  fetchPlan: (...args: unknown[]) => fetchPlanMock(...args),
  refreshCurrentUser: (...args: unknown[]) => refreshCurrentUserMock(...args),
}));

import { startProCheckout, openBillingPortal, pollForPlanUpgrade } from '../billing';

beforeEach(() => {
  invokeMock.mockReset();
  fetchPlanMock.mockReset();
  refreshCurrentUserMock.mockReset();
  vi.stubGlobal('location', { href: '' });
  vi.stubGlobal('open', vi.fn());
});

describe('startProCheckout', () => {
  it('redirects to the returned checkout URL', async () => {
    invokeMock.mockResolvedValue({ data: { url: 'https://checkout.stripe.com/abc' }, error: null });
    const result = await startProCheckout();
    expect(result.ok).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith('create-checkout-session', { body: {} });
    expect(window.location.href).toBe('https://checkout.stripe.com/abc');
  });

  it('returns an error when the function call fails', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('boom') });
    const result = await startProCheckout();
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe('openBillingPortal', () => {
  it('opens the returned portal URL in a new tab', async () => {
    invokeMock.mockResolvedValue({ data: { url: 'https://billing.stripe.com/xyz' }, error: null });
    const result = await openBillingPortal();
    expect(result.ok).toBe(true);
    expect(window.open).toHaveBeenCalledWith('https://billing.stripe.com/xyz', '_blank');
  });
});

describe('pollForPlanUpgrade', () => {
  beforeEach(() => vi.useFakeTimers());

  it('resolves true and refreshes the cache as soon as plan flips to pro', async () => {
    fetchPlanMock.mockResolvedValueOnce('starter').mockResolvedValueOnce('pro');
    const promise = pollForPlanUpgrade('user-1');
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await promise).toBe(true);
    expect(refreshCurrentUserMock).toHaveBeenCalledTimes(1);
  });

  it('resolves false after the max attempts if plan never flips', async () => {
    fetchPlanMock.mockResolvedValue('starter');
    const promise = pollForPlanUpgrade('user-1');
    await vi.advanceTimersByTimeAsync(8000);
    expect(await promise).toBe(false);
    expect(refreshCurrentUserMock).not.toHaveBeenCalled();
  });
});
