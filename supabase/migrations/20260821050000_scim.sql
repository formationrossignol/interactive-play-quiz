-- Spec 04 — Interopérabilité, identité et administration Enterprise
-- (docs/product-specs/2026-08-10-lms-program/04-interoperability-identity.md:96-103).
-- SCIM 2.0 (SCM-001 to SCM-004). `api_clients`/`api_tokens` already exist
-- (20260810180000_interoperability_identity.sql) but are completely unused —
-- `token_hash` has no writer, no verifier, same "table exists, nothing
-- consumes it" pattern this program keeps finding. This migration is the
-- first thing in this codebase to actually issue and verify a static bearer
-- token an external system presents on every request — genuinely new for
-- this repo, not a variant of the JWT-verification pattern used everywhere
-- else (SSO/LTI/OIDC all verify a signed JWT; SCIM verifies a random opaque
-- token by hash lookup, closer to an API key).
--
-- Auto-provisioning stance, deliberately different from SSO/LTI: this
-- session followed "never auto-provision from an unrecognized external
-- identity" strictly for SSO subjects (external_identities) and LTI launch/
-- NRPS subjects (external_mappings) — those guard against a bare unverified
-- claim showing up with no prior trust established. SCIM is the opposite by
-- protocol design: an admin-issued, token-authenticated `POST /Users` IS the
-- provisioning event itself, not a claim to be verified against something
-- pre-existing. Building SCIM to refuse account creation would defeat the
-- protocol's entire purpose. SCM-001 creates real accounts for real.
--
-- Admin-role mapping: identity_role_mappings (SSO, 20260815040000) already
-- allows mapping to 'admin' at the schema level — that precedent is followed
-- here too, not NRPS's stricter no-admin-path posture. Reasoning: NRPS's
-- roster claims come from arbitrary platform-reported role URNs the
-- receiving app cannot verify; a SCIM connection's token can only exist
-- because an org admin deliberately created it — a stronger trust boundary
-- the org itself controls, not an external system's unverifiable claim. If
-- an org admin wants a SCIM group to map to Brivia 'admin', that is their
-- call to make for their own org, same as SSO's existing posture.
--
-- "Groupes Brivia" gap, stated plainly: SCM-004 asks for SCIM group →
-- org/role/Brivia-group mapping. Org is implicit (a SCIM connection is
-- itself org-scoped via api_clients.org_id). Role mapping is built for real
-- below. `share_groups` (referenced only via FK elsewhere in this codebase,
-- not defined in any spec-04-era migration) is personal/trainer-owned, not
-- an org-wide concept — there is no real org-scoped Brivia group to map
-- SCIM groups onto. Not forced into share_groups as a wrong-shaped hack;
-- SCIM groups exist here as their own resource (scim_groups) with role
-- mapping only, no Brivia-group mapping attempted.

-- ── api_tokens: add per-token scopes (SCM-002 — "jetons ... de périmètre
-- limité" reads as per-token, not just per-client; api_clients.scopes alone
-- would give every token issued for a client the client's full scope set,
-- with no way to issue a narrower one) ─────────────────────────────────────
alter table public.api_tokens add column if not exists scopes text[];
alter table public.api_tokens add column if not exists label text;
create unique index if not exists api_tokens_hash_idx on public.api_tokens(token_hash);

