-- Spec 04 — Interopérabilité, identité et administration Enterprise
-- (docs/product-specs/2026-08-10-lms-program/04-interoperability-identity.md:105-113).
-- API-001 to API-004 — the last piece of spec 04.
--
-- API-002 is already satisfied by this session's SCIM/OneRoster work:
-- api_clients/api_tokens + _shared/api-token-auth.ts (SHA-256 hash-lookup,
-- service_role-only verify) + create_api_token()/revoke_api_token()/
-- list_api_tokens() (real has_org_role admin checks) already give per-org,
-- scoped, revocable service tokens with no long-lived user token involved —
-- extended below with the scope strings the new v1 endpoints check, not
-- rebuilt.
--
-- Real gap found before writing anything else: webhook_endpoints.secret_hash
-- (20260810180000) only ever received a client-computed SHA-256 hash
-- (Integrations.tsx's existing createWebhookEndpoint() call — confirmed by
-- reading it) — a one-way hash can verify a value someone presents back, but
-- can never be used to *compute* an HMAC signature on an outgoing payload
-- this app itself originates. API-003 ("webhooks signés") requires this app
-- to hold the actual secret. Same class of gap this program keeps finding
-- (a table shaped for the wrong direction of the same primitive) — fixed
-- here with vault-encrypted reversible storage, same primitive
-- identity_client_secrets/lti_tool_keys already use, not a new mechanism.
-- secret_hash is left in place (unused going forward) rather than dropped,
-- since dropping a column a previous migration created is not reversible
-- and nothing here needs the column gone, only unused.

-- ── webhook secret : vault-encrypted, reversible (this app signs with it) ──
create extension if not exists supabase_vault;
alter table public.webhook_endpoints add column if not exists vault_secret_id uuid references vault.secrets(id);

create or replace function public.create_webhook_endpoint(
  p_org_id uuid,
  p_url text,
  p_events text[],
  p_secret_plaintext text
) returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_vault_id uuid;
  v_id uuid;
