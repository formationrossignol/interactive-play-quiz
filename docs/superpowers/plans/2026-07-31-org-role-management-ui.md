# Org role management UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-organization "guest access" toggle and a read-only site super-admin cross-org organizations view. Org-admin member/role management (grant/revoke/remove/invite) already exists in `apps/app/src/pages/OrgInvitations.tsx` and is not touched by this plan.

**Architecture:** One migration adds `organizations.guest_access_enabled` plus two SECURITY DEFINER RPCs (`update_org_guest_access`, `admin_list_all_orgs`) and loosens `list_org_members`'s admin check. The React side adds two `orgRepo.ts` functions, a small `Switch` in the existing `OrgInvitations.tsx` header, a shared role-label module extracted from that file, and a new `OrganizationsTab.tsx` wired into `Admin.tsx`'s existing tab system.

**Tech Stack:** Vite/React, Supabase (Postgres + RPC), TanStack Query, vitest, shadcn/radix UI components (`Switch`, `Table`), sonner toasts.

**Design spec:** `docs/superpowers/specs/2026-07-31-org-role-management-ui-design.md`

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260731120000_org_guest_access_and_admin_view.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Guest access toggle + site super-admin cross-org read.
-- organizations has no client write RLS by design (see
-- organizations_member_read comment in 20260730120000_org_rbac_foundation.sql)
-- — every write goes through a SECURITY DEFINER function, same pattern as
-- create_organization() / admin_grant_org_role().

alter table public.organizations
  add column guest_access_enabled boolean not null default false;

-- ── update_org_guest_access() : org admin/pedago, or site super-admin ─────
create or replace function public.update_org_guest_access(p_org_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.has_org_role(p_org_id, array['admin','pedago']) or public.is_admin()) then
    raise exception 'Not authorized';
  end if;
  update public.organizations set guest_access_enabled = p_enabled where id = p_org_id;
end;
$$;

revoke all on function public.update_org_guest_access(uuid, boolean) from public;
grant execute on function public.update_org_guest_access(uuid, boolean) to authenticated;

