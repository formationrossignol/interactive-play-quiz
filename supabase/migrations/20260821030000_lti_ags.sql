-- Spec 04 — Interopérabilité, identité et administration Enterprise
-- (docs/product-specs/2026-08-10-lms-program/04-interoperability-identity.md:69-70).
-- LTI-004 — Assignment and Grade Services: "création de line item et retour
-- de score idempotent, avec file de reprise."
--
-- Real gradable-content check done before writing this (same discipline as
-- LTI-002's course-only finding, 20260821020000_lti_deep_linking.sql): no
-- `grade_items` row anywhere in this codebase has ever had `course` as a
-- source — course content produces *completion* (completion_policy_sets/
-- enrollment_completion_results, spec 02), never a numeric score. LTI-002
-- only wires `course` content (quiz/poll/exam have no solo-attempt viewing
-- route). So: AGS is built here as a real, generic, fully-working mechanism
-- for ANY `lti`-sourced grade_item — but nothing in this app *creates* a
-- gradable lti resource-link launch today, so nothing auto-fires it yet.
-- This is the same honest gap LTI-002 already stated, not hidden here.

-- ── grade_items.source_type: +'lti' ─────────────────────────────────────
alter table public.grade_items drop constraint grade_items_source_type_check;
alter table public.grade_items add constraint grade_items_source_type_check
  check (source_type in ('assignment','quiz','exam','manual','scorm','h5p','lti'));

-- ── lti_resource_links : one resource-link launch's AGS anchor ─────────────
-- (registration_id, resource_link_id) is the stable key a platform reuses
-- across every launch of "the same" placed link — the LTI `resource_link`
-- claim's `id`, distinct from `deployment_id` (many resource links share one
-- deployment). `line_item_url`/`line_items_url`/`ags_scopes` are exactly
-- what the platform sent in the AGS `endpoint` claim at launch — never
-- guessed. `grade_item_id` starts null: creating it requires either reading
-- the platform's own already-existing line item (real scoreMaximum, not
-- invented) or a caller supplying one to *create* a line item for real
-- content this tool actually has to grade — see ensure_lti_grade_item()
-- below, deliberately not auto-invoked at launch (see file header).
create table public.lti_resource_links (
  id                  uuid primary key default gen_random_uuid(),
  registration_id     uuid not null references public.lti_registrations(id) on delete cascade,
  deployment_id       text not null,
  resource_link_id    text not null,
  context_external_id text,
  title               text,
  line_item_url       text,
  line_items_url      text,
  ags_scopes          jsonb not null default '[]'::jsonb,
  grade_item_id       uuid references public.grade_items(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (registration_id, resource_link_id)
);
create index lti_resource_links_registration_idx on public.lti_resource_links(registration_id);
alter table public.lti_resource_links enable row level security;
create policy lti_resource_links_admin on public.lti_resource_links
  for select using (exists (
    select 1 from public.lti_registrations r where r.id = registration_id and public.has_org_role(r.org_id, array['admin'])
  ));
-- No insert/update policy for authenticated: written only by
-- upsert_lti_resource_link() (service_role, called from lti-launch) and
-- ensure_lti_grade_item() below.
create trigger lti_resource_links_touch before update on public.lti_resource_links
  for each row execute function public.touch_updated_at();

-- ── upsert_lti_resource_link() : anchor + AGS claim snapshot, per launch ───
-- Idempotent by design (unique registration_id+resource_link_id, plain
-- upsert) — the same resource link launched 100 times updates one row, never
-- creates duplicates. Deliberately does NOT touch grade_item_id or call the
-- platform: recording what the platform advertised is safe and cheap on
-- every launch; deciding to create/fetch a line item is not (see file
-- header) and is a separate, explicitly-invoked step.
create or replace function public.upsert_lti_resource_link(
  p_registration_id uuid,
  p_deployment_id text,
  p_resource_link_id text,
  p_context_external_id text,
  p_title text,
  p_line_item_url text,
  p_line_items_url text,
  p_ags_scopes jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.lti_resource_links (
    registration_id, deployment_id, resource_link_id, context_external_id,
    title, line_item_url, line_items_url, ags_scopes
  ) values (
    p_registration_id, p_deployment_id, p_resource_link_id, p_context_external_id,
    p_title, p_line_item_url, p_line_items_url, coalesce(p_ags_scopes, '[]'::jsonb)
  )
  on conflict (registration_id, resource_link_id) do update set
    deployment_id = excluded.deployment_id,
    context_external_id = excluded.context_external_id,
    title = excluded.title,
    -- A platform can start advertising a line_item_url it didn't have
    -- before (e.g. an admin configures grading after the fact) — always
    -- take the platform's latest claim, never stick to a stale null.
    line_item_url = excluded.line_item_url,
    line_items_url = excluded.line_items_url,
    ags_scopes = excluded.ags_scopes
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.upsert_lti_resource_link(uuid, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.upsert_lti_resource_link(uuid, text, text, text, text, text, text, jsonb) to service_role;

-- ── ensure_lti_grade_item() : the actual grade_items row for a resource link
-- Not called from lti-launch (see file header — no real score source exists
-- yet). This is the real capability a future gradable-content path calls:
-- given a resource link that already has grade_item_id set, no-ops (returns
-- the existing id). Otherwise requires the caller to already know
-- max_points/title for the content THIS TOOL is actually grading (never
-- invented here) — inserts grade_items(source_type='lti', source_id=
-- lti_resource_links.id) and links it back. Does not itself call the
-- platform (creating/fetching the platform-side LineItem resource is the
-- edge function's job, using fetchLtiServiceToken — Postgres has no outbound
-- HTTP here, same constraint every other outbound integration in this repo
-- already works around).
create or replace function public.ensure_lti_grade_item(
  p_resource_link_id uuid,
  p_title text,
  p_max_points numeric
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link record;
  v_org_id uuid;
  v_grade_item_id uuid;
begin
  select rl.*, r.org_id into v_link
  from public.lti_resource_links rl join public.lti_registrations r on r.id = rl.registration_id
  where rl.id = p_resource_link_id;

  if v_link.id is null then
    raise exception 'Unknown lti_resource_links row';
  end if;
  if v_link.grade_item_id is not null then
    return v_link.grade_item_id;
  end if;
  if p_max_points is null or p_max_points <= 0 then
    raise exception 'max_points required to create a grade item';
  end if;

  insert into public.grade_items (org_id, session_id, source_type, source_id, title, weight, max_points)
  values (v_link.org_id, null, 'lti', p_resource_link_id, coalesce(p_title, v_link.title, 'LTI'), 1, p_max_points)
  returning id into v_grade_item_id;

  update public.lti_resource_links set grade_item_id = v_grade_item_id where id = p_resource_link_id;

  return v_grade_item_id;
end;
$$;
revoke all on function public.ensure_lti_grade_item(uuid, text, numeric) from public;
grant execute on function public.ensure_lti_grade_item(uuid, text, numeric) to service_role;

-- ── lti_ags_score_queue : retry queue for outbound Score POSTs ────────────
-- Same pending/sent/failed shape as automation_email_outbox
-- (20260813070000_automation_execution_engine.sql) — the established
-- pattern in this codebase for "an outbound action that must survive a
-- transient failure," reused rather than reinvented. unique(grade_item_id,
-- learner_id): a learner's score for a given lti grade_item has exactly one
-- current desired-state row — a second publish before the first send fires
-- collapses into the same row (see _enqueue_lti_ags_score() below), it does
-- not queue two sends that could arrive out of order at the platform.
-- retry_count/bounded max_attempts is what makes "reprise" (LTI-004's own
-- word for it) bounded rather than infinite.
create table public.lti_ags_score_queue (
  id            uuid primary key default gen_random_uuid(),
  grade_item_id uuid not null references public.grade_items(id) on delete cascade,
  learner_id    uuid not null references auth.users(id) on delete cascade,
  -- 'sending' is the atomic-claim intermediate state dispatch-lti-ags-scores
  -- uses (`update ... where status='pending' set status='sending'`) — without
  -- it in this list, that claim's UPDATE violates the check constraint on
  -- every single row, silently returns no data (the caller only reads
  -- `.data`, discards `.error`), and the entire dispatch loop would skip
  -- every row forever without ever sending anything. Caught in independent
  -- review before push — not present in the first version of this migration.
  status        text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  retry_count   integer not null default 0,
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  sent_at       timestamptz,
  unique (grade_item_id, learner_id)
);
create index lti_ags_score_queue_pending_idx on public.lti_ags_score_queue(status, created_at) where status = 'pending';
alter table public.lti_ags_score_queue enable row level security;
create policy lti_ags_score_queue_staff_read on public.lti_ags_score_queue
  for select using (exists (
    select 1 from public.grade_items gi where gi.id = grade_item_id and public.has_org_role(gi.org_id, array['pedago','admin'])
  ));
-- No insert/update policy for authenticated: only the trigger below
-- (security definer) and the dispatch edge function (service_role) write
-- this table.
create trigger lti_ags_score_queue_touch before update on public.lti_ags_score_queue
  for each row execute function public.touch_updated_at();

-- ── _enqueue_lti_ags_score() : fires on every grade_results write ─────────
-- A trigger on grade_results itself (not a change to every RPC that writes
-- it — publish_submission_grade, the CSV import, plagiarism/anonymous-
-- grading paths all already write this table independently, per this
-- session's investigation; a trigger is the only place that sees all of
-- them without touching each one). Only acts when the grade_item is
-- lti-sourced and the result is actually published (unpublished/draft
-- grades never leave this app, same "published" gate grade_results.
-- published_at already enforces elsewhere). Upsert, not insert: a second
-- publish before the first send collapses into the same queue row and
-- resets it to 'pending' — a grade corrected twice before the platform is
-- ever told about the first value only ever sends the latest one, not a
-- stale intermediate score, and idempotent under retries — reprocessing the
-- same row updates the same platform-side result, no duplicate rows.
create or replace function public._enqueue_lti_ags_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_type text;
begin
  if new.published_at is null then
    return new;
  end if;
  select source_type into v_source_type from public.grade_items where id = new.grade_item_id;
  if v_source_type is distinct from 'lti' then
    return new;
  end if;

  insert into public.lti_ags_score_queue (grade_item_id, learner_id, status, retry_count)
  values (new.grade_item_id, new.learner_id, 'pending', 0)
  on conflict (grade_item_id, learner_id) do update set
    status = 'pending',
    retry_count = 0,
    last_error = null;

  return new;
end;
$$;

create trigger grade_results_enqueue_lti_ags_score
  after insert or update of status, points, published_at on public.grade_results
  for each row execute function public._enqueue_lti_ags_score();

-- service_role only: the dispatch edge function is the sole reader/writer of
-- queue rows beyond the trigger above and the staff-read policy — never
-- granted authenticated write access (mirrors every other queue/log table
-- posture already established this session: sso_logins, saml_login_states,
-- lti_deep_linking_sessions).
