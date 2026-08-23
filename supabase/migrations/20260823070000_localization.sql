-- Spec 10 — Gouvernance, versionnement, localisation et diffusion du contenu
-- (docs/product-specs/2026-08-10-lms-program/10-content-governance.md).
-- L10N-001 to 005 — the last item of §10, absent from the shipped model
-- entirely. L10N-006 (AI translation) is explicitly "facultative" in the
-- spec's own text and is not built here, same posture this program has
-- already taken for other optional AI-assist items (spec 08's item
-- generation/distractor suggestions).
--
-- L10N-002's real challenge ("extraction structurée des segments, sans
-- casser variables, formules, réponses ou mise en forme") is a generic
-- extraction problem across builder types this program has repeatedly
-- declined to guess a fixed schema for (content diffing above, block
-- content, template data). The extraction/reapplication engine
-- (localization.ts, client-side) is an *allowlist* of common text-bearing
-- key names (title/text/content/description/…), not a denylist — a
-- conservative choice: an unknown technical field is left untouched rather
-- than risking mistranslation of an id/type/scoring key, at the cost of
-- possibly missing a real text field this codebase's builders haven't
-- named consistently. This migration only carries the storage/workflow;
-- the extraction itself is pure TypeScript, not SQL.
--
-- L10N-004 ("diff de source identifie les segments obsolètes sans effacer
-- la traduction existante") is the correctness-critical guarantee here:
-- sync_translation_segments() marks a changed segment 'stale' but never
-- touches translated_text — re-syncing after a source edit can only ever
-- ADD segments or flag existing ones stale, never silently discard a
-- translator's work.

create table public.localization_sets (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  source_content_id uuid not null references public.content(id) on delete cascade,
  source_language   text not null default 'fr',
  created_by        uuid not null references auth.users(id) default auth.uid(),
  created_at        timestamptz not null default now(),
  unique (source_content_id)
);

create table public.localized_versions (
  id                  uuid primary key default gen_random_uuid(),
  localization_set_id uuid not null references public.localization_sets(id) on delete cascade,
  language            text not null,
  status              text not null default 'not_started' check (status in ('not_started','translating','validation','needs_resync','published')),
  source_version      integer not null,
  created_by          uuid not null references auth.users(id) default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (localization_set_id, language)
);
create trigger localized_versions_touch before update on public.localized_versions
  for each row execute function public.touch_updated_at();

create table public.translation_segments (
  id                  uuid primary key default gen_random_uuid(),
  localized_version_id uuid not null references public.localized_versions(id) on delete cascade,
  path                text not null,
  source_text         text not null,
  translated_text     text,
  status              text not null default 'pending' check (status in ('pending','translated','stale')),
  updated_at          timestamptz not null default now(),
  unique (localized_version_id, path)
);
create index translation_segments_version_idx on public.translation_segments(localized_version_id);

create table public.glossaries (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  term         text not null,
  translations jsonb not null default '{}'::jsonb,
  note         text,
  created_by   uuid not null references auth.users(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  unique (org_id, term)
);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.localization_sets enable row level security;
alter table public.localized_versions enable row level security;
alter table public.translation_segments enable row level security;
alter table public.glossaries enable row level security;

create policy localization_sets_read on public.localization_sets
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));
create policy localization_sets_manage on public.localization_sets
  for insert with check (public.has_org_role(org_id, array['trainer','pedago','admin']));

create policy localized_versions_read on public.localized_versions
  for select using (exists (select 1 from public.localization_sets s where s.id = localization_set_id and public.has_org_role(s.org_id, array['trainer','pedago','admin'])));
create policy localized_versions_insert on public.localized_versions
  for insert with check (exists (select 1 from public.localization_sets s where s.id = localization_set_id and public.has_org_role(s.org_id, array['trainer','pedago','admin'])));
create policy localized_versions_update on public.localized_versions
  for update using (exists (select 1 from public.localization_sets s where s.id = localization_set_id and public.has_org_role(s.org_id, array['trainer','pedago','admin'])))
  with check (exists (select 1 from public.localization_sets s where s.id = localization_set_id and public.has_org_role(s.org_id, array['trainer','pedago','admin'])));

create policy translation_segments_read on public.translation_segments
  for select using (
    exists (select 1 from public.localized_versions v join public.localization_sets s on s.id = v.localization_set_id where v.id = localized_version_id and public.has_org_role(s.org_id, array['trainer','pedago','admin']))
  );