-- ── admin_list_all_orgs() : site super-admin cross-org roster, read-only ──
-- organizations_member_read only lets a user read orgs they belong to, so a
-- site super-admin who isn't a member of every org needs a bypass, same
-- shape as list_org_members()'s security-definer read.
create or replace function public.admin_list_all_orgs()
returns table(id uuid, name text, slug text, member_count bigint, guest_access_enabled boolean, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  return query
    select o.id, o.name, o.slug, count(r.id), o.guest_access_enabled, o.created_at
    from public.organizations o
    left join public.user_org_roles r on r.org_id = o.id
    group by o.id
    order by o.created_at desc;
end;
$$;

revoke all on function public.admin_list_all_orgs() from public;
grant execute on function public.admin_list_all_orgs() to authenticated;

-- ── list_org_members() : loosen so a site super-admin can drill into any org ─
-- read-only reuse; admin_grant_org_role/admin_revoke_org_role/
-- admin_remove_org_member stay org-scoped-admin-only (unchanged, on purpose).
create or replace function public.list_org_members(p_org_id uuid)
returns table(user_id uuid, email text, username text, roles text[], joined_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.has_org_role(p_org_id, array['admin']) or public.is_admin()) then
    raise exception 'Not an admin of this organization';
  end if;

  return query
  select
    r.user_id,
    u.email::text,
    p.username,
    array_agg(r.role order by r.role),
    min(r.created_at)
  from public.user_org_roles r
  join auth.users u on u.id = r.user_id
  left join public.profiles p on p.id = r.user_id
  where r.org_id = p_org_id
  group by r.user_id, u.email, p.username
  order by min(r.created_at);
end;
$$;

revoke all on function public.list_org_members(uuid) from public;
grant execute on function public.list_org_members(uuid) to authenticated;
```

- [ ] **Step 2: Verify SQL syntax**

Run: `supabase db lint --schema public -f supabase/migrations/20260731120000_org_guest_access_and_admin_view.sql`

If `supabase db lint` isn't available in this environment (no local Postgres/docker), instead visually diff this migration's `create or replace function` bodies against the existing `list_org_members` definition in `supabase/migrations/20260730160000_org_member_management.sql` to confirm only the `if not (...)` line changed — the rest of the function body must be byte-for-byte identical (a `create or replace function` silently replaces the whole function, so any unintended drift here is a regression).

Expected: no syntax errors; `list_org_members` diff shows exactly one changed line.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260731120000_org_guest_access_and_admin_view.sql
git commit -m "feat(db): add org guest-access toggle and super-admin cross-org RPCs"
```

Note: per project convention (prod schema is hand-applied via the Supabase Management API, no migration-tracking table — see project memory), this migration file is NOT auto-applied to prod by this plan. Deploying it is a separate, explicit step the user runs after review.

---

### Task 2: `orgRepo.ts` — guest access + cross-org list functions

**Files:**
- Modify: `apps/app/src/lib/org/orgRepo.ts`

- [ ] **Step 1: Add types and functions**

Add after the existing `OrgMember` interface (after line 45):

```ts
export interface OrgSettings {
  id: string;
  name: string;
  guest_access_enabled: boolean;
}

export interface AdminOrgSummary {
  id: string;
  name: string;
  slug: string;
  member_count: number;
  guest_access_enabled: boolean;
  created_at: string;
}
```

Add after `removeOrgMember` (end of file, after line 149):

```ts

/** Org id/name/guest-access — readable by any member (organizations_member_read). */
export async function fetchOrgSettings(orgId: string): Promise<OrgSettings> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, guest_access_enabled')
    .eq('id', orgId)
    .single();
  if (error) throw error;
  return data;
}

/** Org admin/pedago only (enforced server-side). */
export async function updateGuestAccess(orgId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('update_org_guest_access', { p_org_id: orgId, p_enabled: enabled });
  if (error) throw error;
}

/** Site super-admin only (enforced server-side) — every org, read-only. */
export async function adminListAllOrgs(): Promise<AdminOrgSummary[]> {
  const { data, error } = await supabase.rpc('admin_list_all_orgs');
  if (error) throw error;
  return data ?? [];
}
```

No test for this step — these are thin Supabase RPC/table wrappers with no branching logic, matching the existing untested pattern for `grantOrgRole`/`revokeOrgRole`/`removeOrgMember`/`listOrgMembers` in this same file (only the pure `slugify` function has a unit test, in `__tests__/orgRepo.test.ts`).

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/app/src/lib/org/orgRepo.ts
git commit -m "feat(org): add guest-access and cross-org list client functions"
```

---

### Task 3: Extract shared role-label module

**Files:**
- Create: `apps/app/src/lib/org/roleLabels.ts`
- Create: `apps/app/src/lib/org/__tests__/roleLabels.test.ts`
- Modify: `apps/app/src/pages/OrgInvitations.tsx:1-34`

- [ ] **Step 1: Write the failing test**

```ts
// apps/app/src/lib/org/__tests__/roleLabels.test.ts
import { describe, it, expect } from 'vitest';
import { roleOptions, roleLabel } from '../roleLabels';

describe('roleLabel', () => {
  it('maps every OrgRole to its French label', () => {
    expect(roleLabel('learner')).toBe('Apprenant');
    expect(roleLabel('trainer')).toBe('Formateur');
    expect(roleLabel('pedago')).toBe('Responsable pédagogique');
    expect(roleLabel('registrar')).toBe('Gestionnaire de scolarité');
    expect(roleLabel('admin')).toBe('Administrateur');
  });

  it('falls back to the raw role string for an unknown value', () => {
    expect(roleLabel('unknown' as never)).toBe('unknown');
  });
});

describe('roleOptions', () => {
  it('has exactly the 5 OrgRole values, in a stable order', () => {
    expect(roleOptions.map((r) => r.value)).toEqual(['learner', 'trainer', 'pedago', 'registrar', 'admin']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && npx vitest run src/lib/org/__tests__/roleLabels.test.ts`
Expected: FAIL — `Cannot find module '../roleLabels'`

- [ ] **Step 3: Create the module**

```ts
// apps/app/src/lib/org/roleLabels.ts
import type { OrgRole } from './orgRepo';

export const roleOptions: { value: OrgRole; label: string }[] = [
  { value: 'learner', label: 'Apprenant' },
  { value: 'trainer', label: 'Formateur' },
  { value: 'pedago', label: 'Responsable pédagogique' },
  { value: 'registrar', label: 'Gestionnaire de scolarité' },
  { value: 'admin', label: 'Administrateur' },
];

export const roleLabel = (role: OrgRole): string => roleOptions.find((r) => r.value === role)?.label ?? role;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && npx vitest run src/lib/org/__tests__/roleLabels.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Update `OrgInvitations.tsx` to import instead of defining locally**

In `apps/app/src/pages/OrgInvitations.tsx`, replace lines 26-34:

```ts
const roleOptions: { value: OrgRole; label: string }[] = [
  { value: "learner", label: "Apprenant" },
  { value: "trainer", label: "Formateur" },
  { value: "pedago", label: "Responsable pédagogique" },
  { value: "registrar", label: "Gestionnaire de scolarité" },
  { value: "admin", label: "Administrateur" },
];

const roleLabel = (role: OrgRole): string => roleOptions.find((r) => r.value === role)?.label ?? role;
```

with:

```ts
import { roleOptions, roleLabel } from "@/lib/org/roleLabels";
```

(Move this new import line up into the existing import block at the top of the file, next to the `@/lib/org/orgRepo` import — don't leave it as a mid-file statement.)

- [ ] **Step 6: Run the full org test suite and typecheck**

Run: `cd apps/app && npx vitest run src/lib/org && npx tsc --noEmit`
Expected: PASS, no new type errors. `OrgInvitations.tsx` behavior is unchanged (same labels, same order).

- [ ] **Step 7: Commit**

```bash
git add apps/app/src/lib/org/roleLabels.ts apps/app/src/lib/org/__tests__/roleLabels.test.ts apps/app/src/pages/OrgInvitations.tsx
git commit -m "refactor(org): extract role labels into a shared module"
```

---

### Task 4: Guest-access toggle in `OrgInvitations.tsx`

**Files:**
- Modify: `apps/app/src/pages/OrgInvitations.tsx`

- [ ] **Step 1: Add imports and state**

Add to the top-level imports (alongside the existing ones):

```ts
import { Switch } from "@/components/ui/switch";
import { fetchOrgSettings, updateGuestAccess } from "@/lib/org/orgRepo";
```

In `export default function OrgInvitations()`, add state after the existing `sending` state (line 175):

```ts
  const [guestAccess, setGuestAccess] = useState(false);
  const [guestAccessSaving, setGuestAccessSaving] = useState(false);
```

- [ ] **Step 2: Fetch guest-access setting once `managedOrgId` is known**

Add a new `useEffect` after the existing invitations-loading effect (after line 190):

```ts
  useEffect(() => {
    if (!managedOrgId) return;
    fetchOrgSettings(managedOrgId).then((s) => setGuestAccess(s.guest_access_enabled)).catch(showError);
  }, [managedOrgId]);
```

- [ ] **Step 3: Add the toggle handler**

Add after `handleRevoke` (after line 219):

```ts
  const handleGuestAccessChange = async (enabled: boolean) => {
    if (!managedOrgId) return;
    const previous = guestAccess;
    setGuestAccess(enabled);
    setGuestAccessSaving(true);
    try {
      await updateGuestAccess(managedOrgId, enabled);
      toast.success(enabled ? "Accès invité activé" : "Accès invité désactivé");
    } catch (err) {
      setGuestAccess(previous);
      showError(err);
    } finally {
      setGuestAccessSaving(false);
    }
  };
```

- [ ] **Step 4: Render the toggle in the `PageHeader`**

Replace the `<PageHeader ... />` call (lines 244-247):

```tsx
      <PageHeader
        title="Organisation"
        description="Invitez votre équipe et attribuez à chacun les permissions adaptées."
        action={
          isOrgAdmin ? (
            <label className="flex items-center gap-2 text-sm">
              <span>Accès invité (sans compte)</span>
              <Switch checked={guestAccess} disabled={guestAccessSaving} onCheckedChange={handleGuestAccessChange} />
            </label>
          ) : undefined
        }
      />
```

- [ ] **Step 5: Manually verify in the browser**

Run: `cd apps/app && npm run dev`, sign in as an org admin, navigate to `/org/invitations`.
Expected: toggle renders in the header, flipping it shows a success toast and persists across a page reload (re-fetches `guest_access_enabled`). Sign in as a non-admin org member — the toggle must not render (only `MemberRoster`'s existing "not admin" gating already hides the rest of the page in that case, but double check the toggle specifically respects `isOrgAdmin`).

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/pages/OrgInvitations.tsx
git commit -m "feat(org): add guest-access toggle to organization page"
```

---

### Task 5: `Admin.tsx` — add "Organizations" tab shell

**Files:**
- Modify: `apps/app/src/pages/admin/AdminSidebarGroup.tsx:9`
- Modify: `apps/app/src/pages/admin/Admin.tsx`

- [ ] **Step 1: Widen the `AdminSection` union**

In `apps/app/src/pages/admin/AdminSidebarGroup.tsx:9`, change:

```ts
export type AdminSection = "content" | "moderation" | "subscribers" | "settings";
```

to:

```ts
export type AdminSection = "content" | "moderation" | "subscribers" | "organizations" | "settings";
```

- [ ] **Step 2: Add the nav entry and tab render in `Admin.tsx`**

In `apps/app/src/pages/admin/Admin.tsx`, add to the lucide import (line 2):

```ts
import { Rocket, PenLine, ShieldCheck, Mail, FileText, Users, Link2, Building2 } from "lucide-react";
```

Add the import for the new tab component (near line 13):

```ts
import { OrganizationsTab } from "./OrganizationsTab";
```

In the `nav` array (lines 62-67), insert before the `settings` entry:

```ts
    { key: "content", icon: FileText, label: "Contenu", count: allContent.length },
    { key: "moderation", icon: ShieldCheck, label: "Modération", count: pendingMod, alert: pendingMod > 0 },
    { key: "subscribers", icon: Users, label: "Abonnés", count: subCount },
    { key: "organizations", icon: Building2, label: "Organisations", count: 0 },
    { key: "settings", icon: Link2, label: "Réglages", count: 0 },
```

In the tab render block (lines 103-108), add:

```tsx
            {section === "content" && <ContentTab />}
            {section === "moderation" && <ModerationTab />}
            {section === "subscribers" && <SubscribersTab />}
            {section === "organizations" && <OrganizationsTab />}
            {section === "settings" && <SettingsTab />}
```

This step won't build yet — `OrganizationsTab` doesn't exist until Task 6. That's fine, it's created in the next task before any test/build/commit checkpoint.

---

### Task 6: `OrganizationsTab.tsx` — cross-org read-only view

**Files:**
- Create: `apps/app/src/pages/admin/OrganizationsTab.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { Fragment, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeletons";
import { showError } from "@/lib/errorTaxonomy";
import { roleLabel } from "@/lib/org/roleLabels";
import { adminListAllOrgs, listOrgMembers, type AdminOrgSummary, type OrgMember } from "@/lib/org/orgRepo";

function MemberRosterReadOnly({ orgId }: { orgId: string }) {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listOrgMembers(orgId)
      .then((m) => { if (!cancelled) setMembers(m); })
      .catch(showError)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orgId]);

  if (loading) return <TableSkeleton rows={3} cols={3} />;
  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground p-3">Aucun membre.</p>;
  }

  return (
    <ul className="space-y-2 p-3" aria-label="Membres (lecture seule)">
      {members.map((member) => (
        <li key={member.user_id} className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="font-medium">{member.username ?? member.email}</p>
            <p className="text-sm text-muted-foreground">{member.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {member.roles.map((role) => (
              <Badge key={role} variant="secondary">{roleLabel(role)}</Badge>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function OrganizationsTab() {
  const [orgs, setOrgs] = useState<AdminOrgSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);

  useEffect(() => {
    adminListAllOrgs().then(setOrgs).catch(showError).finally(() => setLoading(false));
  }, []);

  if (loading) return <TableSkeleton rows={5} cols={4} />;

  if (orgs.length === 0) {
    return (
      <div className="product-empty-inline">
        <div><strong>Aucune organisation</strong><span>Les organisations créées apparaîtront ici.</span></div>
      </div>
    );
  }

  return (
    <section className="adm-panel">
      <div className="adm-panel-head">
        <h2>Organisations</h2>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Membres</TableHead>
            <TableHead>Accès invité</TableHead>
            <TableHead>Créée le</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orgs.map((org) => (
            <Fragment key={org.id}>
              <TableRow
                className="cursor-pointer"
                onClick={() => setExpandedOrgId((prev) => (prev === org.id ? null : org.id))}
              >
                <TableCell>{org.name}</TableCell>
                <TableCell>{org.member_count}</TableCell>
                <TableCell>
                  <Badge variant={org.guest_access_enabled ? "default" : "secondary"}>
                    {org.guest_access_enabled ? "Activé" : "Désactivé"}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(org.created_at).toLocaleDateString("fr-FR")}</TableCell>
              </TableRow>
              {expandedOrgId === org.id && (
                <TableRow>
                  <TableCell colSpan={4} className="p-0">
                    <MemberRosterReadOnly orgId={org.id} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
```

No test for this step — matches the existing convention that admin tab components (`ContentTab`, `ModerationTab`, `SubscribersTab`, `SettingsTab`) have no component tests in this codebase; only pure logic (like Task 3's `roleLabel`) is unit-tested here.

- [ ] **Step 2: Typecheck and build**

Run: `cd apps/app && npx tsc --noEmit && npm run build`
Expected: no errors. `Badge`'s `default`/`secondary` variants are confirmed to exist in `apps/app/src/components/ui/badge.tsx:10-15`.

- [ ] **Step 3: Manually verify in the browser**

Run: `cd apps/app && npm run dev`, sign in as a site super-admin (`profiles.role = 'admin'`), navigate to `/admin`, click the "Organisations" tab.
Expected: `TableSkeleton` shows briefly, then a table of all orgs with member counts and guest-access badges. Clicking a row expands a read-only member roster below it (no grant/revoke/remove buttons). Sign in as a non-super-admin — `/admin` still redirects to `/` per the existing `useIsAdmin` gate in `Admin.tsx:37-39`, so the new tab is unreachable, same as the other tabs.

- [ ] **Step 4: Commit**

```bash
git add apps/app/src/pages/admin/AdminSidebarGroup.tsx apps/app/src/pages/admin/Admin.tsx apps/app/src/pages/admin/OrganizationsTab.tsx
git commit -m "feat(admin): add read-only cross-org organizations tab"
```

---

### Task 7: Full verification pass

- [ ] **Step 1: Run the full test suite**

Run: `cd apps/app && npx vitest run`
Expected: all tests pass, including the new `roleLabels.test.ts`.

- [ ] **Step 2: Typecheck and build the whole app**

Run: `cd apps/app && npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 3: Confirm migration deployment is a separate manual step**

Do not run any `supabase db push` / Management API deploy as part of this plan — per project convention, prod schema changes here are applied by the user manually after reviewing the migration file (see project memory: prod schema is hand-built, no migration tracking, port 5432 firewalled). Flag to the user that `supabase/migrations/20260731120000_org_guest_access_and_admin_view.sql` is ready for their review and manual deploy.
