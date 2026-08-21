-- Spec 04 — Interopérabilité, identité et administration Enterprise
-- (docs/product-specs/2026-08-10-lms-program/04-interoperability-identity.md:67-68).
-- LTI-003 — Names and Role Provisioning Service: "synchronisation limitée au
-- contexte autorisé, avec journal de provenance."
--
-- Context vs resource-link storage decision: NRPS is scoped to the *context*
-- (the external course/class), not a specific placed resource link — the
-- same context_memberships_url is valid for every resource link placed in
-- that context. Folding it into lti_resource_links (20260821030000_lti_ags.sql)
-- would mean re-storing (and re-fetching, on every launch of every link) the
-- identical URL once per resource link, and would give a context with N
-- placed links N separate "roster access points" that are really the same
-- one. lti_contexts is its own table, keyed on (registration_id,
-- context_external_id) — this is the thing this session's earlier LTI
-- investigation found NOT to exist yet ("aucune table lti_contexts n'existe")
-- and NRPS is what finally needs it for real.
--
-- Sync is admin-triggered, not automatic/background: "synchronisation
-- limitée au contexte autorisé" reads as a scoped, deliberate action, not
-- silent polling of every context this tool has ever seen a launch from.

create table public.lti_contexts (
  id                      uuid primary key default gen_random_uuid(),
  registration_id         uuid not null references public.lti_registrations(id) on delete cascade,
  context_external_id     text not null,
  title                   text,
  context_memberships_url text,
  service_versions        jsonb not null default '[]'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (registration_id, context_external_id)
);
create index lti_contexts_registration_idx on public.lti_contexts(registration_id);
alter table public.lti_contexts enable row level security;
create policy lti_contexts_admin on public.lti_contexts
  for select using (exists (
    select 1 from public.lti_registrations r where r.id = registration_id and public.has_org_role(r.org_id, array['admin'])
  ));
-- No insert/update policy for authenticated: written only by
-- upsert_lti_context() (service_role, called from lti-launch), same posture
-- as lti_resource_links.
create trigger lti_contexts_touch before update on public.lti_contexts
  for each row execute function public.touch_updated_at();

