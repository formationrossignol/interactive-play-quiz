-- Spec 10 — Gouvernance, versionnement, localisation et diffusion du contenu
-- (docs/product-specs/2026-08-10-lms-program/10-content-governance.md).
-- CNT-020 to CNT-023: `media_assets`/`media_asset_versions`/`asset_usages`
-- have existed since 20260811000000_content_governance.sql with RLS but no
-- storage bucket, no version-number writer, no usage writer, and no
-- deletion guard at all — `media_assets_org` is a `for all` policy, so a
-- direct client `.delete()` would already have silently removed a row with
-- real usages the moment any UI called it. This migration closes that
-- before adding anything else.
--
-- CNT-021 ("remplacer un asset crée une version ; le contenu existant reste
-- lié à sa variante jusqu'à adoption") is why media_asset_versions.version
-- needs a real writer that can't collide under a second upload racing the
-- first: a BEFORE INSERT trigger, not a client-computed max()+1 (the classic
-- TOCTOU on this exact pattern), locking the parent media_assets row first.
--
-- CNT-022 ("recherche d'usages avant suppression, prévention si preuve ou
-- version publiée dépend") needs a *source* of usage rows to search — this
-- schema doesn't scan `content.data` looking for asset references (every
-- builder has its own JSON shape; guessing at that is exactly the mistake
-- this program has already made and walked back elsewhere, e.g. the
-- competency tag migration). record_asset_usage()/remove_asset_usage()
-- below are the writer: an author explicitly records "I used this asset
-- here" from a media picker, the same posture as evidence/alignment
-- elsewhere in this program — automatic content-scanning is not guessed at.
--
-- CNT-023 (scan/quotas/allowed types/signed URLs): signed URLs are real
-- (private bucket, org-scoped RLS below, same shape as assignment-
-- submissions). Antivirus scanning is not — this repo already has exactly
-- one deferred antivirus item (submission_files.scan_status, spec 01,
-- "vendor à choisir") and this is the same open question, not a second one
-- to pretend to answer. Quotas/allowed-types are enforced client-side only
-- (reusing fileValidation.ts's existing size/type checks), not a hard
-- per-org quota table — no such table exists in the indicative model either.

insert into storage.buckets (id, name, public)
values ('content-media-assets', 'content-media-assets', false)
on conflict (id) do nothing;

-- Path convention <org_id>/<asset_id>/<filename> — org_id is the literal
-- first segment (no join needed, unlike assignment-submissions where the
-- owning org has to be resolved through a parent row).
create policy media_assets_bucket_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'content-media-assets'
    and public.has_org_role((storage.foldername(name))[1]::uuid, array['trainer','pedago','admin'])
  );

create policy media_assets_bucket_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'content-media-assets'
    and public.has_org_role((storage.foldername(name))[1]::uuid, array['trainer','pedago','admin'])
  );

-- ── version auto-numbering, race-safe ───────────────────────────────────────
create or replace function public._set_media_asset_version_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  perform 1 from public.media_assets where id = new.asset_id for update;
  select coalesce(max(version), 0) + 1 into v_next from public.media_asset_versions where asset_id = new.asset_id;
  new.version := v_next;
  return new;
end;
$$;

create trigger media_asset_versions_set_version
  before insert on public.media_asset_versions
  for each row execute function public._set_media_asset_version_number();

-- ── deletion guard, CNT-022 ──────────────────────────────────────────────
-- media_assets_org was `for all` (select/insert/update/delete) — that let a
-- direct client .delete() remove a row with real usages, silently, the
-- moment any UI ever called it. Split it: delete is no longer covered by
-- any RLS policy (denied by default), only delete_media_asset() below can
-- remove a row, and only after checking asset_usages is empty.
drop policy if exists media_assets_org on public.media_assets;
create policy media_assets_org_select on public.media_assets
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));
create policy media_assets_org_insert on public.media_assets
  for insert with check (public.has_org_role(org_id, array['trainer','pedago','admin']));