-- A translator directly edits translated_text/status — plain RLS write,
-- no invariant beyond org scope needs a function.
create policy translation_segments_update on public.translation_segments
  for update using (
    exists (select 1 from public.localized_versions v join public.localization_sets s on s.id = v.localization_set_id where v.id = localized_version_id and public.has_org_role(s.org_id, array['trainer','pedago','admin']))
  )
  with check (
    exists (select 1 from public.localized_versions v join public.localization_sets s on s.id = v.localization_set_id where v.id = localized_version_id and public.has_org_role(s.org_id, array['trainer','pedago','admin']))
  );
-- No insert/delete policy: sync_translation_segments() (below) is the only
-- writer of new rows — the extraction/reconciliation logic (L10N-004's
-- "never erase" guarantee) can't be replicated by a direct client insert.

create policy glossaries_read on public.glossaries
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));
create policy glossaries_manage on public.glossaries
  for all using (public.has_org_role(org_id, array['pedago','admin']))
  with check (public.has_org_role(org_id, array['pedago','admin']));

-- ── create_localization_set() : L10N-001, one family per content item ────
create or replace function public.create_localization_set(p_content_id uuid, p_source_language text default 'fr')
returns public.localization_sets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content public.content;
  v_result public.localization_sets;
begin
  select * into v_content from public.content where id = p_content_id;
  if v_content.id is null then
    raise exception 'Content not found';
  end if;
  if not public.has_org_role(v_content.org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  insert into public.localization_sets (org_id, source_content_id, source_language)
  values (v_content.org_id, p_content_id, p_source_language)
  returning * into v_result;

  return v_result;
end;
$$;
revoke all on function public.create_localization_set(uuid, text) from public;
grant execute on function public.create_localization_set(uuid, text) to authenticated;

create or replace function public.add_localized_version(p_localization_set_id uuid, p_language text, p_source_version integer)
returns public.localized_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_result public.localized_versions;
begin
  select org_id into v_org_id from public.localization_sets where id = p_localization_set_id;
  if v_org_id is null then
    raise exception 'Localization set not found';
  end if;
  if not public.has_org_role(v_org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  insert into public.localized_versions (localization_set_id, language, source_version)
  values (p_localization_set_id, p_language, p_source_version)
  returning * into v_result;

  return v_result;
end;
$$;
revoke all on function public.add_localized_version(uuid, text, integer) from public;
grant execute on function public.add_localized_version(uuid, text, integer) to authenticated;

-- ── sync_translation_segments() : L10N-002/004, the extraction reconciler ──
-- p_segments is [{path, source_text}] from the client's extraction pass
-- (localization.ts) against a specific content_versions.snapshot. For each:
--   - new path -> insert, status 'pending'
--   - existing path, source_text unchanged -> untouched (translated_text intact)
--   - existing path, source_text changed -> status set to 'stale',
--     translated_text left exactly as it was (never cleared)
-- Paths that no longer appear in the new extraction are left in place
-- (orphaned, not deleted) — a removed source segment's prior translation
-- is still evidence of past work, not something this function judges safe
-- to discard.
create or replace function public.sync_translation_segments(p_localized_version_id uuid, p_segments jsonb, p_new_source_version integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_seg jsonb;
  v_inserted integer := 0;
  v_staled integer := 0;
  v_unchanged integer := 0;
begin
  select s.org_id into v_org_id
  from public.localized_versions v join public.localization_sets s on s.id = v.localization_set_id
  where v.id = p_localized_version_id;
  if v_org_id is null then
    raise exception 'Localized version not found';
  end if;
  if not public.has_org_role(v_org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  for v_seg in select * from jsonb_array_elements(p_segments)
  loop
    if exists (select 1 from public.translation_segments where localized_version_id = p_localized_version_id and path = v_seg->>'path') then
      if exists (
        select 1 from public.translation_segments
        where localized_version_id = p_localized_version_id and path = v_seg->>'path' and source_text = v_seg->>'source_text'
      ) then
        v_unchanged := v_unchanged + 1;
      else
        update public.translation_segments
        set source_text = v_seg->>'source_text', status = 'stale', updated_at = now()
        where localized_version_id = p_localized_version_id and path = v_seg->>'path';
        v_staled := v_staled + 1;
      end if;
    else
      insert into public.translation_segments (localized_version_id, path, source_text, status)
      values (p_localized_version_id, v_seg->>'path', v_seg->>'source_text', 'pending');
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  update public.localized_versions
  set source_version = p_new_source_version,
      status = case when v_staled > 0 and status = 'published' then 'needs_resync' else status end
  where id = p_localized_version_id;

  return jsonb_build_object('inserted', v_inserted, 'staled', v_staled, 'unchanged', v_unchanged);
end;
$$;
revoke all on function public.sync_translation_segments(uuid, jsonb, integer) from public;
grant execute on function public.sync_translation_segments(uuid, jsonb, integer) to authenticated;
