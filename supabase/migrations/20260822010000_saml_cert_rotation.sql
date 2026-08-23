-- Spec 04 — Interopérabilité, identité et administration Enterprise
-- (docs/product-specs/2026-08-10-lms-program/04-interoperability-identity.md).
-- INT-005 (SAML half — OIDC has no equivalent long-lived signing secret to
-- rotate the same way: identity_client_secrets is already versioned).
--
-- Closes the last open item of spec 04's RESTE-A-FAIRE: "Rotation de
-- certificat SSO avec fenêtre de chevauchement réelle (le modèle de données
-- le permet, le flux non)". Before this migration `identity_connections.
-- metadata.idp_cert` was a single string — replacing it meant a hard cutover
-- (old cert stops verifying the instant an admin overwrites the field), with
-- no window during which both the outgoing and incoming IdP certs are
-- accepted. A real rotation needs exactly that overlap: the IdP-side
-- rotation (uploading a new cert at the IdP) and the SP-side rotation
-- (accepting it here) are never atomic across two independently-operated
-- systems.
--
-- Model: identity_connection_certs, many-per-connection, each independently
-- 'active'/'retired'. Any 'active' cert verifies a response (saml-acs tries
-- each until one's signature matches — see that file). Retiring a cert while
-- it is the *only* active one is refused (retire_saml_idp_cert below) — that
-- would silently lock every user of that connection out, which is exactly
-- the failure mode a rotation window exists to prevent. An admin adds the
-- new cert first (overlap begins, both verify), confirms the IdP has cut
-- over, then retires the old one (overlap ends) — no time-based auto-expiry
-- is imposed, the admin controls the window's length.
create table public.identity_connection_certs (
  id            uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.identity_connections(id) on delete cascade,
  cert          text not null,
  label         text,
  status        text not null default 'active' check (status in ('active', 'retired')),
  activated_at  timestamptz not null default now(),
  retired_at    timestamptz,
  created_by    uuid not null references auth.users(id) default auth.uid(),
  created_at    timestamptz not null default now()
);
create index identity_connection_certs_connection_idx on public.identity_connection_certs(connection_id, status);

alter table public.identity_connection_certs enable row level security;
-- Same join-to-parent-org shape as lti_deployments_admin (20260810180000) —
-- no org_id column on this table itself, scoped through connection_id.
create policy identity_connection_certs_admin on public.identity_connection_certs
  for all using (
    exists (select 1 from public.identity_connections c where c.id = connection_id and public.has_org_role(c.org_id, array['admin']))
  ) with check (
    exists (select 1 from public.identity_connections c where c.id = connection_id and public.has_org_role(c.org_id, array['admin']))
  );

-- Backfill: every existing SAML connection's single metadata.idp_cert
-- becomes its first 'active' row, so saml-acs's switch to reading this table
-- (this session, saml-acs/index.ts) doesn't strand already-configured
-- connections with zero active certs.
insert into public.identity_connection_certs (connection_id, cert, label, status, activated_at, created_by)
select id, metadata->>'idp_cert', 'Certificat initial (migré)', 'active', created_at, created_by
from public.identity_connections
where protocol = 'saml' and coalesce(length(trim(metadata->>'idp_cert')), 0) > 0;

create or replace function public.add_saml_idp_cert(p_connection_id uuid, p_cert text, p_label text default null)
returns public.identity_connection_certs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_protocol text;
  v_row public.identity_connection_certs;
begin
  select org_id, protocol into v_org_id, v_protocol from public.identity_connections where id = p_connection_id;
  if v_org_id is null then
    raise exception 'Unknown connection';
  end if;
  if not public.has_org_role(v_org_id, array['admin']) then
    raise exception 'Not authorized';
  end if;
  if v_protocol != 'saml' then
    raise exception 'Certificate rotation only applies to SAML connections';
  end if;
  if coalesce(length(trim(p_cert)), 0) = 0 then
    raise exception 'Certificate cannot be empty';
  end if;

  insert into public.identity_connection_certs (connection_id, cert, label)
  values (p_connection_id, trim(p_cert), nullif(trim(coalesce(p_label, '')), ''))
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.add_saml_idp_cert(uuid, text, text) from public;
grant execute on function public.add_saml_idp_cert(uuid, text, text) to authenticated;

create or replace function public.retire_saml_idp_cert(p_connection_id uuid, p_cert_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_active_count integer;
  v_cert_status text;
begin
  select org_id into v_org_id from public.identity_connections where id = p_connection_id;
  if v_org_id is null then
    raise exception 'Unknown connection';
  end if;
  if not public.has_org_role(v_org_id, array['admin']) then
    raise exception 'Not authorized';
  end if;

  select status into v_cert_status from public.identity_connection_certs where id = p_cert_id and connection_id = p_connection_id;
  if v_cert_status is null then
    raise exception 'Unknown certificate for this connection';
  end if;
  if v_cert_status = 'retired' then
    return; -- already retired, no-op (idempotent)
  end if;

  select count(*) into v_active_count from public.identity_connection_certs where connection_id = p_connection_id and status = 'active';
  if v_active_count <= 1 then
    raise exception 'Cannot retire the only active certificate — add the replacement certificate first so there is an overlap window';
  end if;

  update public.identity_connection_certs set status = 'retired', retired_at = now() where id = p_cert_id;
end;
$$;
revoke all on function public.retire_saml_idp_cert(uuid, uuid) from public;
grant execute on function public.retire_saml_idp_cert(uuid, uuid) to authenticated;