-- ── create_api_token() : admin action, returns plaintext once ──────────────
-- SHA-256 of a 32-byte random token (crypto.getRandomValues, edge-function
-- side) is the correct primitive here, not a password hash (bcrypt/scrypt) —
-- this is a high-entropy machine-generated secret being verified by DB
-- lookup, not a low-entropy human password vulnerable to offline guessing;
-- a unique index on token_hash makes the lookup a real index seek, not a
-- linear scan, which is the standard mitigation for this threat model.
create or replace function public.create_api_token(
  p_client_id uuid,
  p_scopes text[],
  p_expires_at timestamptz,
  p_token_hash text,
  p_label text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_id uuid;
begin
  select org_id into v_org_id from public.api_clients where id = p_client_id;
  if v_org_id is null or not public.has_org_role(v_org_id, array['admin']) then
    raise exception 'Not authorized';
  end if;
  if p_token_hash is null or length(p_token_hash) = 0 then
    raise exception 'Token hash required';
  end if;

  insert into public.api_tokens (client_id, token_hash, scopes, expires_at, label)
  values (p_client_id, p_token_hash, p_scopes, p_expires_at, p_label)
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.create_api_token(uuid, text[], timestamptz, text, text) from public;
grant execute on function public.create_api_token(uuid, text[], timestamptz, text, text) to authenticated;

create or replace function public.revoke_api_token(p_token_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select c.org_id into v_org_id
  from public.api_tokens t join public.api_clients c on c.id = t.client_id
  where t.id = p_token_id;
  if v_org_id is null or not public.has_org_role(v_org_id, array['admin']) then
    raise exception 'Not authorized';
  end if;
  update public.api_tokens set revoked_at = now() where id = p_token_id;
end;
$$;
revoke all on function public.revoke_api_token(uuid) from public;
grant execute on function public.revoke_api_token(uuid) to authenticated;

create or replace function public.list_api_tokens(p_client_id uuid)
returns table(id uuid, label text, scopes text[], expires_at timestamptz, revoked_at timestamptz, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.label, t.scopes, t.expires_at, t.revoked_at, t.created_at
  from public.api_tokens t join public.api_clients c on c.id = t.client_id
  where t.client_id = p_client_id and public.has_org_role(c.org_id, array['admin'])
  order by t.created_at desc;
$$;
revoke all on function public.list_api_tokens(uuid) from public;
grant execute on function public.list_api_tokens(uuid) to authenticated;

-- service_role only — the sole caller is the SCIM auth helper inside every
-- scim-* edge function, resolving a hashed bearer token on every inbound
-- request. Never granted to authenticated/anon: this is the one function
-- that can confirm a token is currently valid (client_id/org_id/scopes),
-- mirrors _decrypt_lti_tool_key()/_decrypt_identity_client_secret()'s exact
-- posture — narrow grant, no internal auth check needed because only
-- service_role can ever call it (the record_sso_login lesson from earlier
-- this session: an authenticated grant here with no internal check would be
-- the same class of bug).
create or replace function public._verify_api_token(p_token_hash text)
returns table(client_id uuid, org_id uuid, scopes text[])
language sql
stable
security definer
set search_path = public
as $$
  select t.client_id, c.org_id, coalesce(t.scopes, c.scopes)
  from public.api_tokens t
  join public.api_clients c on c.id = t.client_id
  where t.token_hash = p_token_hash
    and t.revoked_at is null
    and (t.expires_at is null or t.expires_at > now())
    and c.status = 'active';
$$;
revoke all on function public._verify_api_token(text) from public;
grant execute on function public._verify_api_token(text) to service_role;

-- ── scim_users : SCIM resource ↔ Brivia account, per SCIM connection ───────
-- Brivia's own auth.users.id IS the SCIM resource `id` returned to the IdP
-- (stable across polls, this app is authoritative for that id space —
-- no separate resource-id generation needed). `external_id` is the IdP's
-- OWN identifier for the same person (SCIM's optional `externalId`,
-- echoed back verbatim, never generated here). `active` is per (client,
-- user): the same Brivia account can be provisioned from more than one
-- org's SCIM connection, and deactivating it via one connection must not
-- silently deactivate it for another.
create table public.scim_users (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.api_clients(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  external_id text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (client_id, user_id)
);
create index scim_users_client_idx on public.scim_users(client_id);
alter table public.scim_users enable row level security;
create policy scim_users_admin on public.scim_users
  for select using (exists (
    select 1 from public.api_clients c where c.id = client_id and public.has_org_role(c.org_id, array['admin'])
  ));
-- No insert/update/delete policy for authenticated: only the scim-users
-- edge function (service_role, already past _verify_api_token) writes this.
create trigger scim_users_touch before update on public.scim_users
  for each row execute function public.touch_updated_at();

-- ── scim_groups / scim_group_members ────────────────────────────────────
create table public.scim_groups (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.api_clients(id) on delete cascade,
  external_id  text,
  display_name text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (client_id, display_name)
);
create index scim_groups_client_idx on public.scim_groups(client_id);
alter table public.scim_groups enable row level security;
create policy scim_groups_admin on public.scim_groups
  for select using (exists (
    select 1 from public.api_clients c where c.id = client_id and public.has_org_role(c.org_id, array['admin'])
  ));
create trigger scim_groups_touch before update on public.scim_groups
  for each row execute function public.touch_updated_at();

create table public.scim_group_members (
  group_id   uuid not null references public.scim_groups(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.scim_group_members enable row level security;
create policy scim_group_members_admin on public.scim_group_members
  for select using (exists (
    select 1 from public.scim_groups g join public.api_clients c on c.id = g.client_id
    where g.id = group_id and public.has_org_role(c.org_id, array['admin'])
  ));

-- ── scim_group_role_mappings (SCM-004) ──────────────────────────────────
-- Mirrors identity_role_mappings' shape (SSO, 20260815040000) — a SCIM
-- group's display_name is the match key instead of an arbitrary IdP
-- attribute path, everything else the same convention. target_role allows
-- 'admin' — see file header for why that's a deliberate, not copied-blind,
-- choice here.
create table public.scim_group_role_mappings (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.api_clients(id) on delete cascade,
  group_display_name text not null,
  target_role  text not null check (target_role in ('learner','trainer','pedago','registrar','admin')),
  created_at   timestamptz not null default now(),
  unique (client_id, group_display_name, target_role)
);
alter table public.scim_group_role_mappings enable row level security;
create policy scim_group_role_mappings_admin on public.scim_group_role_mappings
  for all using (exists (
    select 1 from public.api_clients c where c.id = client_id and public.has_org_role(c.org_id, array['admin'])
  )) with check (exists (
    select 1 from public.api_clients c where c.id = client_id and public.has_org_role(c.org_id, array['admin'])
  ));

-- ── apply_scim_group_roles() : additive grant on group-membership add ──────
-- Additive only — a role granted because a user was added to a mapped group
-- is never automatically revoked when they're removed from it, same posture
-- this whole session has used for SSO (_resolve_sso_roles) and NRPS
-- (mapLtiRolesToBriviaRoles): role revocation is a separate, bigger design
-- decision (what happens to a role also granted by a different route, or by
-- a manual admin action) not inferred here. service_role only — called from
-- scim-groups' PATCH-members handling, after _verify_api_token has already
-- authorized the caller as this client's holder.
create or replace function public.apply_scim_group_roles(p_group_id uuid, p_user_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_org_id uuid;
  v_role text;
  v_applied text[] := '{}';
begin
  select g.client_id, c.org_id into v_client_id, v_org_id
  from public.scim_groups g join public.api_clients c on c.id = g.client_id
  where g.id = p_group_id;
  if v_client_id is null then
    raise exception 'Unknown scim_groups row';
  end if;

  for v_role in
    select m.target_role from public.scim_group_role_mappings m
    join public.scim_groups g on g.display_name = m.group_display_name and g.client_id = m.client_id
    where g.id = p_group_id
  loop
    insert into public.user_org_roles (user_id, org_id, role)
    values (p_user_id, v_org_id, v_role)
    on conflict (user_id, org_id, role) do nothing;
    v_applied := array_append(v_applied, v_role);
  end loop;

  return v_applied;
end;
$$;
revoke all on function public.apply_scim_group_roles(uuid, uuid) from public;
grant execute on function public.apply_scim_group_roles(uuid, uuid) to service_role;

-- ── deactivate_scim_user() : SCM-003, deactivate ≠ delete ───────────────────
-- Removes active org access (user_org_roles rows for this client's org)
-- and marks scim_users.active=false. Never touches auth.users, grade_results,
-- certificates, or any audit table — this function's body has no reference
-- to any of them, by construction, not by a runtime check (verified by
-- reading this function: the only tables it writes are user_org_roles and
-- scim_users).
create or replace function public.deactivate_scim_user(p_scim_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_user_id uuid;
  v_org_id uuid;
begin
  select su.client_id, su.user_id, c.org_id into v_client_id, v_user_id, v_org_id
  from public.scim_users su join public.api_clients c on c.id = su.client_id
  where su.id = p_scim_user_id;
  if v_client_id is null then
    raise exception 'Unknown scim_users row';
  end if;

  update public.scim_users set active = false where id = p_scim_user_id;
  delete from public.user_org_roles where user_id = v_user_id and org_id = v_org_id;
end;
$$;
revoke all on function public.deactivate_scim_user(uuid) from public;
grant execute on function public.deactivate_scim_user(uuid) to service_role;
