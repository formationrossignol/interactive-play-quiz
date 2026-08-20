-- Spec 04 — Interopérabilité, identité et administration Enterprise
-- (docs/product-specs/2026-08-10-lms-program/04-interoperability-identity.md).
-- INT-001 à INT-004, OIDC half only (SAML is a separate follow-up slice —
-- see 04-interoperability-identity.md's "Ordre de livraison obligatoire" #1,
-- which groups OIDC+SAML together but nothing here forecloses SAML reusing
-- `identity_connections`/`identity_domains`/`external_identities`, all
-- protocol-agnostic already).
--
-- `20260810180000_interoperability_identity.sql` posed the schema, deliberately
-- without the handshake. This migration adds only what the OIDC relying-party
-- flow needs that isn't already there:
--   - reversible client_secret storage (identity_client_secrets, vault-backed —
--     `integration_secrets`' hash-only vault is wrong for this: a client_secret
--     must be sent in plaintext to the IdP's token endpoint on every login, a
--     one-way hash can never serve that, this is not a style choice)
--   - sso_login_states (state/nonce/PKCE between the login redirect and the
--     callback — same "short-lived server-side row, not a cookie" shape as
--     lti_login_states, same reason: the IdP's redirect back is a cross-site
--     hop SameSite cookies don't survive reliably)
--   - identity_role_mappings (INT-004 attribute→role rules)
--   - sso_logins (diagnostic log, mirrors lti_launches)
--   - identity_connections.metadata already holds issuer/client_id/endpoints —
--     written directly by the admin UI via the existing admin-only RLS, no new
--     column needed for that part.

create extension if not exists supabase_vault;

-- ── identity_client_secrets : reversible, vault-encrypted ──────────────────
-- `vault.create_secret()` returns a `vault.secrets.id`; the plaintext itself
-- is never stored in this table or returned by any function granted to
-- `authenticated` — only `_decrypt_identity_client_secret()` (service_role
-- only, see bottom) can read it back, from inside the callback edge function
-- exchanging a code at the IdP's token endpoint.
create table public.identity_client_secrets (
  id             uuid primary key default gen_random_uuid(),
  connection_id  uuid not null references public.identity_connections(id) on delete cascade,
  vault_secret_id uuid not null references vault.secrets(id),
  version        integer not null default 1,
  is_active      boolean not null default true,
  created_by     uuid not null references auth.users(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  deactivated_at timestamptz
);
create index identity_client_secrets_connection_idx on public.identity_client_secrets(connection_id) where is_active;
alter table public.identity_client_secrets enable row level security;
-- No select policy for `authenticated`, same posture as `integration_secrets`
-- — only list_identity_client_secrets() (metadata, no vault id) reads this.

create table public.identity_role_mappings (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.identity_connections(id) on delete cascade,
  attribute_path text not null,
  match_value   text not null,
  target_role   text not null check (target_role in ('learner','trainer','pedago','registrar','admin')),
  priority      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index identity_role_mappings_connection_idx on public.identity_role_mappings(connection_id, priority);
alter table public.identity_role_mappings enable row level security;
create policy identity_role_mappings_admin on public.identity_role_mappings
  for all using (public.has_org_role(org_id, array['admin'])) with check (public.has_org_role(org_id, array['admin']));

-- Single-use, TTL'd — see lti_login_states for the identical rationale.
-- code_verifier is PKCE (RFC 7636): defense in depth on top of a confidential
-- client_secret, standard practice for an authorization-code flow whose
-- redirect leg passes through the user's browser.
create table public.sso_login_states (
  id             uuid primary key default gen_random_uuid(),
  connection_id  uuid not null references public.identity_connections(id) on delete cascade,
  state          text not null unique,
  nonce          text not null,
  code_verifier  text not null,
  redirect_to    text not null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null
);
create index sso_login_states_expires_idx on public.sso_login_states(expires_at);
alter table public.sso_login_states enable row level security;
-- No policies at all — service_role (edge functions) only, same shape as
-- lti_login_states.

-- Append-only diagnostic log — mirrors lti_launches. raw_attributes here
-- (per-login snapshot) is distinct from external_identities.raw_attributes
-- (latest-known snapshot, upserted on every successful login).
create table public.sso_logins (
  id               uuid primary key default gen_random_uuid(),
  connection_id    uuid not null references public.identity_connections(id) on delete cascade,
  external_subject text,
  raw_attributes   jsonb,
  user_id          uuid references auth.users(id),
  status           text not null check (status in ('success','rejected')),
  error_reason     text,
  logged_at        timestamptz not null default now()
);
create index sso_logins_connection_idx on public.sso_logins(connection_id, logged_at desc);
alter table public.sso_logins enable row level security;
create policy sso_logins_admin on public.sso_logins
  for select using (exists (
    select 1 from public.identity_connections c where c.id = connection_id and public.has_org_role(c.org_id, array['admin'])
  ));

-- ── client_secret vault helpers ─────────────────────────────────────────────
create or replace function public.create_identity_client_secret(p_connection_id uuid, p_plaintext text)
returns uuid
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_org_id uuid;
  v_vault_id uuid;
  v_id uuid;
  v_next_version integer;
begin
  select org_id into v_org_id from public.identity_connections where id = p_connection_id;
  if v_org_id is null or not public.has_org_role(v_org_id, array['admin']) then
    raise exception 'Not authorized';
  end if;
  if p_plaintext is null or length(p_plaintext) = 0 then
    raise exception 'Secret required';
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version from public.identity_client_secrets where connection_id = p_connection_id;

  -- Unique name required by vault.create_secret(); versioned so rotation
  -- (a second call for the same connection) never collides.
  v_vault_id := vault.create_secret(p_plaintext, 'identity_connection:' || p_connection_id::text || ':v' || v_next_version::text);

  insert into public.identity_client_secrets (connection_id, vault_secret_id, version, created_by)
  values (p_connection_id, v_vault_id, v_next_version, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.create_identity_client_secret(uuid, text) from public;
grant execute on function public.create_identity_client_secret(uuid, text) to authenticated;

-- INT-005: rotation with overlap — deactivate the old one only after the new
-- one is confirmed live; sso-callback tries the current secret first and
-- falls back to any other still-active one within the handover window.
create or replace function public.deactivate_identity_client_secret(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select c.org_id into v_org_id
  from public.identity_client_secrets s join public.identity_connections c on c.id = s.connection_id
  where s.id = p_id;
  if v_org_id is null or not public.has_org_role(v_org_id, array['admin']) then
    raise exception 'Not authorized';
  end if;
  update public.identity_client_secrets set is_active = false, deactivated_at = now() where id = p_id;
end;
$$;
revoke all on function public.deactivate_identity_client_secret(uuid) from public;
grant execute on function public.deactivate_identity_client_secret(uuid) to authenticated;

create or replace function public.list_identity_client_secrets(p_connection_id uuid)
returns table(id uuid, version integer, is_active boolean, created_at timestamptz, deactivated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.version, s.is_active, s.created_at, s.deactivated_at
  from public.identity_client_secrets s
  join public.identity_connections c on c.id = s.connection_id
  where s.connection_id = p_connection_id and public.has_org_role(c.org_id, array['admin'])
  order by s.version desc;
$$;
revoke all on function public.list_identity_client_secrets(uuid) from public;
grant execute on function public.list_identity_client_secrets(uuid) to authenticated;

-- service_role only — the callback edge function is the sole caller. Never
-- granted to authenticated/anon: this is the one function in the whole
-- vault-backed flow that can actually read a plaintext client_secret.
create or replace function public._decrypt_identity_client_secret(p_id uuid)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select ds.decrypted_secret
  from vault.decrypted_secrets ds
  join public.identity_client_secrets ics on ics.vault_secret_id = ds.id
  where ics.id = p_id;
$$;
revoke all on function public._decrypt_identity_client_secret(uuid) from public;
grant execute on function public._decrypt_identity_client_secret(uuid) to service_role;

-- ── role mapping resolution (INT-004) ──────────────────────────────────────
-- Accumulates every matching rule rather than stopping at the first — a
-- user whose IdP groups claim contains both "staff" and "lms-admin" should
-- get every role those rules grant, not just whichever sorts first.
-- Internal: called by preview_sso_role_mapping() (admin-gated) and by the
-- callback edge function (service_role) directly — never granted to
-- `authenticated` on its own, it has no auth check of its own.
create or replace function public._resolve_sso_roles(p_connection_id uuid, p_attributes jsonb)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_roles text[] := '{}';
  v_rule record;
  v_value jsonb;
begin
  for v_rule in select * from public.identity_role_mappings where connection_id = p_connection_id order by priority asc loop
    v_value := p_attributes -> v_rule.attribute_path;
    if v_value is null then
      continue;
    end if;
    if jsonb_typeof(v_value) = 'array' then
      if v_value ? v_rule.match_value then
        v_roles := array_append(v_roles, v_rule.target_role);
      end if;
    elsif (p_attributes ->> v_rule.attribute_path) = v_rule.match_value then
      v_roles := array_append(v_roles, v_rule.target_role);
    end if;
  end loop;
  return coalesce((select array_agg(distinct r) from unnest(v_roles) r), '{}');
end;
$$;
revoke all on function public._resolve_sso_roles(uuid, jsonb) from public;
grant execute on function public._resolve_sso_roles(uuid, jsonb) to service_role;

-- INT-004: "prévisualisé avant activation" — an admin pastes a sample
-- attributes payload (what their IdP's docs say it sends) and sees which
-- roles it would resolve to, without writing anything.
create or replace function public.preview_sso_role_mapping(p_connection_id uuid, p_sample_attributes jsonb)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from public.identity_connections where id = p_connection_id;
  if v_org_id is null or not public.has_org_role(v_org_id, array['admin']) then
    raise exception 'Not authorized';
  end if;
  return public._resolve_sso_roles(p_connection_id, p_sample_attributes);
end;
$$;
revoke all on function public.preview_sso_role_mapping(uuid, jsonb) from public;
grant execute on function public.preview_sso_role_mapping(uuid, jsonb) to authenticated;

-- ── diagnostic log write (mirrors record_lti_launch) ───────────────────────
create or replace function public.record_sso_login(
  p_connection_id uuid, p_external_subject text, p_raw_attributes jsonb,
  p_user_id uuid, p_status text, p_error_reason text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.sso_logins (connection_id, external_subject, raw_attributes, user_id, status, error_reason)
  values (p_connection_id, p_external_subject, p_raw_attributes, p_user_id, p_status, p_error_reason);
$$;
revoke all on function public.record_sso_login(uuid, text, jsonb, uuid, text, text) from public;
grant execute on function public.record_sso_login(uuid, text, jsonb, uuid, text, text) to authenticated, service_role;

-- INT-003: admin resolution for an unrecognized `sub` — mirrors
-- link_lti_subject() exactly, writing external_identities (the table this
-- schema already purpose-built for stable-subject linking) instead of
-- external_mappings. Upsert: re-linking the same (connection, subject) to a
-- different account is a deliberate admin override, not an error.
create or replace function public.link_sso_subject(
  p_connection_id uuid,
  p_external_subject text,
  p_internal_user_id uuid
)
returns public.external_identities
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_result public.external_identities;
begin
  select org_id into v_org_id from public.identity_connections where id = p_connection_id;
  if v_org_id is null then
    raise exception 'Unknown connection';
  end if;
  if not public.has_org_role(v_org_id, array['admin']) then
    raise exception 'Not an admin of this organization';
  end if;
  if p_external_subject is null or length(trim(p_external_subject)) = 0 then
    raise exception 'Subject required';
  end if;
  if not exists (
    select 1 from public.user_org_roles where org_id = v_org_id and user_id = p_internal_user_id
  ) then
    raise exception 'Target user is not a member of this organization';
  end if;

  insert into public.external_identities (org_id, connection_id, user_id, external_subject)
  values (v_org_id, p_connection_id, p_internal_user_id, p_external_subject)
  on conflict (connection_id, external_subject) do update set user_id = excluded.user_id
  returning * into v_result;

  return v_result;
end;
$$;
revoke all on function public.link_sso_subject(uuid, text, uuid) from public;
grant execute on function public.link_sso_subject(uuid, text, uuid) to authenticated;

-- ── public domain → connection resolution ──────────────────────────────────
-- Without this, INT-002's `mode` (optional/required_for_domains/admin_bypass)
-- is configuration nobody ever reads outside the admin panel — the exact
-- "table exists, nothing consumes it" gap this program keeps finding. The
-- real login page (AuthPage.tsx) needs *some* unauthenticated way to learn
-- "this email's domain has an SSO connection" before a session exists to
-- gate anything on. Deliberately narrow: only `active` connections, only
-- the fields a login button needs (id + display name), never metadata,
-- never which orgs exist for a domain that has no connection, never a
-- reason distinguishing "no connection" from "org doesn't exist" (both
-- return no rows — enumerating orgs by domain is not a leak this needs to
-- offer just to draw a button).
create or replace function public.resolve_sso_connection_for_email(p_email text)
returns table(connection_id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.display_name
  from public.identity_domains d
  join public.identity_connections c on c.id = d.connection_id
  where c.status = 'active'
    and lower(d.domain) = lower(split_part(p_email, '@', 2))
  limit 1;
$$;
revoke all on function public.resolve_sso_connection_for_email(text) from public;
grant execute on function public.resolve_sso_connection_for_email(text) to anon, authenticated;
