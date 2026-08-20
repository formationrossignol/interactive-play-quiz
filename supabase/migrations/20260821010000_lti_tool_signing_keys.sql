-- Spec 04 — Interopérabilité, identité et administration Enterprise
-- (docs/product-specs/2026-08-10-lms-program/04-interoperability-identity.md:62-75).
-- Foundation for LTI 1.3 Advantage (Deep Linking LTI-002, AGS LTI-004, NRPS
-- LTI-003) — NOT those features themselves, just the signing-key primitive
-- all three need underneath them.
--
-- This app has only ever *verified* incoming JWTs so far (`_shared/lti.ts`,
-- `_shared/oidc.ts` — both `jwtVerify`/`createRemoteJWKSet`, never `SignJWT`
-- outside test fixtures, confirmed by grep before writing this). Two LTI
-- Advantage capabilities both need this tool to sign its own JWTs instead:
--   - Deep Linking response: a signed `DeepLinkingResponse` message JWT
--     returned to the platform.
--   - AGS/NRPS: a signed `client_assertion` JWT (private_key_jwt, IMS
--     Security Framework) POSTed to the platform's own auth_token_url to get
--     a service access token — the reverse direction of everything built for
--     LTI Core launch verification so far.
-- Both need this tool to hold an RSA keypair and publish the public half as
-- a JWKS the platform admin points at when registering the tool.
--
-- Scope: per lti_registrations row, not one tool-wide key. `lti_registrations`
-- already scopes secrets per-connection everywhere else in this codebase
-- (identity_client_secrets is per identity_connection, not global) — a
-- leaked key here is scoped to exactly one org's one platform relationship,
-- not every org's LTI trust at once. The registration UI (Integrations.tsx)
-- already treats each registration as a distinct platform relationship (the
-- admin enters that platform's own issuer/client_id/jwks_url per row) with
-- no existing "one JWKS URL for the whole app" concept to preserve, so this
-- doesn't add complexity the admin flow didn't already have room for — the
-- new lti-jwks endpoint is parameterized by registration_id.

-- ── lti_tool_keys : reversible? NO — this tool only ever needs to SIGN with
-- the private key, never send it anywhere in plaintext (unlike identity_
-- client_secrets' client_secret, which must round-trip to an IdP's token
-- endpoint). Vault-encrypted anyway, same primitive, so the private key is
-- never stored as a plaintext column even though nothing outside this
-- project's own signing code ever needs to read it back. `kid` is what the
-- JWKS document and every signed JWT's header both carry — how a platform
-- (or a rotation) tells two keys for the same registration apart.
create table public.lti_tool_keys (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.lti_registrations(id) on delete cascade,
  kid             text not null,
  public_jwk      jsonb not null,
  vault_secret_id uuid not null references vault.secrets(id),
  version         integer not null default 1,
  is_active       boolean not null default true,
  created_by      uuid not null references auth.users(id) default auth.uid(),
  created_at      timestamptz not null default now(),
  deactivated_at  timestamptz,
  unique (registration_id, kid)
);
create index lti_tool_keys_registration_idx on public.lti_tool_keys(registration_id) where is_active;
alter table public.lti_tool_keys enable row level security;
create policy lti_tool_keys_admin on public.lti_tool_keys
  for select using (exists (
    select 1 from public.lti_registrations r where r.id = registration_id and public.has_org_role(r.org_id, array['admin'])
  ));
-- No insert/update/delete policy for `authenticated` at all — only
-- generate_lti_tool_key() (security definer, below) writes this table.
-- public_jwk (no private material) is fine to expose to an org admin via
-- the select policy above, for the diagnostics panel; the JWKS endpoint
-- itself is served by an edge function reading with service_role, not
-- through PostgREST, so this select policy isn't actually load-bearing for
-- the public JWKS — it exists for the future admin diagnostics UI only.

-- ── generate_lti_tool_key() : mint a new RSA keypair's storage row ─────────
-- The actual RSA key generation happens in the edge function (jose's
-- generateKeyPair — Postgres has no equivalent primitive to produce a
-- portable JWK/PKCS8 pair); this RPC only persists what the edge function
-- generated, after re-checking the caller is really an admin of this
-- registration's org (the edge function runs with the caller's own JWT via
-- supabase-js, not service_role, for this call specifically — key
-- generation is an admin action, not part of any unauthenticated flow).
create or replace function public.generate_lti_tool_key(
  p_registration_id uuid,
  p_kid text,
  p_public_jwk jsonb,
  p_vault_secret_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_org_id uuid;
  v_id uuid;
  v_next_version integer;
begin
  select org_id into v_org_id from public.lti_registrations where id = p_registration_id;
  if v_org_id is null or not public.has_org_role(v_org_id, array['admin']) then
    raise exception 'Not authorized';
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version from public.lti_tool_keys where registration_id = p_registration_id;

  insert into public.lti_tool_keys (registration_id, kid, public_jwk, vault_secret_id, version, created_by)
  values (p_registration_id, p_kid, p_public_jwk, p_vault_secret_id, v_next_version, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.generate_lti_tool_key(uuid, text, jsonb, uuid) from public;
grant execute on function public.generate_lti_tool_key(uuid, text, jsonb, uuid) to authenticated;

-- INT-005-style rotation with overlap: deactivating an old key only after a
-- new one is confirmed live keeps the JWKS document serving both during a
-- platform's own JWKS cache refresh window (same reasoning as identity_
-- client_secrets' rotation, just for a signing key instead of a shared
-- secret).
create or replace function public.deactivate_lti_tool_key(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select r.org_id into v_org_id
  from public.lti_tool_keys k join public.lti_registrations r on r.id = k.registration_id
  where k.id = p_id;
  if v_org_id is null or not public.has_org_role(v_org_id, array['admin']) then
    raise exception 'Not authorized';
  end if;
  update public.lti_tool_keys set is_active = false, deactivated_at = now() where id = p_id;
end;
$$;
revoke all on function public.deactivate_lti_tool_key(uuid) from public;
grant execute on function public.deactivate_lti_tool_key(uuid) to authenticated;

-- Public JWKS document for a registration — every active key's public half,
-- no auth required (this is what a platform's own LTI stack fetches to
-- verify this tool's signed Deep Linking responses / client assertions,
-- exactly the same trust shape as `lti_registrations.jwks_url` already
-- being the PLATFORM's public key for the reverse direction). No filtering
-- beyond registration_id + is_active: a JWKS document is public key
-- material by definition, there is nothing here to protect with RLS.
create or replace function public.get_lti_tool_jwks(p_registration_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_build_object('keys', jsonb_agg(k.public_jwk)), jsonb_build_object('keys', '[]'::jsonb))
  from public.lti_tool_keys k
  where k.registration_id = p_registration_id and k.is_active;
$$;
revoke all on function public.get_lti_tool_jwks(uuid) from public;
grant execute on function public.get_lti_tool_jwks(uuid) to anon, authenticated, service_role;

-- service_role only — the sole caller is the signing helper inside edge
-- functions building a Deep Linking response or an AGS/NRPS client
-- assertion. Never granted to authenticated/anon: this is the one function
-- in this whole table that can read a private key back, mirroring
-- _decrypt_identity_client_secret()'s exact posture (including the same
-- "narrow grant, no internal auth check of its own because none is needed
-- when only service_role can ever call it" reasoning — see that function's
-- comment and the record_sso_login grant fix earlier this session for why
-- an authenticated grant here would be a real bug, not a style choice).
create or replace function public._decrypt_lti_tool_key(p_id uuid)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select ds.decrypted_secret
  from vault.decrypted_secrets ds
  join public.lti_tool_keys ltk on ltk.vault_secret_id = ds.id
  where ltk.id = p_id;
$$;
revoke all on function public._decrypt_lti_tool_key(uuid) from public;
grant execute on function public._decrypt_lti_tool_key(uuid) to service_role;
