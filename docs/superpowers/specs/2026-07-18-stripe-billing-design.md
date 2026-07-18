# Real billing for the Pro plan (Stripe)

## Context

`plans-and-limits` (PR #81, merged) built the Starter/Pro/Entreprise cap
system: `CONTENT_CAPS`, `AUDIENCE_CAP`, and quiz question-type gating are
enforced throughout the app, driven by `getPlan(user)` in `src/lib/plans.ts`.
But `Plan` is stored in Supabase auth `user_metadata` and written by
`updateProfile()` (`src/lib/auth.ts:192-200`), which calls
`supabase.auth.updateUser({ data: patch })` with no server-side validation.
**Any authenticated user can currently set `plan: 'entreprise'` on
themselves from devtools** and get unlimited everything. There is no
payment flow at all — `Pricing.tsx`'s Pro CTA just routes to `/auth`, and
`ProfilePage.tsx`'s "Passer à Pro" button just routes to `/pricing`.

This spec makes the Pro plan a real, paid, server-controlled thing: Stripe
Checkout for signup, a webhook as the sole writer of plan state, and a
Stripe-hosted Billing Portal for cancellation — while closing the
self-promotion hole as part of the same change.

Separately, `public.profiles(id, role)` already exists in prod (Pages CMS
foundation, migration `20260716120000_pages_cms_foundation.sql`): one row
per auth user, RLS = owner can read their own row, **no client write
policy at all** — `role` is only ever set by the `handle_new_user` trigger
or a service-role client. This is exactly the shape billing state needs,
so this spec extends `profiles` rather than inventing a new table.

## Goals

- `plan` becomes server-controlled: only a Stripe webhook (via
  service-role) can change it. `updateProfile()` can no longer write it.
- A logged-in user can pay $19/mo for Pro via Stripe Checkout from
  `Pricing.tsx`.
- Subscription lifecycle (created/updated/canceled/payment failed) is
  reflected in `profiles.plan` automatically via webhook, with a grace
  period on payment failure.
- A Pro user can manage/cancel their subscription in-app via the Stripe
  Billing Portal.
- Every existing cap/gating call site (`getPlan`, `canCreateContent`,
  `AUDIENCE_CAP`, question-type gating) keeps working unchanged.

## Non-goals

- Entreprise stays manual/contact-sales — no Stripe price or self-serve
  flow for it in this pass.
- No custom cancel/invoice/payment-method UI — the Stripe Billing Portal
  covers all of that.
- No proration logic, no annual billing tier, no trial period — none of
  these exist in the current `Pricing.tsx` copy ($19/mo, no trial
  mentioned) and none are being added here.
- No change to what happens to a downgraded user's *existing* content
  beyond what `canCreateContent()` already does today (see Decisions).

## Data model — extend `profiles`

New migration `supabase/migrations/20260718120000_billing_profiles.sql`:

```sql
alter table public.profiles
  add column plan text not null default 'starter'
    check (plan in ('starter','pro','entreprise')),
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text unique,
  add column subscription_status text; -- Stripe's raw status, null until first checkout
```

No RLS changes needed. `profiles_read_self` (owner reads own row, admin
reads all) already covers reading `plan`. There is still no UPDATE/INSERT
policy for authenticated clients on `profiles` — `plan` is exactly as
unwritable by the client as `role` already is. Only `handle_new_user`
(trigger, `security definer`) and the new webhook (service-role client)
can write to this table.

## Client read path

`plan` moves out of `user_metadata` entirely.

- `src/lib/auth.ts` `mapUser()` drops `plan: u.user_metadata?.plan as
  Plan | undefined`.
- `syncFromSession()` adds one query after the existing
  `migrateLocalToSupabase` call:
  ```ts
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', session.user.id)
    .single();
  ```
  merged into the cached `User` before `setCache(...)`. This is the same
  pattern already used for the async MFA/migration work in that function —
  `getCurrentUser()` stays synchronous, reading the merged cache exactly
  as it does today.
- `updateProfile()`'s patch type
  (`Partial<Pick<User, 'username' | 'theme' | 'siteTheme' | 'language' |
  'plan'>>`) drops `'plan'`. This is the fix for the security gap — `plan`
  can no longer reach `supabase.auth.updateUser`.
- `login()` and `verifyMfaLogin()` (which call `mapUser()` directly instead
  of going through `syncFromSession()`) need the same profile fetch merged
  in before `setCache(user)`, so `plan` is present immediately after
  login, not just after the next session-restore.
- `Plan` and `getPlan()` in `src/lib/plans.ts` are unchanged. Every
  existing enforcement call site (`QuizBuilderStart.tsx`,
  `ExamBuilder.tsx`, `CourseBuilder.tsx`, `JoinQuiz.tsx`, `QuizBuilder.tsx`
  question-type gating, `ProfilePage.tsx` usage bars) keeps working with
  no changes — they all read `user.plan` via `getPlan(user)`, and that
  `User.plan` field still exists with the same type, just populated from a
  different source.

## Stripe Checkout — new edge function `create-checkout-session`

Follows the existing edge function pattern (`supabase/functions/
create-session/index.ts`): `npm:@supabase/supabase-js@2`, shared CORS
helper from `_shared/cors.ts`.

- Authenticated (reads the caller's JWT the same way other functions do).
- Looks up `profiles.stripe_customer_id` for the caller; if absent,
  creates a Stripe Customer (`email` = caller's auth email) and stores the
  id via a service-role client.
- Creates a Stripe Checkout Session, `mode: 'subscription'`, line item =
  `STRIPE_PRICE_ID_PRO` (one recurring $19/mo price, created once in the
  Stripe dashboard/CLI, id passed as a function secret).
- `success_url`: `<origin>/profile?checkout=success`
- `cancel_url`: `<origin>/pricing`
- Returns the Checkout Session URL; client does a full-page redirect to it
  (`window.location.href = url`), matching how Stripe Checkout is meant to
  be used (not an embedded iframe).

`Pricing.tsx`'s Pro card `onClick` changes from `navigate('/auth')` to: if
logged out, `navigate('/auth')` (unchanged); if logged in, call
`create-checkout-session` and redirect.

## Webhook — new edge function `stripe-webhook`

Public endpoint (Stripe calls it directly, no user JWT). Verifies the
signature header against `STRIPE_WEBHOOK_SECRET` using Stripe's SDK
verification helper before trusting the payload. Uses a service-role
Supabase client — the only writer of `plan`/`stripe_customer_id`/
`stripe_subscription_id`/`subscription_status` in the whole system.

Handles three event types:

| Event | Effect on `profiles` |
|---|---|
| `checkout.session.completed` | Look up row by `stripe_customer_id` (from the session's `customer` field); set `stripe_subscription_id` from the session, `plan = 'pro'`, `subscription_status = 'active'`. |
| `customer.subscription.updated` | Look up row by `stripe_subscription_id`; set `subscription_status` to the event's raw status. If status is `active`, `trialing`, or `past_due` → `plan = 'pro'` (grace period — see Decisions). If status is `canceled` or `unpaid` → `plan = 'starter'`. |
| `customer.subscription.deleted` | Look up row by `stripe_subscription_id`; `plan = 'starter'`, `subscription_status = 'canceled'`. |

All three updates are idempotent (plain `update ... where stripe_customer_id
= $1` / `where stripe_subscription_id = $1`), safe for Stripe's
at-least-once delivery and manual replay from the Stripe dashboard.

## Checkout return / webhook race

The browser redirect to `success_url` can land before or after the webhook
finishes updating `profiles`. `ProfilePage.tsx`, on mount with
`?checkout=success` in the URL:

1. Poll `profiles.plan` for the current user every ~1s, up to 8 attempts.
2. As soon as `plan === 'pro'` is observed, stop polling, refresh the
   cached `User` (re-run the same profile-merge logic used in
   `syncFromSession`), strip the query param, show a success toast.
3. If still not `'pro'` after 8s, stop polling, show a toast: "Paiement en
   cours de traitement, actualisez la page dans un instant." (Non-blocking
   — the webhook will land eventually; this is purely about not leaving
   the poll running forever.)

## Cancel / manage subscription — new edge function `create-portal-session`

Authenticated, same JWT pattern as `create-checkout-session`. Looks up the
caller's `stripe_customer_id`, creates a Stripe Billing Portal session,
returns its URL. `ProfilePage.tsx`'s account-plan card gets a "Gérer mon
abonnement" button, shown only when `plan === 'pro'` (replacing/alongside
the existing "Passer à Pro/Entreprise" button, which stays for Starter
users). Opens the portal URL in a new tab. The portal itself (Stripe UI)
handles cancellation, payment method updates, and invoice history — no
custom UI needed. Cancellation flows back into this app the same way
subscribing does: Stripe fires `customer.subscription.updated` (status →
`canceled`, if canceled immediately) or `customer.subscription.deleted`,
the webhook reacts, `plan` flips to `'starter'`.

## Decisions (previously open questions)

- **Storage:** extend the existing `profiles` table rather than a new
  `billing`/`subscriptions` table — this app has exactly one active plan
  per user, so a join buys nothing, and the RLS pattern already exists.
- **Read path:** `plan` folds into the existing async `syncFromSession()`
  merge into the `User` cache, so `getCurrentUser()`/`getPlan()` and every
  downstream cap/gating call site need zero changes.
- **Payment-failure grace period:** Pro access is **not** revoked the
  moment a payment fails (`past_due`). It's revoked only when Stripe's
  retries are exhausted and the subscription reaches `canceled`/`unpaid`
  (or is explicitly deleted). A transient card decline doesn't instantly
  drop someone's content caps.
- **Downgrade-below-cap:** existing content is never touched. Both
  Starter's `CONTENT_CAPS` and the participant `AUDIENCE_CAP` are already
  creation-time/join-time gates (`canCreateContent()`,
  `PlanLimitBlocker`), not read-time gates. A downgraded Pro user with 12
  quizzes keeps all 12 fully usable; they just can't create a 13th until
  they're back under 5 (by deleting some) or re-upgrade. No new
  enforcement code needed for this.
- **Checkout UX:** Stripe-hosted Checkout (full-page redirect), not an
  embedded/Elements flow — least code, PCI scope stays entirely with
  Stripe.
- **Cancel UX:** Stripe-hosted Billing Portal, not a custom in-app cancel
  button — same reasoning, and it gets invoice history / payment-method
  update for free.

## Secrets

New Supabase function secrets (`supabase secrets set`, same mechanism
already used for this project's other function secrets):

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_PRO`

Test-mode values for local/dev, live values set separately at deploy time
— no new pattern, matches how this project already separates its Supabase
project config.

## Testing

- Unit: `src/lib/auth.ts` profile-merge logic (mock Supabase client),
  `updateProfile()` no longer accepts/forwards `plan`.
- Edge functions: signature-verification rejection on a tampered payload;
  each of the three webhook event handlers against a fixture payload,
  asserting the resulting `profiles` row.
- Manual/E2E (documented as a runbook step, same as the
  `quiz-music-task7-deploy-runbook` pattern used for prior Supabase
  deploys): full Checkout flow in Stripe test mode with a test card,
  confirm `profiles.plan` flips to `'pro'` and the app reflects it without
  a manual reload; cancel via the portal, confirm it flips back.
