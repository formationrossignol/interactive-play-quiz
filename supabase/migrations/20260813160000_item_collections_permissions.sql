-- Spec 08 — Évaluations avancées et banque d'items versionnée.
--
-- ASM-004: collections personnelles/organisationnelles/partagées avec
-- droits voir/utiliser/commenter/modifier. `item_collections`/
-- `item_collection_members`/`item_permissions` were posed since
-- 20260810220000 with zero frontend usage (confirmed by grep) AND their
-- own read RLS never actually consulted `item_permissions` — any
-- trainer/pedago/admin in the org could read any collection regardless of
-- what (if anything) `item_permissions` granted them, and a grantee
-- couldn't even see their own grant row (item_permissions had no select
-- policy at all, only the owner/admin-scoped "manage" for-all). This
-- migration is what makes the grant table do real work for the first
-- time, on top of adding its first UI.
--
-- has_item_permission() mirrors has_org_role()'s shape exactly (same
-- exists(...) pattern, callable from RLS and from RPCs alike) so
-- permission checks read the same way everywhere else in this codebase.
create or replace function public.has_item_permission(p_collection_id uuid, p_levels text[])
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.item_permissions
    where collection_id = p_collection_id and user_id = auth.uid() and permission = any(p_levels)
  );
$$;

-- A grantee needs to see their own grant to know what they were given —
-- item_permissions_manage (for all, owner/pedago/admin only) never covered
-- this; policies OR together so this is additive, not a replacement.
create policy item_permissions_self_read on public.item_permissions
  for select using (user_id = auth.uid());

-- item_collections_read / item_collection_members_read: widen from
-- "any org staff" to "org staff OR someone with any explicit grant on this
-- collection" — the visibility a permission level implies (view/use/
-- comment/edit) matters more than blanket org-role scope for a *personal*
-- or *shared* collection (visibility='private'/'shared'), which is the
-- whole reason ASM-004 asks for per-collection grants in the first place.
-- 'org'-visibility collections stay readable to any staff regardless of
-- explicit grants (that's what "organisationnelles" means).
drop policy if exists item_collections_read on public.item_collections;
create policy item_collections_read on public.item_collections
  for select using (
    owner_id = auth.uid()
    or (visibility = 'org' and public.has_org_role(org_id, array['trainer', 'pedago', 'admin']))
    or public.has_item_permission(id, array['view', 'use', 'comment', 'edit'])
    or public.has_org_role(org_id, array['pedago', 'admin'])
  );

drop policy if exists item_collection_members_read on public.item_collection_members;
create policy item_collection_members_read on public.item_collection_members
  for select using (
    exists (
      select 1 from public.item_collections c
      where c.id = collection_id
        and (
          c.owner_id = auth.uid()
          or (c.visibility = 'org' and public.has_org_role(c.org_id, array['trainer', 'pedago', 'admin']))
          or public.has_item_permission(c.id, array['view', 'use', 'comment', 'edit'])
          or public.has_org_role(c.org_id, array['pedago', 'admin'])
        )
    )
  );
