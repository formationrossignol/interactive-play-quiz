-- Spec 04 — Interopérabilité, identité et administration Enterprise
-- (docs/product-specs/2026-08-10-lms-program/04-interoperability-identity.md).
-- INT-001 à INT-005, SAML half (OIDC half: 20260815040000_sso_oidc.sql).
--
-- Deliberately small: `identity_connections`/`identity_domains`/
-- `external_identities`/`identity_role_mappings`/`sso_logins` are already
-- protocol-agnostic (20260810180000 + 20260815040000) and are reused as-is —
-- a SAML connection is just an `identity_connections` row with
-- `protocol = 'saml'` and a different `metadata` shape (idp_entity_id/
-- idp_sso_url/idp_cert instead of OIDC's issuer/client_id/endpoints).
--
-- The IdP's x509 signing certificate is a PUBLIC key, not a secret — it goes
-- straight into `identity_connections.metadata` like OIDC's issuer/client_id
-- already do, no vault entry needed (identity_client_secrets exists for
-- exactly one reason: a client_secret that must be sent back in plaintext to
-- a token endpoint. A verification cert is never sent anywhere, only
-- compared against).
--
-- This app does not hold its own SP private key and does not sign
-- AuthnRequests: unsigned SP-initiated AuthnRequests are the common case for
-- every major IdP (Okta/Azure AD/Google Workspace all accept them), and the
-- actual trust boundary here is the IdP's *signed Response* being verified
-- on the way back — an unsigned request an attacker could forge only causes
-- an authenticated browser to be redirected through a login ceremony, it
-- can't itself forge an identity. Adding SP request-signing would mean
-- managing yet another private key with no corresponding security property
-- gained for this flow; not attempted here, and not blocking any INT-00x
-- requirement (INT-001's "certificats" plural is about a rotation window on
-- the *IdP's* cert — INT-005 — not this app owning a keypair too).
--
-- saml_login_states is SAML's equivalent of sso_login_states — same
-- single-use/TTL'd/service-role-only shape, keyed by RelayState (SAML's
-- opaque cross-request correlator, the analog of OIDC's `state`) instead of
-- PKCE (SAML has no code exchange leg to defend, the assertion itself is
-- signed end-to-end) — and additionally tracking the AuthnRequest's own
-- `id`, so the Response's `InResponseTo` can be checked against a value this
-- app actually issued, not merely well-formed (SAML's version of OIDC's
-- nonce check).
create table public.saml_login_states (
  id            uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.identity_connections(id) on delete cascade,
  relay_state   text not null unique,
  request_id    text not null,
  redirect_to   text not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null
);
create index saml_login_states_expires_idx on public.saml_login_states(expires_at);
alter table public.saml_login_states enable row level security;
-- No policies at all — service_role (edge functions) only, same shape as
-- sso_login_states/lti_login_states.

-- resolve_sso_connection_for_email() (20260815040000_sso_oidc.sql) predates
-- SAML and only ever returned id+display_name — correct when every
-- connection was OIDC, insufficient now: AuthPage.tsx's "Se connecter avec
-- {provider}" button needs to know which edge function to navigate to
-- (sso-login vs saml-login), it can't guess from the display name.
-- Same narrow posture as the original (active connections only, no other
-- fields) — just the one additional column that's now load-bearing.
-- `create or replace` can't change a `returns table(...)` column list —
-- drop first.
drop function if exists public.resolve_sso_connection_for_email(text);
create or replace function public.resolve_sso_connection_for_email(p_email text)
returns table(connection_id uuid, display_name text, protocol text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.display_name, c.protocol
  from public.identity_domains d
  join public.identity_connections c on c.id = d.connection_id
  where c.status = 'active'
    and lower(d.domain) = lower(split_part(p_email, '@', 2))
  limit 1;
$$;
revoke all on function public.resolve_sso_connection_for_email(text) from public;
grant execute on function public.resolve_sso_connection_for_email(text) to anon, authenticated;
