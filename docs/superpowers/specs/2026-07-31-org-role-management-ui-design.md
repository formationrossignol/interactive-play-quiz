# Org role management UI — design spec

Date: 2026-07-31
Status: approved (design), not yet planned/implemented

## Context

[[2026-07-29-org-rbac-foundation-design]] built the backend for multi-tenant
orgs + cumulative role model (`organizations`, `user_org_roles`,
`org_invitations`, RPCs `create_organization` / `accept_org_invitation` /
`list_org_members` / `admin_grant_org_role` / `admin_revoke_org_role` /
`admin_remove_org_member`). **Correction after codebase inspection:** the org-
admin-facing UI was not actually left undone — `apps/app/src/pages/OrgInvitations.tsx`
(route `/org/invitations`) already ships a `MemberRoster` component that lists
members, grants/revokes individual roles (cumulative, multi-badge), removes a
member, and a full invite-by-email-with-role form, all wired to the RPCs
above with the same FR role labels used below. **That part of this spec is
already built — no changes needed.**

The real gap is narrower: (1) no per-org guest-access setting exists, and (2)
no site super-admin cross-org view exists (`Admin.tsx` has Content/Moderation/
Subscribers/Settings tabs only, nothing org-related). This spec now covers
only those two additions.

Role labels (from the foundation spec's original 5-persona ask): learner =
Apprenant, trainer = Formateur, pedago = Responsable pédagogique, registrar =
Gestionnaire de scolarité, admin = Administrateur d'établissement.

Two role systems remain independent, per the foundation spec: `profiles.role`
(`user`/`admin`, gates the site-wide `/admin` CMS panel) is untouched;
this feature is entirely about `user_org_roles`.

## Goals

- ~~Org admin member/role management~~ — **already shipped**, see Context.
- Site super-admin (`profiles.role = 'admin'`) gets a **read-only** cross-org
  view: list of all organizations (name, member count, guest-access status),
  drill-down into any org's member roster.
- Per-organization toggle: "guest access" — allow anonymous/no-account
  participation (join quiz/exam without login) for that org's content.
  Settable by that org's admin/pedago (in `OrgInvitations.tsx`), or by the
  site super-admin (in the new `Admin.tsx` tab).

## Non-goals

- No new `OrgRole` value for "guest" — guest access is a settings flag on
  `organizations`, not a role in `user_org_roles`.
- Site super-admin cannot grant/revoke roles or remove members in orgs they
  don't belong to — read-only cross-org, consistent with keeping the
  blast radius of `profiles.role = 'admin'` small.
- No per-content (per-quiz/exam) override of guest access — org-level only.
- No changes to `admin_grant_org_role` / `admin_revoke_org_role` /
  `admin_remove_org_member` semantics — still org-scoped, still enforce
  "can't remove the last admin".
- Scolarité domain, pédago reporting dashboards, SSO/SCIM — still out of
  scope (per foundation spec).

## Data model changes

```sql
-- new column
alter table public.organizations
  add column guest_access_enabled boolean not null default false;

-- new RPC: organizations has no client write RLS by design (see
-- organizations_member_read comment in 20260730120000) — every write goes
-- through a SECURITY DEFINER function, same as create_organization().
create or replace function public.update_org_guest_access(p_org_id uuid, p_enabled boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not (public.has_org_role(p_org_id, array['admin','pedago']) or public.is_admin()) then
    raise exception 'Not authorized';
  end if;
  update public.organizations set guest_access_enabled = p_enabled where id = p_org_id;
end; $$;

revoke all on function public.update_org_guest_access(uuid, boolean) from public;
grant execute on function public.update_org_guest_access(uuid, boolean) to authenticated;

-- new RPC: site super-admin cross-org read (RLS on organizations/user_org_roles
-- is member-scoped, so a super-admin who isn't a member of every org needs this)
create or replace function public.admin_list_all_orgs()
returns table(id uuid, name text, slug text, member_count bigint,
              guest_access_enabled boolean, created_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  return query
    select o.id, o.name, o.slug, count(r.id), o.guest_access_enabled, o.created_at
    from organizations o left join user_org_roles r on r.org_id = o.id
    group by o.id;
end; $$;

-- existing list_org_members() check loosened from
--   has_org_role(p_org_id, array['admin'])
-- to
--   has_org_role(p_org_id, array['admin']) or is_admin()
-- so the super-admin drill-down can reuse it read-only.
```

## Frontend

`apps/app/src/lib/org/orgRepo.ts` additions:
- `fetchOrgSettings(orgId)` / `updateGuestAccess(orgId, enabled)`
- `adminListAllOrgs()` — wraps `admin_list_all_orgs`

`apps/app/src/pages/OrgInvitations.tsx` (existing page, small addition):
- Guest-access `Switch` added to the page header (next to `PageHeader`),
  visible when `isOrgAdmin` (reuse the existing `managedOrgId`/`isOrgAdmin`
  computation already in the component).
- No other change — `MemberRoster` and the invite form are untouched.

`apps/app/src/pages/admin/OrganizationsTab.tsx` (new tab in `Admin.tsx`,
alongside `ModerationTab`/`SubscribersTab`):
- Table: org name, member count, guest access (read-only badge), created date.
- Row → drill-down showing that org's members read-only (email, username,
  role badges — no action buttons), fed by `list_org_members`. Reuses the
  same `roleOptions`/`roleLabel` pattern already defined in
  `OrgInvitations.tsx` (promote that map to a shared
  `apps/app/src/lib/org/roleLabels.ts` so both files import it instead of
  duplicating the array).
- `TableSkeleton` while loading.

## Error handling & edge cases

- Guest-access write blocked by RLS for a non-admin/pedago caller → generic
  "not authorized" toast (mirrors `showError` pattern already used in
  `OrgInvitations.tsx`).
- `admin_list_all_orgs` / loosened `list_org_members` both raise if the
  caller isn't `is_admin()` — defense in depth under the page-level
  `useIsAdmin()` gate already used by `Admin.tsx`.
- Org member/role edge cases (`last_admin`, self-demotion, duplicate
  invitations) are pre-existing `MemberRoster` behavior in
  `OrgInvitations.tsx`, untouched by this spec.

## Decision log

| Decision | Alternatives considered | Why |
|---|---|---|
| Reuse `OrgInvitations.tsx` for the guest-access toggle instead of a new page | New `/org/:orgId/members` page | Discovered mid-plan that member/role management already lives there — a new page would duplicate `MemberRoster` |
| Guest access = boolean column on `organizations` | New `guest` value in `OrgRole` | Confirmed as a setting, not a role; keeps `user_org_roles` clean, simpler RLS |
| Super-admin cross-org access is read-only | Full grant/revoke/remove cross-org | Confirmed; smaller RLS surface, smaller blast radius for `profiles.role='admin'` |
| New `admin_list_all_orgs` RPC + loosened `list_org_members` check | Give super-admin real `user_org_roles` rows in every org | Avoids polluting the RBAC table with synthetic memberships just for read access |
| Promote `roleOptions`/`roleLabel` out of `OrgInvitations.tsx` into a shared module | Duplicate the array in `OrganizationsTab.tsx` | DRY — two files would otherwise need to stay in sync on the 5 FR role labels |

## Assumptions

- UI lives under `apps/app/src/pages`, skeleton-loading convention
  (`TableSkeleton`) applies to all loading states per project CLAUDE.md.
- "Registraire"/"Gestionnaire de scolarité" label reused verbatim from the
  foundation spec rather than re-litigated.
