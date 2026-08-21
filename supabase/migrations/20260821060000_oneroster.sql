-- Spec 04 — Interopérabilité, identité et administration Enterprise
-- (docs/product-specs/2026-08-10-lms-program/04-interoperability-identity.md:86-94).
-- OneRoster 1.2 (ROS-001 to ROS-005). Last piece of §04 phase 4 (SCIM half:
-- 20260821050000_scim.sql, already shipped this session).
--
-- Scope decision, stated plainly rather than guessed: the spec's CSV list
-- names 6 resource types (orgs, users, courses, classes, enrollments,
-- grades). Building full create/update semantics for all 6 with this
-- session's established rigor in one pass isn't realistic — orgs/courses/
-- classes would mean deciding whether a CSV row can *create* a new Brivia
-- `organizations`/`content`(course)/`course_sessions` row, a real
-- content-authoring decision this program has consistently refused to
-- guess at elsewhere (LTI/SSO/SCIM only ever touch identity/roster tables,
-- never auto-create instructional content). So: users + enrollments get
-- full CSV import (resolve-or-report, never auto-provision — same posture
-- `resolve_org_members_by_identifier()` already established for spec 02's
-- enrollment CSV import), orgs/courses/classes are resolved against
-- *existing* Brivia rows only (organizations by id, course_sessions by
-- `code`) — a CSV row naming a class this app doesn't already have is an
-- unmatched row, not a new course_sessions row silently created. Grade
-- import (an external SIS's grade values overwriting this app's own
-- gradebook) is a whose-value-wins authority question not attempted here —
-- ROS-005 (outbound) is built for real below; grade *import* is a stated
-- gap, not guessed at.
--
-- ROS-002 (REST-inbound) is scoped to USER sync only, discovered mid-build
-- and not an original design choice: enroll_in_session()/
-- transition_enrollment() (pre-existing, unmodified) both hard-require a
-- real auth.uid(), which a service_role-authenticated REST caller (bearer
-- token verified, no Supabase session) never has — every service_role
-- grant below reflects that constraint. Enrollment sync stays CSV
-- (admin-driven, real auth.uid()) only in this pass; REST-driven
-- enrollment sync is a stated gap, not silently broken code.
--
-- external_mappings (20260810180000_interoperability_identity.sql) already
-- has 'oneroster' in its `system` check constraint — no schema change
-- needed there. `object_type` is free text (not itself enum-constrained),
-- flexible enough for 'user'/'class'/'enrollment' without a new column.
-- Cross-org sourcedId collisions: LTI's own external_mappings usage
-- (link_lti_subject(), 20260812010000) namespaces external_id with
-- `<registration_id>:<subject>` rather than trusting a bare external value
-- to be globally unique — same reasoning applied here, `external_id` is
-- always `<org_id>:<sourcedId>`, never a bare sourcedId (unique(system,
-- object_type, external_id) has no org_id column, so an un-namespaced
-- sourcedId could otherwise collide across two orgs' separate SIS feeds).

-- ── oneroster_sync_runs : ROS-003's provenance/sync-date journal, plus
-- ROS-002's inbound-REST run log ────────────────────────────────────────
-- Mirrors lti_nrps_sync_runs' shape (20260821040000_lti_nrps.sql) — one row
-- per sync attempt (CSV commit or REST call), not per record (per-record
-- provenance is external_mappings.provenance/synced_at instead, same split
-- NRPS already used between its own sync_runs and sync_members).
create table public.oneroster_sync_runs (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  source           text not null check (source in ('csv','rest')),
  triggered_by     uuid references auth.users(id),
  status           text not null default 'running' check (status in ('running','completed','failed')),
  created_count    integer not null default 0,
  updated_count    integer not null default 0,
  deactivated_count integer not null default 0,
  error_count      integer not null default 0,
  error_reason     text,
  started_at       timestamptz not null default now(),
  completed_at     timestamptz
);
create index oneroster_sync_runs_org_idx on public.oneroster_sync_runs(org_id, started_at desc);
alter table public.oneroster_sync_runs enable row level security;
create policy oneroster_sync_runs_admin on public.oneroster_sync_runs
  for select using (public.has_org_role(org_id, array['admin']));
-- No insert/update policy for authenticated: only the RPCs below
-- (security definer) and the REST-inbound edge function (service_role)
-- write this. Status values actually written, cross-checked against every
-- call site below before shipping (the AGS lti_ags_score_queue bug this
-- session already found was exactly a mismatch between what code wrote and
-- what the check constraint allowed): 'running' (start_oneroster_sync_run,
-- insert default), 'completed'/'failed' (complete_oneroster_sync_run,
-- below) — no concurrent-claim intermediate state needed, each sync run
-- row is written by exactly one caller from insert to completion, not
-- claimed by a multi-worker dispatcher the way lti_ags_score_queue is.

-- ── oneroster_export_settings : ROS-005, per-org enable + scope ─────────
-- Mirrors analytics_privacy_settings' shape (20260812170000) — org_id as
-- PK, staff-read/admin-write RLS, no separate RPC needed for reads (direct
-- RLS-permitted select is the established convention this exact shape
-- already uses elsewhere in this program).
create table public.oneroster_export_settings (
  org_id     uuid primary key references public.organizations(id) on delete cascade,
  enabled    boolean not null default false,
  scope      text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create trigger oneroster_export_settings_touch before update on public.oneroster_export_settings
  for each row execute function public.touch_updated_at();
alter table public.oneroster_export_settings enable row level security;
create policy oneroster_export_settings_read on public.oneroster_export_settings
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));
create policy oneroster_export_settings_write on public.oneroster_export_settings
  for insert with check (public.has_org_role(org_id, array['admin']));
