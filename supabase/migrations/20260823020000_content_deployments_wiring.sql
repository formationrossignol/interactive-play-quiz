-- Spec 10 — Gouvernance, versionnement, localisation et diffusion du contenu
-- (docs/product-specs/2026-08-10-lms-program/10-content-governance.md).
-- CNT-011/012/013: `content_deployments` (20260811000000_content_governance.sql)
-- has existed with zero writers — this migration is the first.
--
-- Real reconciliation finding, checked before writing anything here: session
-- content delivery (`course_sessions.content_snapshot`/`content_hash`/
-- `content_schema_version`, 20260810150000_enrollment_roster.sql) predates
-- spec 10 entirely and is a *second*, independent snapshot mechanism —
-- `createCourseSession()` (enrollment.ts) copies `content.data` straight off
-- the live row at session-creation time, `content_hash` is literally
-- `String(content.updated_at)` (not a real hash), and it never touches
-- `content_versions`/`content_releases` at all. This migration does not
-- replace that path — existing session creation is untouched, still works
-- exactly as before for content with no release. What it adds is an
-- *optional* governed layer on top: once a release exists, staff can attach
-- a `content_deployments` row to a session, and from then on that session's
-- snapshot can be checked against newer releases and explicitly updated —
-- never automatically (CNT-012's "jamais appliquée silencieusement").
--
-- CNT-013 ("une session commencée reste par défaut sur sa version") falls
-- out for free: nothing here ever runs unprompted, so a deployment's pinned
-- version — and therefore the session's snapshot — never changes unless a
-- human calls adopt_content_deployment_update() explicitly.
--
-- Only `deployment_type = 'session'` actually syncs a consumer table on
-- adopt (course_sessions is the one real, already-existing snapshot
-- consumer in this codebase — content_snapshot/content_hash/
-- content_schema_version). 'path'/'public_url'/'integration' deployments
-- can still be created and their updates checked, but adopting one only
-- updates content_deployments.pinned_version's own bookkeeping — there is
-- no other table to sync yet for those types, not guessed at here.
--
-- CNT-014 (forced update for a security/critical fix, with rollback) and
-- CNT-015 (missing/unpublished dependencies block a release) are not built
-- here — CNT-015 needs a real dependency graph between content items that
-- doesn't exist in this schema, and CNT-014 is its own escalation/audit
-- workflow layered on top of what's built here, not a small addition.

-- ── create_content_deployment() ─────────────────────────────────────────────
create or replace function public.create_content_deployment(
  p_release_id uuid,
  p_deployment_type text,
  p_deployment_ref uuid,
  p_update_policy text default 'pinned'
)
returns public.content_deployments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_release public.content_releases;
  v_content public.content;
  v_result public.content_deployments;
begin
  select * into v_release from public.content_releases where id = p_release_id;
  if v_release.id is null then
    raise exception 'Release not found';
  end if;
  select * into v_content from public.content where id = v_release.content_id;
  if v_content.id is null then
    raise exception 'Content not found';
  end if;
  if v_content.user_id <> auth.uid() and not public.has_org_role(v_content.org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  if p_deployment_type not in ('session','path','public_url','integration') then
    raise exception 'Invalid deployment type';
  end if;
  if p_update_policy not in ('pinned','follow_approved_updates') then
    raise exception 'Invalid update policy';
  end if;

  -- Sanity check the one wired consumer type: a 'session' deployment must
  -- actually point at a session delivering *this* content, not an unrelated
  -- one — nothing else stops a UI bug (or a stale form) from attaching
  -- governance to the wrong session.
  if p_deployment_type = 'session' and not exists (
    select 1 from public.course_sessions cs
    join public.course_offerings co on co.id = cs.offering_id
    where cs.id = p_deployment_ref and co.content_id = v_content.id
  ) then
    raise exception 'deployment_ref is not a session delivering this content';
  end if;

  insert into public.content_deployments (release_id, deployment_type, deployment_ref, update_policy, pinned_version)
  values (p_release_id, p_deployment_type, p_deployment_ref, p_update_policy, v_release.version)
  returning * into v_result;

  return v_result;
end;
$$;
revoke all on function public.create_content_deployment(uuid, text, uuid, text) from public;
grant execute on function public.create_content_deployment(uuid, text, uuid, text) to authenticated;

-- ── check_content_deployment_update() : read-only diff, CNT-012 ────────────
create or replace function public.check_content_deployment_update(p_deployment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_deployment public.content_deployments;
  v_content_id uuid;
  v_org_id uuid;
  v_current public.content_versions;
  v_latest public.content_versions;
begin
  select d.* into v_deployment
  from public.content_deployments d join public.content_releases r on r.id = d.release_id
  where d.id = p_deployment_id;
  if v_deployment.id is null then
    raise exception 'Deployment not found';
  end if;

  select r.content_id into v_content_id from public.content_releases r where r.id = v_deployment.release_id;
  select c.org_id into v_org_id from public.content c where c.id = v_content_id;
  if not public.has_org_role(v_org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  select * into v_current from public.content_versions where content_id = v_content_id and version = v_deployment.pinned_version;
  select * into v_latest from public.content_versions
  where content_id = v_content_id and status = 'published'
  order by version desc limit 1;

  return jsonb_build_object(
    'deployment_id', v_deployment.id,
    'content_id', v_content_id,
    'pinned_version', v_deployment.pinned_version,
    'latest_published_version', v_latest.version,
    'has_update', v_latest.version is not null and v_latest.version <> v_deployment.pinned_version,
    'changelog', v_latest.changelog,
    'hash_changed', v_current.hash is distinct from v_latest.hash,
    'schema_version_changed', v_current.schema_version is distinct from v_latest.schema_version
  );
end;
$$;
revoke all on function public.check_content_deployment_update(uuid) from public;
grant execute on function public.check_content_deployment_update(uuid) to authenticated;

-- ── adopt_content_deployment_update() : the only writer that ever moves a
-- deployment's pinned_version, and the only path that ever mutates a
-- course_sessions snapshot after creation. Always explicit — see file header.
create or replace function public.adopt_content_deployment_update(p_deployment_id uuid, p_to_version integer)
returns public.content_deployments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deployment public.content_deployments;
  v_content_id uuid;
  v_org_id uuid;
  v_content public.content;
  v_target public.content_versions;
  v_result public.content_deployments;
begin
  select d.* into v_deployment from public.content_deployments d where d.id = p_deployment_id for update;
  if v_deployment.id is null then
    raise exception 'Deployment not found';
  end if;

  select r.content_id into v_content_id from public.content_releases r where r.id = v_deployment.release_id;
  select * into v_content from public.content where id = v_content_id;
  v_org_id := v_content.org_id;
  if v_content.user_id <> auth.uid() and not public.has_org_role(v_org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  select * into v_target from public.content_versions where content_id = v_content_id and version = p_to_version and status = 'published';
  if v_target.id is null then
    raise exception 'Target version is not a published version of this content';
  end if;

  update public.content_deployments set pinned_version = p_to_version where id = p_deployment_id returning * into v_result;

  if v_deployment.deployment_type = 'session' then
    update public.course_sessions
    set content_snapshot = v_target.snapshot, content_hash = v_target.hash, content_schema_version = v_target.schema_version
    where id = v_deployment.deployment_ref;
  end if;

  perform public.emit_learning_event(
    'content.deployment_updated', v_org_id, auth.uid(), 'content_deployment', p_deployment_id,
    jsonb_build_object('content_id', v_content_id, 'from_version', v_deployment.pinned_version, 'to_version', p_to_version, 'deployment_type', v_deployment.deployment_type)
  );

  return v_result;
end;
$$;
revoke all on function public.adopt_content_deployment_update(uuid, integer) from public;
grant execute on function public.adopt_content_deployment_update(uuid, integer) to authenticated;

-- No list_content_deployments() RPC: content_deployments_read (already on
-- this table) covers a straight select, and listing "every deployment for
-- this content_id across its releases" is a PostgREST embedded-filter query
-- the client can do directly (content_deployments -> content_releases
-- !inner, filtered on content_releases.content_id) — same posture as the
-- rest of this program, an RPC only exists where RLS can't be traversed
-- directly by itself.
