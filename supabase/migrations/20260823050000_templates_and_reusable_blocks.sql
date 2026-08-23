-- Spec 10 — Gouvernance, versionnement, localisation et diffusion du contenu
-- (docs/product-specs/2026-08-10-lms-program/10-content-governance.md).
-- CNT-016/017/018: absent from the shipped model entirely — no
-- content_templates/reusable_blocks/reusable_block_versions table existed
-- before this migration.
--
-- Two distinct concepts, one migration because they share the same
-- library/versioning shape:
--   - content_templates (CNT-016): a full starter `content` payload an
--     author picks to seed a *new* content item. instantiate_content_template()
--     is a real, wired consumer — it inserts into `content` directly, unlike
--     brand kits (no themeable surface to apply to) or content_deployments'
--     non-session types (no consumer table).
--   - reusable_blocks/reusable_block_versions (CNT-017): a smaller fragment
--     (a lesson or slide block) inserted into content in 'copy' or 'link'
--     mode. Copy is a one-time duplication with nothing left to track —
--     only 'link' usages are recorded (block_usages, mirrors asset_usages).
--
-- CNT-018 ("un bloc lié signale les mises à jour ; l'adoption n'est jamais
-- silencieuse pour un contenu publié") is scoped honestly: block_usages
-- tracks which version a usage is *adopted at*, check_block_update()/
-- adopt_block_update() mirror check_content_deployment_update()/
-- adopt_content_deployment_update() exactly (20260823020000) — but unlike
-- that migration, adopt_block_update() does NOT rewrite the consuming
-- content's data. A linked block's JSON lives inside content.data at a
-- path only that content's own builder knows (a lesson's block list isn't
-- shaped like a slide deck's) — mutating it generically here would be
-- exactly the mistake this program has already made and walked back for
-- competency tag migration (spec 03) and content diffing (this same spec,
-- above). adopt_block_update() records that the author has deliberately
-- moved to a newer version (the "never silent" part, real and enforced);
-- actually re-copying the new content into the builder is the author's own
-- action, not guessed at here.
create table public.content_templates (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  type         text not null check (type in ('quiz','poll','flashcard','exam','course','slide')),
  name         text not null check (char_length(trim(name)) between 1 and 160),
  tags         text[] not null default '{}',
  data         jsonb not null default '{}'::jsonb,
  preview_asset_id uuid references public.media_assets(id) on delete set null,
  status       text not null default 'draft' check (status in ('draft','published','archived')),
  version      integer not null default 1,
  owner_id     uuid not null references auth.users(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index content_templates_org_idx on public.content_templates(org_id, type);

-- Auto-bumped, not client-settable: a template's version is a signal that
-- its data actually changed, not a number an editor can fabricate.
create or replace function public._bump_content_template_version()
returns trigger
language plpgsql
as $$
begin
  if new.data is distinct from old.data then
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger content_templates_bump_version
  before update on public.content_templates
  for each row execute function public._bump_content_template_version();

alter table public.content_templates enable row level security;
create policy content_templates_read on public.content_templates
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));
create policy content_templates_insert on public.content_templates
  for insert with check (public.has_org_role(org_id, array['trainer','pedago','admin']));
create policy content_templates_update on public.content_templates
  for update using (owner_id = auth.uid() or public.has_org_role(org_id, array['pedago','admin']))
  with check (owner_id = auth.uid() or public.has_org_role(org_id, array['pedago','admin']));
create policy content_templates_delete on public.content_templates
  for delete using (owner_id = auth.uid() or public.has_org_role(org_id, array['pedago','admin']));

-- ── instantiate_content_template() : the real, wired consumer ─────────────
create or replace function public.instantiate_content_template(p_template_id uuid, p_title text default null)
returns public.content
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template public.content_templates;
  v_result public.content;
  v_data jsonb;
begin
  select * into v_template from public.content_templates where id = p_template_id;
  if v_template.id is null then
    raise exception 'Template not found';
  end if;
  if not public.has_org_role(v_template.org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  v_data := v_template.data;
  if p_title is not null then
    v_data := v_data || jsonb_build_object('title', p_title);
  end if;

  insert into public.content (user_id, org_id, type, data)
  values (auth.uid(), v_template.org_id, v_template.type, v_data)
  returning * into v_result;

  return v_result;
end;
$$;
revoke all on function public.instantiate_content_template(uuid, text) from public;
grant execute on function public.instantiate_content_template(uuid, text) to authenticated;

-- ── reusable_blocks / reusable_block_versions (CNT-017) ────────────────────
create table public.reusable_blocks (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  type       text not null check (type in ('lesson','slide')),
  name       text not null check (char_length(trim(name)) between 1 and 160),
  owner_id   uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index reusable_blocks_org_idx on public.reusable_blocks(org_id, type);

create table public.reusable_block_versions (
  id         uuid primary key default gen_random_uuid(),
  block_id   uuid not null references public.reusable_blocks(id) on delete cascade,
  version    integer not null,
  content    jsonb not null,
  created_at timestamptz not null default now(),
  unique (block_id, version)
);

-- Same race-safe pattern as media_asset_versions (20260823030000): lock the
-- parent, then compute next version — never a client-computed max()+1.
create or replace function public._set_reusable_block_version_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  perform 1 from public.reusable_blocks where id = new.block_id for update;
  select coalesce(max(version), 0) + 1 into v_next from public.reusable_block_versions where block_id = new.block_id;
  new.version := v_next;
  return new;
end;
$$;
create trigger reusable_block_versions_set_version
  before insert on public.reusable_block_versions
  for each row execute function public._set_reusable_block_version_number();

create table public.block_usages (
  id                uuid primary key default gen_random_uuid(),
  block_version_id  uuid not null references public.reusable_block_versions(id) on delete cascade,
  content_id        uuid not null references public.content(id) on delete cascade,
  usage_ref         text,
  adopted_version   integer not null,
  created_at        timestamptz not null default now()
);
create index block_usages_version_idx on public.block_usages(block_version_id);
create index block_usages_content_idx on public.block_usages(content_id);

alter table public.reusable_blocks enable row level security;
alter table public.reusable_block_versions enable row level security;
alter table public.block_usages enable row level security;

-- Same lesson as media_assets (20260823030000): read/insert/update open to
-- trainer/pedago/admin, no delete policy at all — delete_reusable_block()
-- below is the only path, and it checks block_usages first.
create policy reusable_blocks_read on public.reusable_blocks
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));
create policy reusable_blocks_insert on public.reusable_blocks
  for insert with check (public.has_org_role(org_id, array['trainer','pedago','admin']));
create policy reusable_blocks_update on public.reusable_blocks
  for update using (public.has_org_role(org_id, array['trainer','pedago','admin']))
  with check (public.has_org_role(org_id, array['trainer','pedago','admin']));

create policy reusable_block_versions_read on public.reusable_block_versions
  for select using (exists (select 1 from public.reusable_blocks b where b.id = block_id and public.has_org_role(b.org_id, array['trainer','pedago','admin'])));
create policy reusable_block_versions_insert on public.reusable_block_versions
  for insert with check (exists (select 1 from public.reusable_blocks b where b.id = block_id and public.has_org_role(b.org_id, array['trainer','pedago','admin'])));

create policy block_usages_read on public.block_usages
  for select using (
    exists (select 1 from public.reusable_block_versions v join public.reusable_blocks b on b.id = v.block_id where v.id = block_version_id and public.has_org_role(b.org_id, array['trainer','pedago','admin']))
  );
-- No insert/delete policy: record_block_usage()/remove_block_usage() (below) are the only writers.

create or replace function public.check_block_deletable(p_block_id uuid)
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
  select org_id into v_org_id from public.reusable_blocks where id = p_block_id;
  if v_org_id is null then
    raise exception 'Block not found';
  end if;
  if not public.has_org_role(v_org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('content_id', u.content_id, 'usage_ref', u.usage_ref)), '[]'::jsonb)
  into v_usages
  from public.block_usages u
  join public.reusable_block_versions v on v.id = u.block_version_id
  where v.block_id = p_block_id;

  return jsonb_build_object('deletable', jsonb_array_length(v_usages) = 0, 'blocking_usages', v_usages);
