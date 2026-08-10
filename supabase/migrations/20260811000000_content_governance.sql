-- Spec 10 — Gouvernance, versionnement, localisation et diffusion du contenu
-- (docs/product-specs/2026-08-10-lms-program/10-content-governance.md).
--
-- Applies the common version contract on top of the existing polymorphic
-- `content` table (CNT-001, migration note: "les premiers snapshots peuvent
-- encapsuler le JSON existant avec schema_version avant normalisation
-- progressive"). Localization (L10N) and export artifacts are a larger
-- follow-up surface, out of scope for this foundation — versioning,
-- workflow, deployment and assets are the load-bearing pieces the other
-- specs already reference (01's assignment snapshots, 02's session content
-- snapshot, 08's item revisions all follow this same immutable-version shape).

create table public.content_versions (
  id             uuid primary key default gen_random_uuid(),
  content_id     uuid not null references public.content(id) on delete cascade,
  version        integer not null,
  snapshot       jsonb not null,
  schema_version integer not null default 1,
  hash           text not null,
  changelog      text,
  status         text not null default 'draft' check (status in ('draft','in_review','changes_requested','approved','published','deprecated','archived')),
  author_id      uuid not null references auth.users(id) default auth.uid(),
  approved_by    uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  unique (content_id, version)
);
create index content_versions_content_idx on public.content_versions(content_id, version desc);

create table public.content_releases (
  id              uuid primary key default gen_random_uuid(),
  content_id      uuid not null references public.content(id) on delete cascade,
  version         integer not null,
  channel         text not null default 'library' check (channel in ('library','catalog','url','embed','lti','package')),
  release_notes   text,
  published_at    timestamptz not null default now(),
  retired_at      timestamptz,
  foreign key (content_id, version) references public.content_versions(content_id, version)
);
create index content_releases_content_idx on public.content_releases(content_id);

-- CNT-011/013: a deployment pins a version or follows approved updates; a
-- session already begun defaults to staying on its pinned version.
create table public.content_deployments (
  id              uuid primary key default gen_random_uuid(),
  release_id      uuid not null references public.content_releases(id) on delete cascade,
  deployment_type text not null check (deployment_type in ('session','path','public_url','integration')),
  deployment_ref  uuid not null,
  update_policy   text not null default 'pinned' check (update_policy in ('pinned','follow_approved_updates')),
  pinned_version  integer,
  created_at      timestamptz not null default now()
);
create index content_deployments_release_idx on public.content_deployments(release_id);

create table public.review_requests (
  id           uuid primary key default gen_random_uuid(),
  content_id   uuid not null references public.content(id) on delete cascade,
  version      integer not null,
  requested_by uuid not null references auth.users(id) default auth.uid(),
  status       text not null default 'open' check (status in ('open','approved','changes_requested','cancelled')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  foreign key (content_id, version) references public.content_versions(content_id, version)
);
create index review_requests_content_idx on public.review_requests(content_id);

create table public.review_steps (
  id                uuid primary key default gen_random_uuid(),
  review_request_id uuid not null references public.review_requests(id) on delete cascade,
  reviewer_id       uuid not null references auth.users(id) default auth.uid(),
  decision          text not null check (decision in ('approved','changes_requested','comment')),
  note              text,
  created_at        timestamptz not null default now()
);
create index review_steps_request_idx on public.review_steps(review_request_id, created_at);

create table public.content_comments (
  id         uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content(id) on delete cascade,
  target_ref text,
  parent_id  uuid references public.content_comments(id) on delete cascade,
  author_id  uuid not null references auth.users(id) default auth.uid(),
  body       text not null check (char_length(trim(body)) between 1 and 4000),
  resolved   boolean not null default false,
  created_at timestamptz not null default now()
);
create index content_comments_content_idx on public.content_comments(content_id, created_at);

create table public.media_assets (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  owner_id   uuid not null references auth.users(id) default auth.uid(),
  file_name  text not null,
  mime_type  text,
  license    text,
  alt_text   text,
  language   text not null default 'fr',
  created_at timestamptz not null default now()
);
create index media_assets_org_idx on public.media_assets(org_id);

-- CNT-021: replacing an asset creates a version; existing content stays
-- linked to its variant until it explicitly adopts the new one.
create table public.media_asset_versions (
  id           uuid primary key default gen_random_uuid(),
  asset_id     uuid not null references public.media_assets(id) on delete cascade,
  version      integer not null,
  storage_path text not null,
  hash         text not null,
  created_at   timestamptz not null default now(),
  unique (asset_id, version)
);

-- CNT-022: usage search before deletion.
create table public.asset_usages (
  id               uuid primary key default gen_random_uuid(),
  asset_version_id uuid not null references public.media_asset_versions(id) on delete cascade,
  content_id       uuid not null references public.content(id) on delete cascade,
  usage_ref        text,
  created_at       timestamptz not null default now()
);
create index asset_usages_asset_idx on public.asset_usages(asset_version_id);
create index asset_usages_content_idx on public.asset_usages(content_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.content_versions enable row level security;
alter table public.content_releases enable row level security;
alter table public.content_deployments enable row level security;
alter table public.review_requests enable row level security;
alter table public.review_steps enable row level security;
alter table public.content_comments enable row level security;
alter table public.media_assets enable row level security;
alter table public.media_asset_versions enable row level security;
alter table public.asset_usages enable row level security;

create policy content_versions_read on public.content_versions
  for select using (
    exists (select 1 from public.content c where c.id = content_id and (c.user_id = auth.uid() or public.has_org_role(c.org_id, array['trainer','pedago','admin'])))
  );
-- no insert policy: publish_content_version()/restore_content_version() (security definer) are the only writers.

create policy content_releases_read on public.content_releases
  for select using (
    exists (select 1 from public.content c where c.id = content_id and (c.user_id = auth.uid() or public.has_org_role(c.org_id, array['trainer','pedago','admin'])))
  );

create policy content_deployments_read on public.content_deployments
  for select using (
    exists (
      select 1 from public.content_releases r join public.content c on c.id = r.content_id
      where r.id = release_id and (c.user_id = auth.uid() or public.has_org_role(c.org_id, array['pedago','admin']))
    )
  );
create policy content_deployments_manage on public.content_deployments
  for all using (
    exists (
      select 1 from public.content_releases r join public.content c on c.id = r.content_id
      where r.id = release_id and (c.user_id = auth.uid() or public.has_org_role(c.org_id, array['pedago','admin']))
    )
  )
  with check (
    exists (
      select 1 from public.content_releases r join public.content c on c.id = r.content_id
      where r.id = release_id and (c.user_id = auth.uid() or public.has_org_role(c.org_id, array['pedago','admin']))
    )
  );

create policy review_requests_participant on public.review_requests
  for select using (
    requested_by = auth.uid()
    or exists (select 1 from public.content c where c.id = content_id and (c.user_id = auth.uid() or public.has_org_role(c.org_id, array['pedago','admin'])))
  );
create policy review_requests_insert on public.review_requests
  for insert with check (requested_by = auth.uid() and exists (select 1 from public.content c where c.id = content_id and c.user_id = auth.uid()));
create policy review_requests_update on public.review_requests
  for update using (exists (select 1 from public.content c where c.id = content_id and public.has_org_role(c.org_id, array['pedago','admin'])))
  with check (exists (select 1 from public.content c where c.id = content_id and public.has_org_role(c.org_id, array['pedago','admin'])));

create policy review_steps_participant on public.review_steps
  for select using (
    exists (
      select 1 from public.review_requests rr join public.content c on c.id = rr.content_id
      where rr.id = review_request_id and (rr.requested_by = auth.uid() or c.user_id = auth.uid() or public.has_org_role(c.org_id, array['pedago','admin']))
    )
  );
create policy review_steps_insert on public.review_steps
  for insert with check (
    reviewer_id = auth.uid()
    and exists (select 1 from public.review_requests rr join public.content c on c.id = rr.content_id where rr.id = review_request_id and public.has_org_role(c.org_id, array['pedago','admin']))
  );

create policy content_comments_participant on public.content_comments
  for select using (
    exists (select 1 from public.content c where c.id = content_id and (c.user_id = auth.uid() or public.has_org_role(c.org_id, array['trainer','pedago','admin'])))
  );
create policy content_comments_insert on public.content_comments
  for insert with check (
    author_id = auth.uid()
    and exists (select 1 from public.content c where c.id = content_id and (c.user_id = auth.uid() or public.has_org_role(c.org_id, array['trainer','pedago','admin'])))
  );
create policy content_comments_update on public.content_comments
  for update using (author_id = auth.uid() or exists (select 1 from public.content c where c.id = content_id and public.has_org_role(c.org_id, array['pedago','admin'])))
  with check (author_id = auth.uid() or exists (select 1 from public.content c where c.id = content_id and public.has_org_role(c.org_id, array['pedago','admin'])));

create policy media_assets_org on public.media_assets
  for all using (public.has_org_role(org_id, array['trainer','pedago','admin']))
  with check (public.has_org_role(org_id, array['trainer','pedago','admin']));

create policy media_asset_versions_read on public.media_asset_versions
  for select using (exists (select 1 from public.media_assets a where a.id = asset_id and public.has_org_role(a.org_id, array['trainer','pedago','admin'])));
create policy media_asset_versions_manage on public.media_asset_versions
  for insert with check (exists (select 1 from public.media_assets a where a.id = asset_id and public.has_org_role(a.org_id, array['trainer','pedago','admin'])));

create policy asset_usages_read on public.asset_usages
  for select using (exists (select 1 from public.media_asset_versions v join public.media_assets a on a.id = v.asset_id where v.id = asset_version_id and public.has_org_role(a.org_id, array['trainer','pedago','admin'])));

-- ── publish_content_version() : optimistic-concurrency guard (CNT case) ───
-- "Une publication concurrente vérifie la version attendue et refuse
-- l'écrasement" — p_expected_version must match the current max or the
-- call is rejected, not silently overwritten.
create or replace function public.publish_content_version(
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

  insert into public.content_versions (content_id, version, snapshot, hash, changelog, status, approved_by)
  values (p_content_id, v_current_max + 1, p_snapshot, encode(digest(p_snapshot::text, 'sha256'), 'hex'), p_changelog, 'published', auth.uid())
  returning * into v_result;

  perform public.emit_learning_event('content.published', v_content.org_id, auth.uid(), 'content', p_content_id, jsonb_build_object('version', v_result.version));

  return v_result;
end;
$$;

revoke all on function public.publish_content_version(uuid, integer, jsonb, text) from public;
grant execute on function public.publish_content_version(uuid, integer, jsonb, text) to authenticated;

-- ── restore_content_version() : always a new version, never a mutation ────
create or replace function public.restore_content_version(p_content_id uuid, p_from_version integer)
returns public.content_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.content_versions;
  v_current_max integer;
  v_result public.content_versions;
  v_org_id uuid;
  v_owner uuid;
begin
  select user_id, org_id into v_owner, v_org_id from public.content where id = p_content_id;
  if v_owner is null then
    raise exception 'Content not found';
  end if;
  if v_owner <> auth.uid() and not public.has_org_role(v_org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  select * into v_source from public.content_versions where content_id = p_content_id and version = p_from_version;
  if v_source.id is null then
    raise exception 'Version not found';
  end if;

  select max(version) into v_current_max from public.content_versions where content_id = p_content_id;

  insert into public.content_versions (content_id, version, snapshot, schema_version, hash, changelog, status, approved_by)
  values (p_content_id, v_current_max + 1, v_source.snapshot, v_source.schema_version, v_source.hash, format('Restored from v%s', p_from_version), 'published', auth.uid())
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.restore_content_version(uuid, integer) from public;
grant execute on function public.restore_content_version(uuid, integer) to authenticated;
