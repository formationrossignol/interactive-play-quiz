# Stripe Billing for the Pro Plan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Pro plan a real, paid product — Stripe Checkout to subscribe, a webhook as the sole writer of plan state, a Billing Portal to cancel — while closing the client-writable `plan` security hole in `updateProfile()`.

**Architecture:** Extend the existing `public.profiles` table (owner-read, no-client-write RLS already in place) with `plan`/Stripe columns. Three new Supabase Edge Functions (`create-checkout-session`, `create-portal-session`, `stripe-webhook`) talk to Stripe; the webhook is the only writer of `plan`. `src/lib/auth.ts` starts reading `plan` from `profiles` instead of `user_metadata`, merged into the existing synchronous `User` cache so every existing cap/gating call site is untouched.

**Tech Stack:** Supabase Postgres + Edge Functions (Deno), Stripe (Checkout, Billing Portal, Webhooks) via `npm:stripe`, React/TypeScript client, Vitest (client tests) + `deno test` (edge function tests).

Spec: `docs/superpowers/specs/2026-07-18-stripe-billing-design.md`

---

### Task 1: DB migration — billing columns on `profiles`

**Files:**
- Create: `supabase/migrations/20260718120000_billing_profiles.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Billing: plan + Stripe subscription state on profiles.
-- No new RLS needed — profiles_read_self (from 20260716120000) already
-- covers owner-read, and there is still no client INSERT/UPDATE policy on
-- profiles at all. plan becomes exactly as unwritable by the client as
-- role already is; only handle_new_user (trigger) and the stripe-webhook
-- edge function (service-role) may write these columns.

alter table public.profiles
  add column plan text not null default 'starter'
    check (plan in ('starter', 'pro', 'entreprise')),
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text unique,
  add column subscription_status text;
```

- [ ] **Step 2: Apply locally and verify**

Run: `npx supabase db reset` (or `npx supabase migration up` if a local stack is already running)
Expected: migration applies with no errors; `\d public.profiles` in the local DB shows the four new columns.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260718120000_billing_profiles.sql
git commit -m "feat(db): add billing columns to profiles"
```

---

### Task 2: Plan-mapping logic — `_shared/billing.ts`

Pure logic extracted for testability, same pattern as the existing
`_shared/scoring.ts` (checked answer logic tested via `deno test`,
separate from the untested `Deno.serve` handlers).

**Files:**
- Create: `supabase/functions/_shared/billing.ts`
- Test: `supabase/functions/_shared/billing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// supabase/functions/_shared/billing.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { planForSubscriptionStatus } from "./billing.ts";

Deno.test("active/trialing/past_due map to pro (grace period on payment failure)", () => {
  assertEquals(planForSubscriptionStatus("active"), "pro");
  assertEquals(planForSubscriptionStatus("trialing"), "pro");
  assertEquals(planForSubscriptionStatus("past_due"), "pro");
});

Deno.test("canceled/unpaid map to starter", () => {
  assertEquals(planForSubscriptionStatus("canceled"), "starter");
  assertEquals(planForSubscriptionStatus("unpaid"), "starter");
});