-- ── upsert_lti_context() : anchor + NRPS claim snapshot, per launch ────────
-- Idempotent (unique registration_id+context_external_id, plain upsert) —
-- called on every launch (any message type) that carries both a context
-- claim and a namesroleservice claim, mirroring upsert_lti_resource_link()'s
-- "record what the platform advertised, cheaply, on every launch" posture.
create or replace function public.upsert_lti_context(
  p_registration_id uuid,
  p_context_external_id text,
  p_title text,
  p_context_memberships_url text,
  p_service_versions jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.lti_contexts (
    registration_id, context_external_id, title, context_memberships_url, service_versions
  ) values (
    p_registration_id, p_context_external_id, p_title, p_context_memberships_url, coalesce(p_service_versions, '[]'::jsonb)
  )
  on conflict (registration_id, context_external_id) do update set
    title = excluded.title,
    -- Same "always take the platform's latest claim" reasoning as
    -- upsert_lti_resource_link()'s line_item_url handling — an admin can
    -- enable NRPS for a context after the fact.
    context_memberships_url = excluded.context_memberships_url,
    service_versions = excluded.service_versions
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.upsert_lti_context(uuid, text, text, text, jsonb) from public;
grant execute on function public.upsert_lti_context(uuid, text, text, text, jsonb) to service_role;

-- ── lti_nrps_sync_runs / lti_nrps_sync_members : provenance journal ────────
-- LTI-003 explicitly requires "journal de provenance" — every sync is who
-- triggered it, when, and per-member what happened (matched or not, which
-- role was applied). status is exactly the 3 values lti-nrps-sync/index.ts
-- writes: 'running' (start_lti_nrps_sync, below), then 'completed' or
-- 'failed' (the edge function's own final update) — no intermediate
-- concurrent-claim state is needed here (unlike lti_ags_score_queue's
-- 'sending'): this is a single synchronous admin-triggered action, not a
-- background multi-worker dispatcher, so there is no concurrent-claim race
-- to defend against. Cross-checked against every write site below before
-- shipping, after the AGS status-constraint bug this session already caught.
create table public.lti_nrps_sync_runs (
  id              uuid primary key default gen_random_uuid(),
  context_id      uuid not null references public.lti_contexts(id) on delete cascade,
  triggered_by    uuid not null references auth.users(id) default auth.uid(),
  status          text not null default 'running' check (status in ('running','completed','failed')),
  matched_count   integer not null default 0,
  unmatched_count integer not null default 0,
  error_reason    text,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz
);
create index lti_nrps_sync_runs_context_idx on public.lti_nrps_sync_runs(context_id, started_at desc);
alter table public.lti_nrps_sync_runs enable row level security;
create policy lti_nrps_sync_runs_admin on public.lti_nrps_sync_runs
  for select using (exists (
    select 1 from public.lti_contexts c join public.lti_registrations r on r.id = c.registration_id
    where c.id = context_id and public.has_org_role(r.org_id, array['admin'])
  ));
-- No insert/update policy for authenticated: only start_lti_nrps_sync()
-- (below) inserts, only the sync edge function (service_role) updates.

create table public.lti_nrps_sync_members (
  id                uuid primary key default gen_random_uuid(),
  sync_run_id       uuid not null references public.lti_nrps_sync_runs(id) on delete cascade,
  external_subject  text not null,
  name              text,
  email             text,
  lti_roles         jsonb not null default '[]'::jsonb,
  matched_user_id   uuid references auth.users(id),
  applied_roles     jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now()
);
create index lti_nrps_sync_members_run_idx on public.lti_nrps_sync_members(sync_run_id);
alter table public.lti_nrps_sync_members enable row level security;
create policy lti_nrps_sync_members_admin on public.lti_nrps_sync_members
  for select using (exists (
    select 1 from public.lti_nrps_sync_runs sr
    join public.lti_contexts c on c.id = sr.context_id
    join public.lti_registrations r on r.id = c.registration_id
    where sr.id = sync_run_id and public.has_org_role(r.org_id, array['admin'])
  ));
-- No insert policy for authenticated: only the sync edge function
-- (service_role, already past the admin check start_lti_nrps_sync performed
-- to obtain a run id in the first place) writes these rows.

-- ── start_lti_nrps_sync() : admin check + run row, one round trip ─────────
-- Grant audit: granted to `authenticated`, but has_org_role is checked
-- internally against the real caller (auth.uid()) before anything is
-- written or returned — same pattern as create_identity_client_secret()/
-- generate_lti_tool_key(), not the record_sso_login-shaped bug (a function
-- with no internal check granted to authenticated) this session already
-- found and fixed once. Returns exactly what the edge function needs to
-- proceed (registration's token endpoint + client_id it'll need for
-- fetchLtiServiceToken, the context's membership URL) in one round trip
-- rather than three separate authorized reads.
create or replace function public.start_lti_nrps_sync(p_context_id uuid)
returns table(
  sync_run_id uuid,
  registration_id uuid,
  client_id text,
  auth_token_url text,
  context_memberships_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_registration record;
  v_org_id uuid;
  v_run_id uuid;
begin
  select c.*, r.org_id into v_context from public.lti_contexts c
    join public.lti_registrations r on r.id = c.registration_id
    where c.id = p_context_id;
  if v_context.id is null then
    raise exception 'Unknown lti_contexts row';
  end if;
  if not public.has_org_role(v_context.org_id, array['admin']) then
    raise exception 'Not authorized';
  end if;
  if v_context.context_memberships_url is null then
    raise exception 'This context has no NRPS membership URL — roster access was not granted by the platform';
  end if;

  select * into v_registration from public.lti_registrations where id = v_context.registration_id;

  insert into public.lti_nrps_sync_runs (context_id, triggered_by, status)
  values (p_context_id, auth.uid(), 'running')
  returning id into v_run_id;

  return query select v_run_id, v_registration.id, v_registration.client_id, v_registration.auth_token_url, v_context.context_memberships_url;
end;
$$;
revoke all on function public.start_lti_nrps_sync(uuid) from public;
grant execute on function public.start_lti_nrps_sync(uuid) to authenticated;