create policy media_assets_org_update on public.media_assets
  for update using (public.has_org_role(org_id, array['trainer','pedago','admin']))
  with check (public.has_org_role(org_id, array['trainer','pedago','admin']));

create or replace function public.check_asset_deletable(p_asset_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_usages jsonb;
begin
  select org_id into v_org_id from public.media_assets where id = p_asset_id;
  if v_org_id is null then
    raise exception 'Asset not found';
  end if;
  if not public.has_org_role(v_org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('content_id', u.content_id, 'usage_ref', u.usage_ref)), '[]'::jsonb)
  into v_usages
  from public.asset_usages u
  join public.media_asset_versions v on v.id = u.asset_version_id
  where v.asset_id = p_asset_id;

  return jsonb_build_object('deletable', jsonb_array_length(v_usages) = 0, 'blocking_usages', v_usages);
end;
$$;
revoke all on function public.check_asset_deletable(uuid) from public;
grant execute on function public.check_asset_deletable(uuid) to authenticated;

-- Deliberately pedago/admin only, not trainer — narrower than select/
-- insert/update above. A shared org asset can be in use by content a
-- given trainer has no visibility into; upload/edit stays permissive,
-- deletion doesn't.
create or replace function public.delete_media_asset(p_asset_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_usage_count integer;
begin
  select org_id into v_org_id from public.media_assets where id = p_asset_id for update;
  if v_org_id is null then
    raise exception 'Asset not found';
  end if;
  if not public.has_org_role(v_org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  select count(*) into v_usage_count
  from public.asset_usages u join public.media_asset_versions v on v.id = u.asset_version_id
  where v.asset_id = p_asset_id;
  if v_usage_count > 0 then
    raise exception 'Asset is in use — remove its % usage(s) first', v_usage_count;
  end if;

  -- Row deletion only — the storage bytes behind each version's
  -- storage_path are not removed here (no service-role storage call from
  -- inside a migration-defined function; that needs an edge function this
  -- pass doesn't build). A documented gap, not a silent one: orphaned
  -- objects in the bucket outlive their row, cleaned up separately.
  delete from public.media_assets where id = p_asset_id;
end;
$$;
revoke all on function public.delete_media_asset(uuid) from public;
grant execute on function public.delete_media_asset(uuid) to authenticated;

-- ── usage tracking, CNT-022's other half ────────────────────────────────
create or replace function public.record_asset_usage(p_asset_version_id uuid, p_content_id uuid, p_usage_ref text default null)
returns public.asset_usages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset_org uuid;
  v_content public.content;
  v_result public.asset_usages;
begin
  select a.org_id into v_asset_org from public.media_asset_versions v join public.media_assets a on a.id = v.asset_id where v.id = p_asset_version_id;
  if v_asset_org is null then
    raise exception 'Asset version not found';
  end if;
  select * into v_content from public.content where id = p_content_id;
  if v_content.id is null then
    raise exception 'Content not found';
  end if;
  if v_content.org_id <> v_asset_org then
    raise exception 'Asset and content belong to different organizations';
  end if;
  if v_content.user_id <> auth.uid() and not public.has_org_role(v_content.org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  insert into public.asset_usages (asset_version_id, content_id, usage_ref)
  values (p_asset_version_id, p_content_id, p_usage_ref)
  returning * into v_result;

  return v_result;
end;
$$;
revoke all on function public.record_asset_usage(uuid, uuid, text) from public;
grant execute on function public.record_asset_usage(uuid, uuid, text) to authenticated;

create or replace function public.remove_asset_usage(p_usage_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content_org uuid;
  v_content_user uuid;
begin
  select c.org_id, c.user_id into v_content_org, v_content_user
  from public.asset_usages u join public.content c on c.id = u.content_id
  where u.id = p_usage_id;
  if v_content_org is null then
    raise exception 'Usage not found';
  end if;
  if v_content_user <> auth.uid() and not public.has_org_role(v_content_org, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  delete from public.asset_usages where id = p_usage_id;
end;
$$;
revoke all on function public.remove_asset_usage(uuid) from public;
grant execute on function public.remove_asset_usage(uuid) to authenticated;