begin
  if not public.has_org_role(p_org_id, array['admin']) then
    raise exception 'Not authorized';
  end if;
  if p_secret_plaintext is null or length(p_secret_plaintext) = 0 then
    raise exception 'Secret required';
  end if;
  if p_url !~ '^https://' then
    raise exception 'Webhook URL must be https';
  end if;

  v_vault_id := vault.create_secret(p_secret_plaintext, 'webhook_endpoint:' || p_org_id::text || ':' || gen_random_uuid()::text);

  insert into public.webhook_endpoints (org_id, url, secret_hash, events, vault_secret_id, created_by)
  values (p_org_id, p_url, '', coalesce(p_events, '{}'), v_vault_id, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.create_webhook_endpoint(uuid, text, text[], text) from public;
grant execute on function public.create_webhook_endpoint(uuid, text, text[], text) to authenticated;

create or replace function public.disable_webhook_endpoint(p_endpoint_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from public.webhook_endpoints where id = p_endpoint_id;
  if v_org_id is null or not public.has_org_role(v_org_id, array['admin']) then
    raise exception 'Not authorized';
  end if;
  update public.webhook_endpoints set status = 'disabled' where id = p_endpoint_id;
end;
$$;
revoke all on function public.disable_webhook_endpoint(uuid) from public;
grant execute on function public.disable_webhook_endpoint(uuid) to authenticated;

-- service_role only — sole caller is dispatch-webhooks, signing each
-- delivery. Never granted to authenticated/anon, mirrors
-- _decrypt_lti_tool_key()/_decrypt_identity_client_secret()'s exact posture
-- (the record_sso_login lesson from earlier this session: no internal check
-- needed because only service_role can ever call it).
create or replace function public._decrypt_webhook_secret(p_endpoint_id uuid)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select ds.decrypted_secret
  from vault.decrypted_secrets ds
  join public.webhook_endpoints e on e.vault_secret_id = ds.id
  where e.id = p_endpoint_id;
$$;
revoke all on function public._decrypt_webhook_secret(uuid) from public;
grant execute on function public._decrypt_webhook_secret(uuid) to service_role;

-- ── webhook_deliveries.status: add 'sending' (the AGS bug, cross-checked) ──
-- dispatch-webhooks claims a row atomically via
-- `update ... where status='pending' set status='sending'` before
-- processing it (two concurrent invocations can't both send the same
-- delivery) — this exact class of bug already broke AGS's score queue once
-- this session (the claim's intermediate value missing from the check
-- constraint silently no-ops every claim forever). Checked explicitly here
-- against every status value dispatch-webhooks/index.ts actually writes
-- ('sending' on claim, 'delivered' or 'failed' on completion, 'pending' on
-- a retry that hasn't exhausted its budget) before shipping this migration.
alter table public.webhook_deliveries drop constraint webhook_deliveries_status_check;
alter table public.webhook_deliveries add constraint webhook_deliveries_status_check
  check (status in ('pending','sending','delivered','failed'));
alter table public.webhook_deliveries add column if not exists next_attempt_at timestamptz not null default now();
alter table public.webhook_deliveries add column if not exists last_error text;
alter table public.webhook_deliveries add column if not exists event_id uuid not null default gen_random_uuid();
create index if not exists webhook_deliveries_pending_idx on public.webhook_deliveries(status, next_attempt_at) where status = 'pending';

-- ── emit_webhook_event() : single shared insertion path for all 7 events ───
-- API-004's 7 event types each get their own thin trigger below, all
-- calling this one function — a fix to delivery-fan-out logic applies to
-- every event type at once instead of silently drifting across 7 copies.
-- Only enqueues for `active` endpoints actually subscribed to this exact
-- event_name (events is a text[] on webhook_endpoints, already there since
-- 20260810180000) — an org with no webhook configured for an event pays
-- zero insert cost, not a wasted row per endpoint per event.
create or replace function public.emit_webhook_event(p_org_id uuid, p_event_name text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_endpoint record;
begin
  for v_endpoint in
    select id from public.webhook_endpoints
    where org_id = p_org_id and status = 'active' and p_event_name = any(events)
  loop
    insert into public.webhook_deliveries (endpoint_id, event_name, payload)
    values (v_endpoint.id, p_event_name, p_payload);
  end loop;
end;
$$;
-- service_role only. Independent review before push: the original version
-- of this migration also granted `authenticated`, reasoning that the 7
-- trigger functions below "run as the invoking user" — that reasoning was
-- wrong. Every one of those triggers is itself `security definer`, so its
-- internal call to emit_webhook_event() already executes under the
-- trigger function's own owner privilege, not the end user's — the
-- `authenticated` grant was never needed for the real call sites to work.
-- What it DID do: let any authenticated platform user call
-- emit_webhook_event(p_org_id, p_event_name, p_payload) directly with a
-- fully attacker-chosen org_id and payload — fabricating a fake "grade
-- changed"/"certificate issued"/etc event for an org the caller has no
-- relationship to, which dispatch-webhooks would then sign with this app's
-- real HMAC secret and deliver to that org's real webhook consumer as if
-- genuine. Worse in kind than record_sso_login's original bug (that one
-- forged log rows; this one would forge signed, externally-delivered
-- business events) — removed before this migration ever shipped.
revoke all on function public.emit_webhook_event(uuid, text, jsonb) from public;
grant execute on function public.emit_webhook_event(uuid, text, jsonb) to service_role;

-- ── API-004 : the 7 initial event triggers ──────────────────────────────
-- Real-time triggers (fire immediately on write), not the automation
-- engine's nightly batch-scan pattern (_automation_trigger_candidates,
-- 20260813070000) — a webhook needs near-real-time delivery, batching to
-- next day would defeat "webhooks" as a concept. Same trigger points AGS's
-- _enqueue_lti_ags_score() and NRPS already established are real, not
-- invented fresh here.

create or replace function public._emit_enrollment_webhook()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.emit_webhook_event(new.org_id, 'enrollment', jsonb_build_object(
    'enrollment_id', new.id, 'session_id', new.session_id, 'learner_id', new.learner_id, 'status', new.status
  ));
  return new;
end; $$;
create trigger enrollments_emit_webhook after insert on public.enrollments
  for each row execute function public._emit_enrollment_webhook();

create or replace function public._emit_submission_webhook()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org_id uuid;
begin
  if new.status not in ('submitted','late') or (tg_op = 'UPDATE' and old.status = new.status) then
    return new;
  end if;
  select org_id into v_org_id from public.assignments where id = new.assignment_id;
  if v_org_id is not null then
    perform public.emit_webhook_event(v_org_id, 'submission', jsonb_build_object(
      'submission_id', new.id, 'assignment_id', new.assignment_id, 'learner_id', new.learner_id, 'status', new.status
    ));
  end if;
  return new;
end; $$;
create trigger submissions_emit_webhook after insert or update of status on public.submissions
  for each row execute function public._emit_submission_webhook();

create or replace function public._emit_grade_webhook()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org_id uuid;
begin
  -- Same publish gate AGS's own score-relay trigger already uses — an
  -- unpublished/draft grade never leaves this app via any channel.
  if new.published_at is null then
    return new;
  end if;
  select org_id into v_org_id from public.grade_items where id = new.grade_item_id;
  if v_org_id is not null then
    perform public.emit_webhook_event(v_org_id, 'grade', jsonb_build_object(
      'grade_result_id', new.id, 'grade_item_id', new.grade_item_id, 'learner_id', new.learner_id,
      'points', new.points, 'status', new.status
    ));
  end if;
  return new;
end; $$;
create trigger grade_results_emit_webhook after insert or update of status, points, published_at on public.grade_results
  for each row execute function public._emit_grade_webhook();

create or replace function public._emit_completion_webhook()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org_id uuid; v_learner_id uuid;
begin
  if not new.satisfied or (tg_op = 'UPDATE' and old.satisfied) then
    return new;
  end if;
  select org_id, learner_id into v_org_id, v_learner_id from public.enrollments where id = new.enrollment_id;
  if v_org_id is not null then
    perform public.emit_webhook_event(v_org_id, 'completion', jsonb_build_object(
      'enrollment_id', new.enrollment_id, 'learner_id', v_learner_id, 'policy_set_id', new.policy_set_id
    ));
  end if;
  return new;
end; $$;
create trigger completion_results_emit_webhook after insert or update of satisfied on public.enrollment_completion_results
  for each row execute function public._emit_completion_webhook();

-- certificates has no org_id (confirmed absent, 20260730180000 predates
-- this program) — same fallback this program already uses elsewhere for a
-- table lacking one (import_qti_items()/import_legacy_quiz_as_assessment():
-- the recipient's first org membership by created_at). A learner in more
-- than one org has their certificate webhook attributed to whichever org
-- they joined first, not necessarily "the right one" for that certificate
-- — a real, stated approximation, not a guess dressed up as certainty.
create or replace function public._emit_certificate_webhook()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org_id uuid;
begin
  select org_id into v_org_id from public.user_org_roles where user_id = new.user_id order by created_at limit 1;
  if v_org_id is not null then
    perform public.emit_webhook_event(v_org_id, 'certificate', jsonb_build_object(
      'certificate_id', new.id, 'user_id', new.user_id, 'course_id', new.course_id, 'certificate_number', new.certificate_number
    ));
  end if;
  return new;
end; $$;
create trigger certificates_emit_webhook after insert on public.certificates
  for each row execute function public._emit_certificate_webhook();

create or replace function public._emit_content_publish_webhook()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    perform public.emit_webhook_event(new.org_id, 'content.publish', jsonb_build_object(
      'assessment_id', new.id, 'title', new.title, 'published_version', new.published_version
    ));
  end if;
  return new;
end; $$;
create trigger assessments_emit_webhook after insert or update of status on public.assessments
  for each row execute function public._emit_content_publish_webhook();

create or replace function public._emit_mastery_webhook()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org_id uuid;
begin
  select f.org_id into v_org_id
  from public.competencies c join public.competency_frameworks f on f.id = c.framework_id
  where c.id = new.competency_id;
  if v_org_id is not null then
    perform public.emit_webhook_event(v_org_id, 'mastery.change', jsonb_build_object(
      'competency_id', new.competency_id, 'learner_id', new.learner_id,
      'from_level', new.from_level, 'to_level', new.to_level
    ));
  end if;
  return new;
end; $$;
create trigger mastery_history_emit_webhook after insert on public.competency_mastery_history
  for each row execute function public._emit_mastery_webhook();

-- ── API-002 : scope strings the v1 API checks ──────────────────────────────
comment on column public.api_tokens.scopes is
  'Scope strings checked by api-v1 endpoints: api:enrollments:read, api:grades:read, api:completions:read, api:certificates:read. Also scim:* (SCIM) and oneroster:sync (OneRoster REST), established earlier this session.';

-- ── API-001 : per-org rate limiting ─────────────────────────────────────────
-- Sliding-window count against webhook_deliveries... no: against a
-- dedicated request-count table, since rate-limiting the *public read* API
-- has nothing to do with webhook delivery volume. Mirrors the moderation
-- rate-limiter's shape (20260813060000_live_moderation_rate_limit_term_
-- filter.sql — count(*) where created_at > now() - interval, reject over
-- threshold) rather than inventing a different algorithm.
create table public.api_request_log (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.api_clients(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index api_request_log_client_idx on public.api_request_log(client_id, created_at desc);
alter table public.api_request_log enable row level security;
-- No policies: written only by _check_and_log_api_request (service_role,
-- called from inside api-v1's own request handling before any resource
-- read) — an authenticated caller has no reason to ever touch this table
-- directly, it's telemetry the request path writes about itself.

-- Returns true (and logs the request) if under the limit; false (and does
-- NOT log) if the caller should be rejected with 429 — a rejected request
-- doesn't count against its own future window, only requests that were
-- actually served do.
create or replace function public._check_and_log_api_request(p_client_id uuid, p_limit_per_minute integer default 120)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.api_request_log
    where client_id = p_client_id and created_at > now() - interval '60 seconds';
  if v_count >= p_limit_per_minute then
    return false;
  end if;
  insert into public.api_request_log (client_id) values (p_client_id);
  return true;
end;
$$;
revoke all on function public._check_and_log_api_request(uuid, integer) from public;
grant execute on function public._check_and_log_api_request(uuid, integer) to service_role;

-- ── API-001 : idempotency-key support (prepared, not yet exercised) ────────
-- v1's actual endpoint set this pass (enrollments/grades/completions/
-- certificates) is read-only by deliberate scope decision (see api-v1/
-- index.ts's header comment) — none of those resources should be directly
-- writable by an external system through this generic API, consistent with
-- this whole spec's posture (LTI/SSO/SCIM/OneRoster only ever touch
-- identity/roster, never academic records, directly). idempotency_keys
-- exists so a future write endpoint has a real table to dedupe against
-- rather than needing its own migration later — not exercised by any
-- endpoint in this pass, stated plainly rather than faked with a token
-- write endpoint that has no real use.
create table public.api_idempotency_keys (
  client_id  uuid not null references public.api_clients(id) on delete cascade,
  key        text not null,
  response   jsonb,
  created_at timestamptz not null default now(),
  primary key (client_id, key)
);
alter table public.api_idempotency_keys enable row level security;
-- No policies: service_role only (api-v1's own request handling), never
-- meant to be queried directly by a client.
