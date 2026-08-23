-- Spec 10 — Gouvernance, versionnement, localisation et diffusion du contenu
-- (docs/product-specs/2026-08-10-lms-program/10-content-governance.md).
-- CNT-019: "Brand kits : couleurs, polices autorisées, logo, composants et
-- règles d'accessibilité, avec prévisualisation." Not in the indicative
-- model list at all before this migration — the smallest, most
-- self-contained of §10's remaining items: one table, no cross-system
-- wiring, no existing consumer to reconcile with (unlike content_deployments
-- or media asset usages, which had to be threaded through a pre-existing
-- system).
--
-- Reuses media_assets for the logo (org-scoped, versioned, already gated by
-- the deletion guard from 20260823030000) rather than a bare storage path —
-- a brand kit's logo replacing itself is exactly CNT-021's "replacing an
-- asset creates a version" case, no reason to duplicate that here.
--
-- "Composants" (component_rules) and "règles d'accessibilité"
-- (accessibility_rules) are free-form jsonb, not a fixed schema — the spec
-- names no concrete fields for either, and this codebase's builders don't
-- share a component system to enumerate rules against (same reasoning as
-- content_templates below: nothing to bind a fixed shape to yet).
--
-- "Prévisualisation" is a pure client-side render of the stored
-- colors/fonts/logo — no server piece.
--
-- No wiring to a rendering surface: nothing in this codebase currently
-- reads a brand kit to theme rendered content — that would need a
-- consumer (a themeable builder) that doesn't exist yet, same posture as
-- content_deployments' 'path'/'public_url'/'integration' types having no
-- consumer to sync. The data model and CRUD are real; applying a kit to
-- actual output is not guessed at here.
create table public.brand_kits (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references public.organizations(id) on delete cascade,
  name                 text not null check (char_length(trim(name)) between 1 and 120),
  colors               jsonb not null default '[]'::jsonb,
  fonts                jsonb not null default '[]'::jsonb,
  logo_asset_id        uuid references public.media_assets(id) on delete set null,
  component_rules      jsonb not null default '{}'::jsonb,
  accessibility_rules  jsonb not null default '{}'::jsonb,
  is_default           boolean not null default false,
  created_by           uuid not null references auth.users(id) default auth.uid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index brand_kits_org_idx on public.brand_kits(org_id);
create trigger brand_kits_touch before update on public.brand_kits
  for each row execute function public.touch_updated_at();

-- Only one default kit per org — "prévisualisation" and any future
-- consumer both need an unambiguous starting point, not a client-side
-- pick-the-first-one convention.
create unique index brand_kits_one_default_per_org on public.brand_kits(org_id) where is_default;

alter table public.brand_kits enable row level security;

-- Read: trainer/pedago/admin (same as media_assets — a brand kit is a
-- shared org resource authors need to see, e.g. to know allowed fonts).
create policy brand_kits_read on public.brand_kits
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));
-- Write: pedago/admin only — same posture as delete_media_asset(), brand
-- identity is not something every trainer should be able to redefine.
create policy brand_kits_write on public.brand_kits
  for all using (public.has_org_role(org_id, array['pedago','admin']))
  with check (public.has_org_role(org_id, array['pedago','admin']));

-- set_default_brand_kit(): flips is_default atomically (clear the old
-- default, set the new one) — a naive two-statement client-side toggle
-- would trip the unique partial index on the "both true" instant between
-- them under RLS's read-committed default; this does it in one statement.
create or replace function public.set_default_brand_kit(p_kit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from public.brand_kits where id = p_kit_id;
  if v_org_id is null then
    raise exception 'Brand kit not found';
  end if;
  if not public.has_org_role(v_org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  update public.brand_kits set is_default = (id = p_kit_id) where org_id = v_org_id and (is_default or id = p_kit_id);
end;
$$;
revoke all on function public.set_default_brand_kit(uuid) from public;
grant execute on function public.set_default_brand_kit(uuid) to authenticated;
