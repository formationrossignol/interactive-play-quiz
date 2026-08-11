-- Spec 04 — Interopérabilité, identité et administration Enterprise
-- (docs/product-specs/2026-08-10-lms-program/04-interoperability-identity.md).
--
-- LTI 1.3 Core OIDC login (LTI-001) needs somewhere to hold `state`/`nonce`
-- between the login-initiation redirect and the launch POST that follows
-- it seconds later — a classic OIDC third-party-initiated-login flow. A
-- signed cookie would be the usual choice, but the platform's redirect is a
-- cross-site form_post through the platform's own domain, which SameSite
-- cookie rules make unreliable here; a short-lived server-side row, single-
-- use and TTL'd, is the standard workaround serverless LTI tools use
-- instead. Written/read only by supabase/functions/lti-login and
-- lti-launch (service_role, bypasses RLS) — no client ever touches this
-- table, same "RLS enabled, zero policies" shape as session_quiz_answers.
create table public.lti_login_states (
  id               uuid primary key default gen_random_uuid(),
  registration_id  uuid not null references public.lti_registrations(id) on delete cascade,
  state            text not null unique,
  nonce            text not null,
  target_link_uri  text not null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null
);
create index lti_login_states_expires_idx on public.lti_login_states(expires_at);

alter table public.lti_login_states enable row level security;