Deno.test("unrecognized status defaults to starter", () => {
  assertEquals(planForSubscriptionStatus("incomplete_expired"), "starter");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test supabase/functions/_shared/billing.test.ts`
Expected: FAIL — `billing.ts` does not exist / `planForSubscriptionStatus` is not defined.

- [ ] **Step 3: Write the implementation**

```ts
// supabase/functions/_shared/billing.ts
export type BillingPlan = "starter" | "pro";

// Stripe subscription statuses that still grant Pro access. "past_due"
// stays in this list deliberately — a payment retry in progress is not
// treated as a downgrade (see spec: grace period on payment failure).
const PRO_STATUSES = new Set(["active", "trialing", "past_due"]);

export function planForSubscriptionStatus(status: string): BillingPlan {
  return PRO_STATUSES.has(status) ? "pro" : "starter";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test supabase/functions/_shared/billing.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/billing.ts supabase/functions/_shared/billing.test.ts
git commit -m "feat(billing): add subscription-status-to-plan mapping"
```

---

### Task 3: Stripe client factory — `_shared/stripe.ts`

**Files:**
- Create: `supabase/functions/_shared/stripe.ts`

No test — this is a thin config factory (mirrors `_shared/cors.ts`, which
is also untested). Deno lacks Node's `http` module, so the Stripe SDK
needs an explicit fetch-based HTTP client; webhook signature verification
needs an explicit SubtleCrypto provider since Deno lacks Node's `crypto`
module the sync verifier relies on.

- [ ] **Step 1: Write the factory**

```ts
// supabase/functions/_shared/stripe.ts
import Stripe from "npm:stripe@17";

let cachedCryptoProvider: ReturnType<typeof Stripe.createSubtleCryptoProvider> | null = null;

export function getStripeClient(): Stripe {
  return new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

// Signature verification needs async SubtleCrypto in Deno (Stripe's
// default constructEvent verifier uses Node's sync crypto, unavailable
// here) — see stripe-webhook/index.ts's use of constructEventAsync.
export function getStripeCryptoProvider() {
  if (!cachedCryptoProvider) {
    cachedCryptoProvider = Stripe.createSubtleCryptoProvider();
  }
  return cachedCryptoProvider;
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/stripe.ts
git commit -m "feat(billing): add Stripe client factory for edge functions"
```

---

### Task 4: `create-checkout-session` edge function

**Files:**
- Create: `supabase/functions/create-checkout-session/index.ts`

- [ ] **Step 1: Write the function**

```ts
// supabase/functions/create-checkout-session/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { getStripeClient } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = getStripeClient();
    let customerId = profile.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const origin = req.headers.get("origin") ?? Deno.env.get("APP_ORIGIN") ?? "https://brivia.app";
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: Deno.env.get("STRIPE_PRICE_ID_PRO")!, quantity: 1 }],
      success_url: `${origin}/profile?checkout=success`,
      cancel_url: `${origin}/pricing`,
    });

    return new Response(JSON.stringify({ url: checkoutSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[create-checkout-session] error:", err);
    return new Response(JSON.stringify({ error: "Failed to create checkout session" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

No handler-level test — matches the existing project convention (`create-session`, `advance-question`, `submit-answer` also have no handler tests, only `_shared/scoring.ts`'s pure logic is tested). End-to-end coverage happens in Task 13's Stripe test-mode walkthrough.

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/create-checkout-session/index.ts
git commit -m "feat(billing): add create-checkout-session edge function"
```

---

### Task 5: `create-portal-session` edge function

**Files:**
- Create: `supabase/functions/create-portal-session/index.ts`

- [ ] **Step 1: Write the function**

```ts
// supabase/functions/create-portal-session/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { getStripeClient } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: "No active subscription" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = getStripeClient();
    const origin = req.headers.get("origin") ?? Deno.env.get("APP_ORIGIN") ?? "https://brivia.app";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/profile`,
    });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[create-portal-session] error:", err);
    return new Response(JSON.stringify({ error: "Failed to create portal session" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/create-portal-session/index.ts
git commit -m "feat(billing): add create-portal-session edge function"
```

---

### Task 6: `stripe-webhook` edge function

The sole writer of `plan`/`stripe_subscription_id`/`subscription_status`
in the whole system. Public endpoint (Stripe calls it directly — no user
JWT, so no `corsHeaders`/CORS handling needed, this is server-to-server).

**Files:**
- Create: `supabase/functions/stripe-webhook/index.ts`

- [ ] **Step 1: Write the function**

```ts
// supabase/functions/stripe-webhook/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { getStripeClient, getStripeCryptoProvider } from "../_shared/stripe.ts";
import { planForSubscriptionStatus } from "../_shared/billing.ts";

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), { status: 400 });
  }

  const body = await req.text();
  const stripe = getStripeClient();

  let event;
  try {
    // constructEventAsync (not constructEvent): Deno has no Node crypto,
    // so verification must go through the SubtleCrypto provider.
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
      undefined,
      getStripeCryptoProvider()
    );
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as { customer: string; subscription: string };
        await supabaseAdmin
          .from("profiles")
          .update({
            stripe_subscription_id: session.subscription,
            plan: "pro",
            subscription_status: "active",
          })
          .eq("stripe_customer_id", session.customer);
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as { id: string; status: string };
        await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: subscription.status,
            plan: planForSubscriptionStatus(subscription.status),
          })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as { id: string };
        await supabaseAdmin
          .from("profiles")
          .update({ plan: "starter", subscription_status: "canceled" })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }
      default:
        // Other event types (invoices, payment methods, etc.) are not
        // relevant to plan state — ignored, not an error.
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] handler error:", err);
    return new Response(JSON.stringify({ error: "Webhook handler failed" }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "feat(billing): add stripe-webhook edge function"
```

---

### Task 7: Disable JWT verification for the webhook

Stripe cannot send a Supabase-signed JWT, and every edge function defaults
to requiring one. Without this, Stripe's calls get rejected before they
ever reach the handler.

**Files:**
- Modify: `supabase/config.toml`

- [ ] **Step 1: Add the per-function override**

Append to the end of `supabase/config.toml`:

```toml
[functions.stripe-webhook]
verify_jwt = false
```

- [ ] **Step 2: Commit**

```bash
git add supabase/config.toml
git commit -m "chore(billing): disable JWT verification for stripe-webhook"
```

(Note for Task 13: when deployed via the Supabase Dashboard rather than
the CLI, this same setting also needs to be toggled off in the function's
"Enforce JWT Verification" setting in Studio — `config.toml` only takes
effect through `supabase functions deploy`.)

---

### Task 8: `src/lib/auth.ts` — read `plan` from `profiles`, close the write hole

**Files:**
- Modify: `src/lib/auth.ts`
- Test: `src/lib/__tests__/auth.test.ts` (new)

- [ ] **Step 1: Write the failing test for the new `fetchPlan` helper**

```ts
// src/lib/__tests__/auth.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const singleMock = vi.fn();
const eqMock = vi.fn(() => ({ single: singleMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock('../supabase', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

import { fetchPlan } from '../auth';

beforeEach(() => {
  singleMock.mockReset();
  eqMock.mockClear();
  selectMock.mockClear();
  fromMock.mockClear();
});

describe('fetchPlan', () => {
  it('returns the plan from the profiles row', async () => {
    singleMock.mockResolvedValue({ data: { plan: 'pro' }, error: null });
    expect(await fetchPlan('user-1')).toBe('pro');
    expect(fromMock).toHaveBeenCalledWith('profiles');
    expect(selectMock).toHaveBeenCalledWith('plan');
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/auth.test.ts`
Expected: FAIL — `fetchPlan` is not exported from `../auth`.

- [ ] **Step 3: Remove `plan` from `mapUser`**

In `src/lib/auth.ts`, edit the `mapUser` function (currently lines 25-34):

```ts
const mapUser = (u: SupabaseUser): User => ({
  id: u.id,
  email: u.email ?? '',
  username: (u.user_metadata?.username as string) || (u.email ?? '').split('@')[0],
  createdAt: u.created_at,
  theme: u.user_metadata?.theme as Theme | undefined,
  siteTheme: u.user_metadata?.siteTheme as SiteTheme | undefined,
  language: u.user_metadata?.language as Language | undefined,
});
```

(Drops the `plan: u.user_metadata?.plan as Plan | undefined` line — that
source no longer exists.)

- [ ] **Step 4: Add `fetchPlan` and `mapUserWithPlan`**

Add directly below `mapUser`:

```ts
/**
 * Reads plan from public.profiles — the only source of truth now that
 * plan is server-controlled (see stripe-webhook, the sole writer).
 * Defaults to 'starter' on any error so a transient read failure never
 * silently grants elevated caps.
 */
export const fetchPlan = async (userId: string): Promise<Plan> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();
  if (error || !data) return 'starter';
  return data.plan as Plan;
};

const mapUserWithPlan = async (u: SupabaseUser): Promise<User> => ({
  ...mapUser(u),
  plan: await fetchPlan(u.id),
});
```

- [ ] **Step 5: Use `mapUserWithPlan` at every session-entry call site**

In `syncFromSession` (currently lines 59-77), replace the `mapUser` call:

```ts
const syncFromSession = async (session: Session | null) => {
  if (!session?.user) {
    setCache(null);
    return;
  }
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
    setCache(null);
    return;
  }
  setCache(await mapUserWithPlan(session.user));
  if (session.user.email) migrateLegacyLocalData(session.user.email, session.user.id);
  void migrateLocalToSupabase(session.user.id).catch((err) => {
    console.error('[content-migration] failed:', err);
  });
};
```

In `login` (currently lines 107-122), replace the `mapUser(data.user)` call:

```ts
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
  const user = await mapUserWithPlan(data.user);
  setCache(user);
  migrateLegacyLocalData(user.email, user.id);
  return { status: 'ok', user };
};
```

In `register` (currently lines 130-152), replace the `mapUser(data.user!)` call:

```ts
  if (!data.session) return { status: 'confirm_email' };
  const user = await mapUserWithPlan(data.user!);
  setCache(user);
  migrateLegacyLocalData(user.email, user.id);
  return { status: 'ok', user };
```

In `verifyMfaLogin` (currently lines 242-253), replace the `mapUser(data.user)` call:

```ts
export const verifyMfaLogin = async (code: string): Promise<User | null> => {
  const factor = await getVerifiedTotpFactor();
  if (!factor) return null;
  const ok = await verifyMfaCode(factor.id, code);
  if (!ok) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const user = await mapUserWithPlan(data.user);
  setCache(user);
  migrateLegacyLocalData(user.email, user.id);
  return user;
};
```

- [ ] **Step 6: Close the write hole in `updateProfile`**

Replace (currently lines 192-200):

```ts
export const updateProfile = async (
  patch: Partial<Pick<User, 'username' | 'theme' | 'siteTheme' | 'language'>>
): Promise<User | null> => {
  const { data, error } = await supabase.auth.updateUser({ data: patch });
  if (error || !data.user) return null;
  return { ...mapUser(data.user), plan: await fetchPlan(data.user.id) };
};
```

(`'plan'` removed from the `Pick` — any caller passing it is now a
TypeScript compile error. The return value still merges in the current
`plan` from `profiles`, unaffected by this call, so the returned `User`
stays complete; note this does NOT call `setCache` — matches current
behavior where callers, e.g. `ProfilePage.handleSave`, set state
themselves from the return value.)

- [ ] **Step 7: Add `refreshCurrentUser`, used by the checkout-return poll (Task 9)**

Add near the bottom of the "Session bootstrap" section, after `initAuth`:

```ts
/** Re-reads the current Supabase session and refreshes the cached User (plan included). */
export const refreshCurrentUser = async (): Promise<User | null> => {
  const { data } = await supabase.auth.getSession();
  await syncFromSession(data.session);
  return getCurrentUser();
};
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/auth.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (This is what catches any remaining caller that still tries to pass `plan` into `updateProfile`.)

- [ ] **Step 10: Commit**

```bash
git add src/lib/auth.ts src/lib/__tests__/auth.test.ts
git commit -m "fix(auth): read plan from profiles, close client-writable plan hole"
```

---

### Task 9: `src/lib/billing.ts` — client wrapper

**Files:**
- Create: `src/lib/billing.ts`
- Test: `src/lib/__tests__/billing.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/billing.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/billing.test.ts`
Expected: FAIL — `../billing` module does not exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/billing.ts
import { supabase } from './supabase';
import { fetchPlan, refreshCurrentUser } from './auth';

export const startProCheckout = async (): Promise<{ ok: boolean; error?: string }> => {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', { body: {} });
  if (error || !data?.url) return { ok: false, error: 'Impossible de préparer le paiement.' };
  window.location.href = data.url;
  return { ok: true };
};

export const openBillingPortal = async (): Promise<{ ok: boolean; error?: string }> => {
  const { data, error } = await supabase.functions.invoke('create-portal-session', { body: {} });
  if (error || !data?.url) return { ok: false, error: "Impossible d'ouvrir la gestion d'abonnement." };
  window.open(data.url, '_blank');
  return { ok: true };
};

const POLL_INTERVAL_MS = 1000;
const POLL_MAX_ATTEMPTS = 8;

/** Polls profiles.plan after a successful Checkout redirect (webhook race — see spec). */
export const pollForPlanUpgrade = async (userId: string): Promise<boolean> => {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const plan = await fetchPlan(userId);
    if (plan === 'pro') {
      await refreshCurrentUser();
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return false;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/billing.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing.ts src/lib/__tests__/billing.test.ts
git commit -m "feat(billing): add client wrapper for checkout, portal, and upgrade polling"
```

---

### Task 10: `Pricing.tsx` — wire the Pro CTA to Checkout

**Files:**
- Modify: `src/pages/Pricing.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/pages/Pricing.tsx`, alongside the existing imports:

```tsx
import { getCurrentUser } from "@/lib/auth";
import { startProCheckout } from "@/lib/billing";
import { toast } from "sonner";
```

- [ ] **Step 2: Replace the Pro plan's `onClick`**

The Pro entry in the `plans` array currently has:

```tsx
onClick: () => navigate('/auth'),
```

Replace with:

```tsx
onClick: async () => {
  if (!getCurrentUser()) { navigate('/auth'); return; }
  const result = await startProCheckout();
  if (!result.ok) toast.error(result.error ?? 'Erreur lors de la préparation du paiement.');
},
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual verify**

Run: `npm run dev`, open `/pricing` while logged out → clicking "Upgrade to Pro" still goes to `/auth` (unchanged). Log in with a Starter test account, click it again → redirected to a Stripe Checkout page (test mode, once Task 13's Stripe setup is done; until then it will show a toast error, which is expected — `STRIPE_PRICE_ID_PRO` doesn't exist yet).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Pricing.tsx
git commit -m "feat(pricing): wire Pro CTA to Stripe Checkout"
```

---

### Task 11: `ProfilePage.tsx` — checkout return + manage subscription

**Files:**
- Modify: `src/pages/ProfilePage.tsx`

- [ ] **Step 1: Add imports**

Replace the `react-router-dom` import line:

```tsx
import { useNavigate, useSearchParams } from "react-router-dom";
```

Add, alongside the other `@/lib` imports:

```tsx
import { openBillingPortal, pollForPlanUpgrade } from "@/lib/billing";
```

- [ ] **Step 2: Add the `useSearchParams` hook and checkout-return effect**

Inside the `ProfilePage` component, after the existing `useState`
declarations and before the first `useEffect`:

```tsx
const [searchParams, setSearchParams] = useSearchParams();
```

Add a new `useEffect`, after the existing data-loading `useEffect`:

```tsx
useEffect(() => {
  if (searchParams.get("checkout") !== "success" || !user) return;
  let cancelled = false;
  (async () => {
    const upgraded = await pollForPlanUpgrade(user.id);
    if (cancelled) return;
    if (upgraded) {
      const refreshed = getCurrentUser();
      if (refreshed) {
        setUser(refreshed);
        setPlan(refreshed.plan || "starter");
        setUsage(getContentUsage(refreshed.id, refreshed.plan || "starter"));
      }
      toast.success("Abonnement Pro activé !");
    } else {
      toast.message("Paiement en cours de traitement, actualisez la page dans un instant.");
    }
    setSearchParams(
      (prev) => {
        prev.delete("checkout");
        return prev;
      },
      { replace: true }
    );
  })();
  return () => {
    cancelled = true;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [user]);
```

- [ ] **Step 3: Add the "Manage subscription" button**

In the account-plan card render block, the existing upgrade button is:

```tsx
{!isEntreprise && (
  <button
    className="ap-btn ap-btn--pill"
    style={{ gap: "8px" }}
    onClick={() => navigate("/pricing")}
  >
    <Zap style={{ width: 15, height: 15 }} />
    Passer à {plan === 'starter' ? 'Pro' : 'Entreprise'}
  </button>
)}
```

Replace it with (adds a portal button for Pro users, keeps the
pricing-page button for Starter users):

```tsx
{plan === 'pro' && (
  <button
    className="ap-btn ap-btn--pill"
    style={{ gap: "8px" }}
    onClick={async () => {
      const result = await openBillingPortal();
      if (!result.ok) toast.error(result.error ?? "Erreur lors de l'ouverture de la gestion d'abonnement.");
    }}
  >
    <Zap style={{ width: 15, height: 15 }} />
    Gérer mon abonnement
  </button>
)}
{plan === 'starter' && (
  <button
    className="ap-btn ap-btn--pill"
    style={{ gap: "8px" }}
    onClick={() => navigate("/pricing")}
  >
    <Zap style={{ width: 15, height: 15 }} />
    Passer à Pro
  </button>
)}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Manual verify**

Run: `npm run dev`, open `/profile` on a Starter test account → "Passer à
Pro" button shown, no "Gérer mon abonnement". Navigate to
`/profile?checkout=success` directly (simulating a Checkout return) →
observe the poll running (network tab shows repeated `profiles` selects),
timing out after ~8s with the "en cours de traitement" toast (expected,
since this test account never actually paid). Once Task 13's Stripe setup
exists and a real test-mode subscription is created, re-verify this path
resolves to the success toast instead.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ProfilePage.tsx
git commit -m "feat(profile): add checkout-return handling and manage-subscription button"
```

---

### Task 12: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full client test suite**

Run: `npm test`
Expected: all tests pass, including the new `auth.test.ts` and `billing.test.ts`.

- [ ] **Step 2: Run the edge function tests**

Run: `deno test supabase/functions/_shared/`
Expected: all `billing.test.ts` (and pre-existing `scoring.test.ts`) tests pass.

- [ ] **Step 3: Full typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no new errors introduced by this feature.

- [ ] **Step 5: Commit (if any cleanup was needed)**

```bash
git status
# If clean, no commit needed.
```

---

### Task 13: Stripe setup + deploy runbook

Real external setup — not automatable, has to be done once by a human
with access to the Stripe dashboard and this project's Supabase project
(ref `lwwfgdebmggxjuvlazwf`, per [[prod-supabase-deploy-state]] memory).
Direct Postgres (`:5432`) is firewalled from this environment — the
migration must go through the Management API HTTPS endpoint or the
Dashboard SQL editor, same as every prior deploy on this project.

**Files:** none (external configuration + deploy)

- [ ] **Step 1: Create the Stripe product/price**

In the Stripe Dashboard (test mode first): Products → New → "Brivia Pro",
recurring price $19.00/month. Copy the resulting `price_...` id.

- [ ] **Step 2: Set edge function secrets**

```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_... --project-ref lwwfgdebmggxjuvlazwf
npx supabase secrets set STRIPE_PRICE_ID_PRO=price_... --project-ref lwwfgdebmggxjuvlazwf
```

(`STRIPE_WEBHOOK_SECRET` is set in Step 4, after the webhook endpoint
exists — Stripe only generates it once you register the endpoint URL.)

If `supabase secrets set` fails with an auth error (this project has hit
CLI/PAT auth issues before — see the quiz-music Task 7 deploy runbook),
set the same secrets from Dashboard → Project Settings → Edge Functions →
Secrets instead.

- [ ] **Step 3: Apply the migration**

Try the CLI first:

```bash
npx supabase db push --project-ref lwwfgdebmggxjuvlazwf
```

If it fails (network/auth — direct Postgres is known-firewalled from this
environment), apply via the Management API HTTPS endpoint instead, same
method used for every prior migration on this project:

```bash
curl -X POST "https://api.supabase.com/v1/projects/lwwfgdebmggxjuvlazwf/database/query" \
  -H "Authorization: Bearer <SUPABASE_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c "import json,sys; print(json.dumps({'query': open('supabase/migrations/20260718120000_billing_profiles.sql').read()}))")"
```

Expected: HTTP 201/200. Verify with a follow-up query
(`select column_name from information_schema.columns where table_name = 'profiles'`)
that `plan`, `stripe_customer_id`, `stripe_subscription_id`,
`subscription_status` are present.

- [ ] **Step 4: Deploy the three edge functions**

```bash
npx supabase functions deploy create-checkout-session --project-ref lwwfgdebmggxjuvlazwf
npx supabase functions deploy create-portal-session --project-ref lwwfgdebmggxjuvlazwf
npx supabase functions deploy stripe-webhook --project-ref lwwfgdebmggxjuvlazwf --no-verify-jwt
```

If the CLI can't authenticate, deploy via Dashboard → Edge Functions →
Deploy new function (paste `index.ts` contents) for each of the three.
For `stripe-webhook` specifically, after deploying, open its settings in
Studio and turn **off** "Enforce JWT Verification" — the `--no-verify-jwt`
CLI flag and the `config.toml` entry from Task 7 only take effect via
CLI deploys.

- [ ] **Step 5: Register the webhook endpoint in Stripe**

Stripe Dashboard → Developers → Webhooks → Add endpoint. URL:
`https://lwwfgdebmggxjuvlazwf.supabase.co/functions/v1/stripe-webhook`.
Events to send: `checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`. Copy
the generated signing secret (`whsec_...`).

- [ ] **Step 6: Set the webhook secret**

```bash
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref lwwfgdebmggxjuvlazwf
```

- [ ] **Step 7: End-to-end test-mode walkthrough**

With a Starter test account:
1. `/pricing` → click Pro CTA → redirected to Stripe Checkout → pay with
   Stripe's test card `4242 4242 4242 4242`, any future expiry/CVC.
2. Redirected back to `/profile?checkout=success` → poll resolves within
   a few seconds → "Abonnement Pro activé !" toast, plan badge now shows
   "Pro", usage bars disappear, "Gérer mon abonnement" button appears.
3. Click "Gérer mon abonnement" → Stripe Billing Portal opens in a new
   tab → cancel the subscription there.
4. Back in the app, reload `/profile` → within a few seconds of the
   cancellation webhook landing, plan reverts to "Starter", usage bars
   reappear reflecting actual content counts (nothing was deleted).
5. In Stripe Dashboard → the customer's subscription → confirm its
   `metadata`/status history matches what was observed in-app.

- [ ] **Step 8: Switch to live mode (only when ready to accept real payments)**

Repeat steps 1-6 with live-mode Stripe keys/price/webhook (separate from
test mode — Stripe keeps them fully separate). Not part of this
implementation pass; do this deliberately, later, once test-mode
verification above is solid.
