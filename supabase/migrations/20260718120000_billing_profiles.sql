-- Billing: plan + Stripe subscription state on profiles.
-- No new RLS needed — profiles_read_self (from 20260716120000) already
-- covers owner-read, and there is still no client INSERT/UPDATE policy on
-- profiles at all. plan becomes exactly as unwritable by the client as
-- role already is; only handle_new_user (trigger) and the stripe-webhook
-- edge function (service-role) may write these columns.

alter table public.profiles
  add column if not exists plan text not null default 'starter'
    check (plan in ('starter', 'pro', 'entreprise')),
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists subscription_status text;
