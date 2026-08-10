-- Spec 04 — Interopérabilité, identité et administration Enterprise
-- (docs/product-specs/2026-08-10-lms-program/04-interoperability-identity.md).
--
-- Foundation scope only, per README §Ordre de livraison obligatoire this
-- lays the connection/registration/secret-vault schema and diagnostics log
-- for SSO, LTI, OneRoster, SCIM, API clients and webhooks. It does not
-- implement the live OIDC/SAML handshake, LTI JWT validation, or
-- SCIM/OneRoster sync jobs — those are edge-function work against this
-- schema, out of scope for a database migration. Every table here is
-- admin-only (INT/API sections: enterprise identity and secrets are the
-- most security-sensitive surface in the program).

create table public.identity_connections (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  protocol     text not null check (protocol in ('oidc','saml')),
  display_name text not null,
  status       text not null default 'draft' check (status in ('draft','testing','active','disabled')),
  mode         text not null default 'optional' check (mode in ('optional','required_for_domains','admin_bypass')),
  metadata     jsonb not null default '{}'::jsonb,
  created_by   uuid not null references auth.users(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index identity_connections_org_idx on public.identity_connections(org_id);
create trigger identity_connections_touch before update on public.identity_connections
  for each row execute function public.touch_updated_at();

create table public.identity_domains (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.identity_connections(id) on delete cascade,
  domain        text not null,
  verified_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (org_id, domain)
);

-- INT-003: identity binding uses the IdP's stable subject, never email alone.
create table public.external_identities (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  connection_id   uuid not null references public.identity_connections(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  external_subject text not null,
  raw_attributes  jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (connection_id, external_subject)
);
create index external_identities_user_idx on public.external_identities(user_id);

create table public.integration_connections (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  type       text not null check (type in ('oneroster','scim')),
  status     text not null default 'draft' check (status in ('draft','active','disabled')),
  config     jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index integration_connections_org_idx on public.integration_connections(org_id);

-- Secrets never store plaintext — only a SHA-256 hex digest, never selected
-- back to a client (see RLS: no select policy for `authenticated` at all).
create table public.integration_secrets (
  id            uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  name          text not null,
  secret_hash   text not null,
  version       integer not null default 1,
  is_active     boolean not null default true,
  created_by    uuid not null references auth.users(id) default auth.uid(),
  created_at    timestamptz not null default now(),
  deactivated_at timestamptz
);
create index integration_secrets_connection_idx on public.integration_secrets(connection_id) where is_active;

create table public.external_mappings (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  system      text not null check (system in ('lti','oneroster','scim','sso')),
  object_type text not null,
  external_id text not null,
  internal_id uuid not null,
  provenance  jsonb not null default '{}'::jsonb,
  synced_at   timestamptz not null default now(),
  unique (system, object_type, external_id)
);
create index external_mappings_internal_idx on public.external_mappings(internal_id);

create table public.lti_registrations (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  issuer         text not null,
  client_id      text not null,
  jwks_url       text not null,
  auth_login_url text not null,
  auth_token_url text not null,
  status         text not null default 'draft' check (status in ('draft','active','disabled')),
  created_by     uuid not null references auth.users(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  unique (org_id, issuer, client_id)
);

create table public.lti_deployments (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.lti_registrations(id) on delete cascade,
  deployment_id   text not null,
  context_label   text,
  created_at      timestamptz not null default now(),
  unique (registration_id, deployment_id)
);

-- Append-only diagnostic log (LTI-006 "dernier lancement / erreurs").
create table public.lti_launches (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.lti_registrations(id) on delete cascade,
  deployment_id   text,
  subject         text,
  nonce           text,
  user_id         uuid references auth.users(id),
  status          text not null check (status in ('success','rejected')),
  error_reason    text,
  launched_at     timestamptz not null default now()
);
create index lti_launches_registration_idx on public.lti_launches(registration_id, launched_at desc);

create table public.api_clients (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null,
  client_id  text not null unique,
  scopes     text[] not null default '{}',
  status     text not null default 'active' check (status in ('active','revoked')),
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index api_clients_org_idx on public.api_clients(org_id);

create table public.api_tokens (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.api_clients(id) on delete cascade,
  token_hash  text not null,
  expires_at  timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index api_tokens_client_idx on public.api_tokens(client_id);

create table public.webhook_endpoints (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  url         text not null,
  secret_hash text not null,
  events      text[] not null default '{}',
  status      text not null default 'active' check (status in ('active','disabled')),
  created_by  uuid not null references auth.users(id) default auth.uid(),
  created_at  timestamptz not null default now()
);
create index webhook_endpoints_org_idx on public.webhook_endpoints(org_id);

create table public.webhook_deliveries (
  id             uuid primary key default gen_random_uuid(),
  endpoint_id    uuid not null references public.webhook_endpoints(id) on delete cascade,
  event_name     text not null,
  payload        jsonb not null,
  status         text not null default 'pending' check (status in ('pending','delivered','failed')),
  attempt_count  integer not null default 0,
  last_attempt_at timestamptz,
  created_at     timestamptz not null default now()
);
create index webhook_deliveries_endpoint_idx on public.webhook_deliveries(endpoint_id, created_at desc);

-- ── RLS : admin-only everywhere, no exceptions ─────────────────────────────
alter table public.identity_connections enable row level security;
alter table public.identity_domains enable row level security;
alter table public.external_identities enable row level security;
alter table public.integration_connections enable row level security;
alter table public.integration_secrets enable row level security;
alter table public.external_mappings enable row level security;
alter table public.lti_registrations enable row level security;
alter table public.lti_deployments enable row level security;
alter table public.lti_launches enable row level security;
alter table public.api_clients enable row level security;
alter table public.api_tokens enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;

create policy identity_connections_admin on public.identity_connections
  for all using (public.has_org_role(org_id, array['admin'])) with check (public.has_org_role(org_id, array['admin']));
create policy identity_domains_admin on public.identity_domains
  for all using (public.has_org_role(org_id, array['admin'])) with check (public.has_org_role(org_id, array['admin']));
create policy external_identities_admin on public.external_identities
  for select using (public.has_org_role(org_id, array['admin']));
create policy integration_connections_admin on public.integration_connections
  for all using (public.has_org_role(org_id, array['admin'])) with check (public.has_org_role(org_id, array['admin']));
-- integration_secrets: intentionally no select policy for `authenticated` —
-- only create_integration_secret()/deactivate_integration_secret() (security
-- definer) touch this table; secrets are never read back through PostgREST.
create policy external_mappings_admin on public.external_mappings
  for select using (public.has_org_role(org_id, array['admin']));
create policy lti_registrations_admin on public.lti_registrations
  for all using (public.has_org_role(org_id, array['admin'])) with check (public.has_org_role(org_id, array['admin']));
create policy lti_deployments_admin on public.lti_deployments
  for all using (exists (select 1 from public.lti_registrations r where r.id = registration_id and public.has_org_role(r.org_id, array['admin'])))
  with check (exists (select 1 from public.lti_registrations r where r.id = registration_id and public.has_org_role(r.org_id, array['admin'])));
create policy lti_launches_admin on public.lti_launches
  for select using (exists (select 1 from public.lti_registrations r where r.id = registration_id and public.has_org_role(r.org_id, array['admin'])));
create policy api_clients_admin on public.api_clients
  for all using (public.has_org_role(org_id, array['admin'])) with check (public.has_org_role(org_id, array['admin']));
create policy api_tokens_admin on public.api_tokens
  for select using (exists (select 1 from public.api_clients c where c.id = api_tokens.client_id and public.has_org_role(c.org_id, array['admin'])));
create policy webhook_endpoints_admin on public.webhook_endpoints
  for all using (public.has_org_role(org_id, array['admin'])) with check (public.has_org_role(org_id, array['admin']));
create policy webhook_deliveries_admin on public.webhook_deliveries
  for select using (exists (select 1 from public.webhook_endpoints e where e.id = endpoint_id and public.has_org_role(e.org_id, array['admin'])));

-- ── secret vault helpers : hash on write, never return plaintext ──────────
create or replace function public.create_integration_secret(p_connection_id uuid, p_name text, p_plaintext text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_org_id uuid;
  v_id uuid;
  v_next_version integer;
begin
  select org_id into v_org_id from public.integration_connections where id = p_connection_id;
  if v_org_id is null or not public.has_org_role(v_org_id, array['admin']) then
    raise exception 'Not authorized';
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version from public.integration_secrets where connection_id = p_connection_id;

  insert into public.integration_secrets (connection_id, name, secret_hash, version, created_by)
  values (p_connection_id, p_name, encode(digest(p_plaintext, 'sha256'), 'hex'), v_next_version, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_integration_secret(uuid, text, text) from public;
grant execute on function public.create_integration_secret(uuid, text, text) to authenticated;

-- INT-005: rotation with overlap — the old secret is deactivated only after
-- the new one is confirmed live, so both validate during the handover window.
create or replace function public.deactivate_integration_secret(p_secret_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select ic.org_id into v_org_id
  from public.integration_secrets s join public.integration_connections ic on ic.id = s.connection_id
  where s.id = p_secret_id;
  if v_org_id is null or not public.has_org_role(v_org_id, array['admin']) then
    raise exception 'Not authorized';
  end if;
  update public.integration_secrets set is_active = false, deactivated_at = now() where id = p_secret_id;
end;
$$;

revoke all on function public.deactivate_integration_secret(uuid) from public;
grant execute on function public.deactivate_integration_secret(uuid) to authenticated;

-- ── secret metadata without the hash, for the admin UI's list view ────────
create or replace function public.list_integration_secrets(p_connection_id uuid)
returns table(id uuid, name text, version integer, is_active boolean, created_at timestamptz, deactivated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.name, s.version, s.is_active, s.created_at, s.deactivated_at
  from public.integration_secrets s
  join public.integration_connections ic on ic.id = s.connection_id
  where s.connection_id = p_connection_id and public.has_org_role(ic.org_id, array['admin'])
  order by s.version desc;
$$;

revoke all on function public.list_integration_secrets(uuid) from public;
grant execute on function public.list_integration_secrets(uuid) to authenticated;

-- ── record_lti_launch() : append-only diagnostic write (LTI-006) ──────────
create or replace function public.record_lti_launch(
  p_registration_id uuid, p_deployment_id text, p_subject text, p_nonce text,
  p_user_id uuid, p_status text, p_error_reason text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.lti_launches (registration_id, deployment_id, subject, nonce, user_id, status, error_reason)
  values (p_registration_id, p_deployment_id, p_subject, p_nonce, p_user_id, p_status, p_error_reason);
$$;

revoke all on function public.record_lti_launch(uuid, text, text, text, uuid, text, text) from public;
grant execute on function public.record_lti_launch(uuid, text, text, text, uuid, text, text) to authenticated, service_role;
