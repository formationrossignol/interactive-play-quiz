-- Spec 10 — Gouvernance, versionnement, localisation et diffusion du contenu
-- (docs/product-specs/2026-08-10-lms-program/10-content-governance.md).
-- CNT-006 to CNT-010: the review workflow tables (content_versions with its
-- 7-state status, review_requests, review_steps, content_releases) already
-- existed (20260811000000_content_governance.sql) but had exactly two
-- writers — publish_content_version() and restore_content_version() — both
-- of which skip the workflow entirely and go straight to 'published'. No
-- function ever created a 'draft' row, moved anything to 'in_review',
-- recorded a review decision, or wrote to content_releases at all — that
-- table has existed with zero rows possible since 08-11. This migration is
-- the workflow itself: draft -> in_review -> approved -> published, with
-- review_requests/review_steps as the audit trail CNT-006 already modeled
-- but nothing ever populated.
--
-- publish_content_version() is left untouched: a solo creator with no
-- organizational review process still needs a one-step "publish now" path,
-- and the existing call site (ContentGovernance.tsx) depends on its exact
-- current behavior. The functions below are an *additional* path, not a
-- replacement — content_versions.status is what tells them apart at read
-- time (a version published via the old function has no review_requests row
-- pointing at it; that's a legitimate state, not a data gap).
--
-- CNT-009 ("toute modification après approbation invalide l'approbation")
-- falls out of the existing immutability guarantee rather than needing new
-- bookkeeping: content_versions rows are never updated after insert except
-- for status/approved_by, never `snapshot`. Any further edit necessarily
-- creates a *new* version row (save_content_draft below), which starts at
-- 'draft' — the approval on the old row is simply about a row nothing will
-- ever publish over again, not something that needs explicit revocation.
--
-- CNT-007's "séparation auteur/approbateur facultative": this migration
-- always enforces the separation (a reviewer can never decide on their own
-- version) rather than exposing it as a per-org toggle — the safer default,
-- not the full requirement; making it configurable is a follow-up, not
-- guessed at here.
--
-- Scheduled publish/retire (the timing half of CNT-010) is not built here —
-- channel + release notes (the rest of CNT-010) are. Scheduling would need
-- its own sweep step on the existing nightly job and its own "not yet live"
-- read-path semantics for content_releases everywhere it's read — nothing
-- reads content_releases at all yet, so that's speculative infrastructure
-- for a consumer that doesn't exist, not a small addition to this pass.

-- ── save_content_draft() : same optimistic-concurrency shape as
-- publish_content_version(), just landing at 'draft' instead of 'published'.
create or replace function public.save_content_draft(
  p_content_id uuid,
  p_expected_version integer,
  p_snapshot jsonb,
  p_changelog text default null
)
returns public.content_versions
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_content public.content;
  v_current_max integer;
  v_result public.content_versions;
begin
  select * into v_content from public.content where id = p_content_id for update;
  if v_content.id is null then
    raise exception 'Content not found';
  end if;
  if v_content.user_id <> auth.uid() and not public.has_org_role(v_content.org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  select coalesce(max(version), 0) into v_current_max from public.content_versions where content_id = p_content_id;
  if v_current_max <> p_expected_version then
    raise exception 'version_conflict';
  end if;

  insert into public.content_versions (content_id, version, snapshot, hash, changelog, status)
  values (p_content_id, v_current_max + 1, p_snapshot, encode(digest(p_snapshot::text, 'sha256'), 'hex'), p_changelog, 'draft')
  returning * into v_result;

  return v_result;
end;
$$;
revoke all on function public.save_content_draft(uuid, integer, jsonb, text) from public;
grant execute on function public.save_content_draft(uuid, integer, jsonb, text) to authenticated;

-- ── submit_content_for_review() : draft -> in_review, opens the
-- review_requests row review_requests_insert's own RLS already shapes
-- (requested_by = auth.uid(), owner-only) — done here instead of a direct
-- client insert only because content_versions.status has to move in the
-- same transaction and that table has no update policy at all.
create or replace function public.submit_content_for_review(p_content_id uuid, p_version integer)
returns public.review_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content public.content;
  v_version_status text;
  v_result public.review_requests;
begin
  select * into v_content from public.content where id = p_content_id;
  if v_content.id is null then
    raise exception 'Content not found';
  end if;
  if v_content.user_id <> auth.uid() and not public.has_org_role(v_content.org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  select status into v_version_status from public.content_versions where content_id = p_content_id and version = p_version for update;
  if v_version_status is null then
    raise exception 'Version not found';
  end if;
  if v_version_status <> 'draft' then
    raise exception 'Only a draft version can be submitted for review';
  end if;
  if exists (select 1 from public.review_requests where content_id = p_content_id and version = p_version and status = 'open') then
    raise exception 'This version already has an open review request';
  end if;

  update public.content_versions set status = 'in_review' where content_id = p_content_id and version = p_version;

  insert into public.review_requests (content_id, version)
  values (p_content_id, p_version)
  returning * into v_result;

  return v_result;
end;
$$;
revoke all on function public.submit_content_for_review(uuid, integer) from public;
grant execute on function public.submit_content_for_review(uuid, integer) to authenticated;

-- ── submit_review_decision() : the only writer of review_steps. A reviewer
-- can never decide on their own version (CNT-007's separation, hardwired —
-- see file header) — checked against content_versions.author_id, not
-- content.user_id, because the version's actual author and the content's
-- current owner can diverge (e.g. a pedago edits someone else's draft).
create or replace function public.submit_review_decision(p_review_request_id uuid, p_decision text, p_note text default null)
returns public.review_steps
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.review_requests;
  v_org_id uuid;
  v_version_author uuid;
  v_result public.review_steps;
  v_new_version_status text;
begin
  if p_decision not in ('approved', 'changes_requested', 'comment') then
    raise exception 'Invalid decision';
  end if;

  select rr.* into v_request from public.review_requests rr where rr.id = p_review_request_id for update;
  if v_request.id is null then
    raise exception 'Review request not found';
  end if;
  select c.org_id into v_org_id from public.content c where c.id = v_request.content_id;
  if not public.has_org_role(v_org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  if v_request.status <> 'open' then
    raise exception 'This review request is already resolved';
  end if;

  select author_id into v_version_author from public.content_versions where content_id = v_request.content_id and version = v_request.version;
  if v_version_author = auth.uid() then
    raise exception 'A reviewer cannot decide on their own version';
  end if;

  insert into public.review_steps (review_request_id, reviewer_id, decision, note)
  values (p_review_request_id, auth.uid(), p_decision, p_note)
  returning * into v_result;

  if p_decision = 'approved' then
    v_new_version_status := 'approved';
  elsif p_decision = 'changes_requested' then
    v_new_version_status := 'changes_requested';
  end if;
  -- decision = 'comment': feedback logged above, request stays 'open' — a
  -- reviewer can leave notes without deciding yet.

  if v_new_version_status is not null then
    update public.content_versions
    set status = v_new_version_status, approved_by = case when p_decision = 'approved' then auth.uid() else approved_by end
    where content_id = v_request.content_id and version = v_request.version;

    update public.review_requests set status = p_decision, resolved_at = now() where id = p_review_request_id;
  end if;

  return v_result;
end;
$$;
revoke all on function public.submit_review_decision(uuid, text, text) from public;
grant execute on function public.submit_review_decision(uuid, text, text) to authenticated;

-- ── publish_approved_version() : the reviewed path's publish step —
-- content_releases' first writer since the table was created. Complements
-- publish_content_version() (the unreviewed, direct path); it never
-- replaces it.
create or replace function public.publish_approved_version(
  p_content_id uuid,
  p_version integer,
  p_channel text default 'library',
  p_release_notes text default null
)
returns public.content_releases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content public.content;
  v_version_status text;
  v_result public.content_releases;
begin
  select * into v_content from public.content where id = p_content_id;
  if v_content.id is null then
    raise exception 'Content not found';
  end if;
  if v_content.user_id <> auth.uid() and not public.has_org_role(v_content.org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  select status into v_version_status from public.content_versions where content_id = p_content_id and version = p_version for update;
  if v_version_status is null then
    raise exception 'Version not found';
  end if;
  if v_version_status <> 'approved' then
    raise exception 'Only an approved version can be published this way';
  end if;

  update public.content_versions set status = 'published' where content_id = p_content_id and version = p_version;

  insert into public.content_releases (content_id, version, channel, release_notes)
  values (p_content_id, p_version, p_channel, p_release_notes)
  returning * into v_result;

  perform public.emit_learning_event('content.published', v_content.org_id, auth.uid(), 'content', p_content_id, jsonb_build_object('version', p_version, 'channel', p_channel));

  return v_result;
end;
$$;
revoke all on function public.publish_approved_version(uuid, integer, text, text) from public;
grant execute on function public.publish_approved_version(uuid, integer, text, text) to authenticated;