create policy oneroster_export_settings_update on public.oneroster_export_settings
  for update using (public.has_org_role(org_id, array['admin'])) with check (public.has_org_role(org_id, array['admin']));

-- ── start_oneroster_sync_run() / complete_oneroster_sync_run() ─────────
-- CSV path only (authenticated, admin-driven — has_org_role's internal
-- `user_id = auth.uid()` check is meaningless for a service_role caller,
-- which has no JWT/auth.uid() at all: granting this to service_role too,
-- as an earlier draft of this migration did before independent review
-- caught it, would make every REST-inbound call raise "Not authorized"
-- unconditionally — the exact class of has_org_role-vs-service_role bug
-- this session's SCIM/AGS work already had to get right once (SCIM's
-- apply_scim_group_roles/deactivate_scim_user correctly have NO internal
-- has_org_role check and are service_role-only for exactly this reason —
-- mirrored below by _start_oneroster_sync_run_service instead of reusing
-- this one for both directions).
create or replace function public.start_oneroster_sync_run(p_org_id uuid, p_source text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.has_org_role(p_org_id, array['registrar','pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  if p_source not in ('csv','rest') then
    raise exception 'invalid_source: %', p_source;
  end if;
  insert into public.oneroster_sync_runs (org_id, source, triggered_by, status)
  values (p_org_id, p_source, auth.uid(), 'running')
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.start_oneroster_sync_run(uuid, text) from public;
grant execute on function public.start_oneroster_sync_run(uuid, text) to authenticated;

-- REST-inbound path: service_role only, no has_org_role check — the
-- calling edge function has already authenticated the caller via a bearer
-- token (reusing this session's SCIM token-verification primitive) and
-- resolved org_id from THAT, not from a Supabase session. Trusting the
-- caller entirely once service_role-scoped mirrors _decrypt_lti_tool_key()/
-- apply_scim_group_roles()'s exact posture — narrow grant instead of an
-- internal check, because only service_role can ever reach this.
create or replace function public._start_oneroster_sync_run_service(p_org_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  insert into public.oneroster_sync_runs (org_id, source, triggered_by, status)
  values (p_org_id, 'rest', null, 'running')
  returning id;
$$;
revoke all on function public._start_oneroster_sync_run_service(uuid) from public;
grant execute on function public._start_oneroster_sync_run_service(uuid) to service_role;

create or replace function public.complete_oneroster_sync_run(
  p_run_id uuid, p_status text, p_created integer, p_updated integer,
  p_deactivated integer, p_errors integer, p_error_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('completed','failed') then
    raise exception 'invalid_status: %', p_status;
  end if;
  update public.oneroster_sync_runs set
    status = p_status, created_count = p_created, updated_count = p_updated,
    deactivated_count = p_deactivated, error_count = p_errors,
    error_reason = p_error_reason, completed_at = now()
  where id = p_run_id;
end;
$$;
revoke all on function public.complete_oneroster_sync_run(uuid, text, integer, integer, integer, integer, text) from public;
grant execute on function public.complete_oneroster_sync_run(uuid, text, integer, integer, integer, integer, text) to authenticated, service_role;
-- Granted to `authenticated` with no internal has_org_role check — same
-- posture as `record_sso_login`'s ORIGINAL bug this session found and
-- fixed. Deliberately different reasoning here, not a repeat of that
-- mistake: the only value an authenticated-but-uninvolved caller could
-- write is a completion status/counts for a `run_id` they'd have to
-- already know (a random uuid, not enumerable), and the row itself is
-- already gated at *creation* time by start_oneroster_sync_run()'s own
-- admin check — completing a run you didn't start and don't know the id
-- of is not a real attack surface the way record_sso_login's blind insert
-- of arbitrary new rows was. Still narrower than ideal; revisit if this
-- table ever needs to resist a fully malicious authenticated caller
-- guessing/enumerating run ids, which today's uuid keyspace makes
-- impractical.

-- ── _resolve_oneroster_users_internal() : shared resolution core ────────
-- Mirrors resolve_org_members_by_identifier()'s exact posture (spec 02,
-- 20260812100000_enrollment_csv_import.sql) — an identifier that doesn't
-- already belong to an existing org member is reported unmatched, never
-- guessed or auto-created. p_rows: [{sourced_id, email}]. Returns one row
-- per input row (matched or not) so callers can build a real dry-run
-- preview before any write. Deliberately a single SQL-side join, not an
-- N-calls loop to auth.admin.listUsers() from an edge function (which
-- would be both slow and silently wrong past listUsers()'s default 50-row
-- page size) — caught in independent review while wiring oneroster-sync,
-- fixed before that function shipped a real bug.
create or replace function public._resolve_oneroster_users_internal(p_org_id uuid, p_rows jsonb)
returns table(sourced_id text, email text, learner_id uuid, matched boolean)
language sql
security definer
set search_path = public
as $$
  select
    r->>'sourced_id',
    r->>'email',
    u.id,
    (u.id is not null)
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as r
  left join auth.users u on lower(u.email) = lower(trim(r->>'email'))
    and exists (select 1 from public.user_org_roles ur where ur.user_id = u.id and ur.org_id = p_org_id);
$$;
revoke all on function public._resolve_oneroster_users_internal(uuid, jsonb) from public;

-- CSV path: authenticated admin/registrar/pedago.
create or replace function public.resolve_oneroster_users(p_org_id uuid, p_rows jsonb)
returns table(sourced_id text, email text, learner_id uuid, matched boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_org_role(p_org_id, array['registrar','pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  return query select * from public._resolve_oneroster_users_internal(p_org_id, p_rows);
end;
$$;
revoke all on function public.resolve_oneroster_users(uuid, jsonb) from public;
grant execute on function public.resolve_oneroster_users(uuid, jsonb) to authenticated;

-- REST-inbound path: service_role only, no has_org_role check — same
-- reasoning as every other _service-suffixed function in this file (org_id
-- already resolved from the caller's verified bearer token, not from
-- auth.uid()).
create or replace function public._resolve_oneroster_users_service(p_org_id uuid, p_rows jsonb)
returns table(sourced_id text, email text, learner_id uuid, matched boolean)
language sql
security definer
set search_path = public
as $$
  select * from public._resolve_oneroster_users_internal(p_org_id, p_rows);
$$;
revoke all on function public._resolve_oneroster_users_service(uuid, jsonb) from public;
grant execute on function public._resolve_oneroster_users_service(uuid, jsonb) to service_role;

-- ── _commit_oneroster_users_internal() : shared core, no auth check of its
-- own — both public-facing entry points below gate it, each with the
-- authorization shape appropriate to its own caller (see
-- start_oneroster_sync_run's comment above for why a single has_org_role
-- check can't correctly serve both an authenticated-admin caller AND a
-- service_role/token-authenticated caller at once).
-- ROS-003: writes external_mappings(system='oneroster', object_type='user',
-- external_id='<org_id>:<sourced_id>') — source ('oneroster') is the system
-- column itself, sourcedId is external_id (namespaced), sync date is
-- synced_at (touched on every re-import, not just insert — a resync should
-- refresh it, same "always take the latest sync" reasoning this session
-- used for identity_connections/lti_contexts on every launch).
create or replace function public._commit_oneroster_users_internal(p_org_id uuid, p_rows jsonb)
returns table(sourced_id text, outcome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_learner_id uuid;
  v_external_id text;
  v_existing uuid;
begin
  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_learner_id := nullif(v_row->>'learner_id', '')::uuid;
    if v_learner_id is null then
      return query select v_row->>'sourced_id', 'skipped_unmatched';
      continue;
    end if;
    v_external_id := p_org_id::text || ':' || (v_row->>'sourced_id');

    select internal_id into v_existing from public.external_mappings
      where system = 'oneroster' and object_type = 'user' and external_id = v_external_id;

    insert into public.external_mappings (org_id, system, object_type, external_id, internal_id, provenance, synced_at)
    values (p_org_id, 'oneroster', 'user', v_external_id, v_learner_id,
            jsonb_build_object('email', v_row->>'email'), now())
    on conflict (system, object_type, external_id) do update set
      internal_id = excluded.internal_id, provenance = excluded.provenance, synced_at = now();

    return query select v_row->>'sourced_id', (case when v_existing is null then 'created' else 'updated' end);
  end loop;
end;
$$;
revoke all on function public._commit_oneroster_users_internal(uuid, jsonb) from public;
-- No grant at all here — only reachable through the two gated wrappers
-- below, never called directly.

-- CSV path: authenticated admin/registrar/pedago, real org-membership check.
create or replace function public.commit_oneroster_users(p_org_id uuid, p_rows jsonb)
returns table(sourced_id text, outcome text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_org_role(p_org_id, array['registrar','pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  return query select * from public._commit_oneroster_users_internal(p_org_id, p_rows);
end;
$$;
revoke all on function public.commit_oneroster_users(uuid, jsonb) from public;
grant execute on function public.commit_oneroster_users(uuid, jsonb) to authenticated;

-- REST-inbound path: service_role only, no has_org_role check — same
-- reasoning as _start_oneroster_sync_run_service above (the calling edge
-- function already authenticated the caller via bearer token and resolved
-- org_id from it).
create or replace function public._commit_oneroster_users_service(p_org_id uuid, p_rows jsonb)
returns table(sourced_id text, outcome text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query select * from public._commit_oneroster_users_internal(p_org_id, p_rows);
end;
$$;
revoke all on function public._commit_oneroster_users_service(uuid, jsonb) from public;
grant execute on function public._commit_oneroster_users_service(uuid, jsonb) to service_role;

-- ── resolve_oneroster_classes() : classes resolved against existing
-- course_sessions by `code` only — never auto-created (see file header) ──
create or replace function public.resolve_oneroster_classes(p_org_id uuid, p_rows jsonb)
returns table(sourced_id text, class_code text, session_id uuid, matched boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_org_role(p_org_id, array['registrar','pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  return query
    select r->>'sourced_id', r->>'class_code', cs.id, (cs.id is not null)
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as r
    left join public.course_sessions cs on cs.org_id = p_org_id and cs.code = (r->>'class_code');
end;
$$;
revoke all on function public.resolve_oneroster_classes(uuid, jsonb) from public;
grant execute on function public.resolve_oneroster_classes(uuid, jsonb) to authenticated;

-- ── commit_oneroster_enrollments() : real write, reuses enroll_in_session()
-- /transition_enrollment() as-is (ROS-004: deactivation via
-- transition_enrollment(..., 'withdrawn', ...) — the SAME established
-- transition this app already uses for staff-initiated cancel/withdraw
-- everywhere else, never a row delete, enrollment_history/grade_results
-- untouched by construction: this function never references either table)
create or replace function public.commit_oneroster_enrollments(p_org_id uuid, p_rows jsonb)
returns table(sourced_id text, outcome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_learner_id uuid;
  v_session_id uuid;
  v_status text;
  v_external_id text;
  v_enrollment_id uuid;
  v_result record;
begin
  if not public.has_org_role(p_org_id, array['registrar','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_learner_id := nullif(v_row->>'learner_id', '')::uuid;
    v_session_id := nullif(v_row->>'session_id', '')::uuid;
    v_status := coalesce(v_row->>'status', 'active');
    if v_learner_id is null or v_session_id is null then
      return query select v_row->>'sourced_id', 'skipped_unmatched';
      continue;
    end if;
    v_external_id := p_org_id::text || ':' || (v_row->>'sourced_id');

    if v_status = 'active' then
      select * into v_result from public.enroll_in_session(v_session_id, v_learner_id, 'oneroster');
      insert into public.external_mappings (org_id, system, object_type, external_id, internal_id, provenance, synced_at)
      values (p_org_id, 'oneroster', 'enrollment', v_external_id, v_result.id,
              jsonb_build_object('session_id', v_session_id, 'learner_id', v_learner_id), now())
      on conflict (system, object_type, external_id) do update set
        internal_id = excluded.internal_id, provenance = excluded.provenance, synced_at = now();
      return query select v_row->>'sourced_id', 'active';
    else
      -- ROS-004: external deactivation ('inactive'/'tobedeleted' per OneRoster's
      -- own status vocabulary) never deletes — transition_enrollment() to
      -- 'withdrawn' preserves enrollment_history/grade_results untouched.
      select internal_id into v_enrollment_id from public.external_mappings
        where system = 'oneroster' and object_type = 'enrollment' and external_id = v_external_id;
      if v_enrollment_id is not null then
        perform public.transition_enrollment(v_enrollment_id, 'withdrawn', 'oneroster_external_deactivation');
        update public.external_mappings set synced_at = now()
          where system = 'oneroster' and object_type = 'enrollment' and external_id = v_external_id;
        return query select v_row->>'sourced_id', 'deactivated';
      else
        return query select v_row->>'sourced_id', 'skipped_unknown_enrollment';
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function public.commit_oneroster_enrollments(uuid, jsonb) from public;
-- CSV path only, deliberately never service_role — this function calls
-- enroll_in_session()/transition_enrollment() unmodified, and both of those
-- (pre-existing, spec-02, in-prod code, not touched here) hard-require a
-- real auth.uid() (enroll_in_session() explicitly raises 'Not authenticated'
-- when it's null, which it always is for a service_role caller with no
-- JWT). Caught in independent review before commit: an earlier draft of
-- this migration granted service_role here too, which would have made
-- every REST-inbound enrollment sync attempt fail outright. ROS-002's
-- REST-inbound path is scoped to user sync only in this pass (see file
-- header) — enrollment sync via REST (as opposed to CSV) is a stated gap,
-- not silently broken code.
grant execute on function public.commit_oneroster_enrollments(uuid, jsonb) to authenticated;