end;
$$;
revoke all on function public.check_block_deletable(uuid) from public;
grant execute on function public.check_block_deletable(uuid) to authenticated;

-- pedago/admin only, same reasoning as delete_media_asset(): a shared org
-- block can be linked from content the deleting trainer has no visibility into.
create or replace function public.delete_reusable_block(p_block_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_usage_count integer;
begin
  select org_id into v_org_id from public.reusable_blocks where id = p_block_id for update;
  if v_org_id is null then
    raise exception 'Block not found';
  end if;
  if not public.has_org_role(v_org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  select count(*) into v_usage_count
  from public.block_usages u join public.reusable_block_versions v on v.id = u.block_version_id
  where v.block_id = p_block_id;
  if v_usage_count > 0 then
    raise exception 'Block is in use — remove its % usage(s) first', v_usage_count;
  end if;

  delete from public.reusable_blocks where id = p_block_id;
end;
$$;
revoke all on function public.delete_reusable_block(uuid) from public;
grant execute on function public.delete_reusable_block(uuid) to authenticated;

-- ── link usage (CNT-017's "mode lien") ──────────────────────────────────
create or replace function public.record_block_usage(p_block_version_id uuid, p_content_id uuid, p_usage_ref text default null)
returns public.block_usages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_block_org uuid;
  v_block_version integer;
  v_content public.content;
  v_result public.block_usages;
begin
  select b.org_id, v.version into v_block_org, v_block_version
  from public.reusable_block_versions v join public.reusable_blocks b on b.id = v.block_id
  where v.id = p_block_version_id;
  if v_block_org is null then
    raise exception 'Block version not found';
  end if;
  select * into v_content from public.content where id = p_content_id;
  if v_content.id is null then
    raise exception 'Content not found';
  end if;
  if v_content.org_id <> v_block_org then
    raise exception 'Block and content belong to different organizations';
  end if;
  if v_content.user_id <> auth.uid() and not public.has_org_role(v_content.org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  insert into public.block_usages (block_version_id, content_id, usage_ref, adopted_version)
  values (p_block_version_id, p_content_id, p_usage_ref, v_block_version)
  returning * into v_result;

  return v_result;
end;
$$;
revoke all on function public.record_block_usage(uuid, uuid, text) from public;
grant execute on function public.record_block_usage(uuid, uuid, text) to authenticated;

create or replace function public.remove_block_usage(p_usage_id uuid)
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
  from public.block_usages u join public.content c on c.id = u.content_id
  where u.id = p_usage_id;
  if v_content_org is null then
    raise exception 'Usage not found';
  end if;
  if v_content_user <> auth.uid() and not public.has_org_role(v_content_org, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  delete from public.block_usages where id = p_usage_id;
end;
$$;
revoke all on function public.remove_block_usage(uuid) from public;
grant execute on function public.remove_block_usage(uuid) to authenticated;

-- ── CNT-018: check + explicit, recorded adoption ────────────────────────
create or replace function public.check_block_update(p_usage_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_usage public.block_usages;
  v_block_id uuid;
  v_org_id uuid;
  v_latest integer;
begin
  select u.* into v_usage from public.block_usages u where u.id = p_usage_id;
  if v_usage.id is null then
    raise exception 'Usage not found';
  end if;

  select v.block_id, b.org_id into v_block_id, v_org_id
  from public.reusable_block_versions v join public.reusable_blocks b on b.id = v.block_id
  where v.id = v_usage.block_version_id;
  if not public.has_org_role(v_org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  select max(version) into v_latest from public.reusable_block_versions where block_id = v_block_id;

  return jsonb_build_object(
    'usage_id', p_usage_id,
    'block_id', v_block_id,
    'adopted_version', v_usage.adopted_version,
    'latest_version', v_latest,
    'has_update', v_latest is not null and v_latest <> v_usage.adopted_version
  );
end;
$$;
revoke all on function public.check_block_update(uuid) from public;
grant execute on function public.check_block_update(uuid) to authenticated;

-- Records that the author has explicitly moved to a newer version — the
-- "never silent" guarantee (real, enforced: this is the only writer of
-- adopted_version, and it only ever runs on an explicit call). Does NOT
-- rewrite the consuming content's own data — see file header.
create or replace function public.adopt_block_update(p_usage_id uuid, p_to_version integer)
returns public.block_usages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage public.block_usages;
  v_block_id uuid;
  v_content_org uuid;
  v_content_user uuid;
  v_result public.block_usages;
begin
  select u.* into v_usage from public.block_usages u where u.id = p_usage_id for update;
  if v_usage.id is null then
    raise exception 'Usage not found';
  end if;
  select v.block_id into v_block_id from public.reusable_block_versions v where v.id = v_usage.block_version_id;
  select c.org_id, c.user_id into v_content_org, v_content_user from public.content c where c.id = v_usage.content_id;
  if v_content_user <> auth.uid() and not public.has_org_role(v_content_org, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  if not exists (select 1 from public.reusable_block_versions where block_id = v_block_id and version = p_to_version) then
    raise exception 'Target version does not exist for this block';
  end if;

  update public.block_usages set adopted_version = p_to_version where id = p_usage_id returning * into v_result;
  return v_result;
end;
$$;
revoke all on function public.adopt_block_update(uuid, integer) from public;
grant execute on function public.adopt_block_update(uuid, integer) to authenticated;
