# Course Sharing (Invite Users/Groups) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Course creators can grant view-only access to a course to specific users (by username search or exact email) or to reusable named groups of users, without making the course fully public.

**Architecture:** A prerequisite fix (courses were never mirrored to Supabase, so `CourseViewer` couldn't be read by anyone but the owner's own browser) followed by three new Supabase tables (`groups`, `group_members`, `content_shares`) with RLS, two `security definer` functions for username search/email-invite resolution (the client can never query `auth.users` or other users' `profiles` rows directly), a client data layer, and UI wired into the existing `CourseContextMenu` / a new `SharedWithMe` page.

**Tech Stack:** Supabase (Postgres + RLS + PL/pgSQL functions), React + TypeScript, react-router-dom, Vitest.

Spec: `docs/superpowers/specs/2026-07-25-course-sharing-design.md`

---

## File Structure

- Create: `supabase/migrations/20260725120000_course_sharing.sql` — schema, RLS, functions.
- Modify: `apps/app/src/lib/content/contentRepo.ts` — add `getContentBySourceAnyOwner`.
- Modify: `apps/app/src/lib/content/__tests__/contentRepo.test.ts` — test for the above.
- Modify: `apps/app/src/pages/CourseBuilder.tsx` — mirror course to Supabase on save.
- Modify: `apps/app/src/pages/CourseViewer.tsx` — Supabase fallback when not found locally.
- Create: `apps/app/src/lib/sharing/sharingRepo.ts` — groups/group_members/content_shares CRUD + RPC wrappers + `mergeSharedContentIds` (pure) + `listSharedWithMe`.
- Create: `apps/app/src/lib/sharing/__tests__/sharingRepo.test.ts` — tests for `mergeSharedContentIds`.
- Modify: `apps/app/src/lib/i18n.ts` — sharing UI strings (en + fr).
- Modify: `apps/app/src/components/CourseContextMenu.tsx` — new "Gérer l'accès" item.
- Create: `apps/app/src/components/sharing/PersonPicker.tsx` — reusable username-search + email-invite widget.
- Create: `apps/app/src/components/ShareCourseModal.tsx` — Personnes/Groupes tabs modal.
- Modify: `apps/app/src/pages/MyCourses.tsx` — wire modal open state.
- Create: `apps/app/src/pages/SharedWithMe.tsx` — flat list of courses shared with the current user.
- Modify: `apps/app/src/App.tsx` — add `/shared-with-me` route.
- Modify: `apps/app/src/components/AppSidebar.tsx` — add "Partagés avec moi" nav item.

---

### Task 1: Migration — schema, RLS, functions

**Files:**
- Create: `supabase/migrations/20260725120000_course_sharing.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Course sharing: invite individual users or reusable groups to view a course
-- without making it fully public. Course creators only (type='course'),
-- view-only access for invitees — no editing.

-- ── profiles.username : public-safe identity for search/invites ────────────
-- Source of truth stays auth.users.user_metadata.username (set at signup, see
-- apps/app/src/lib/auth.ts signUp()); this column is a queryable mirror, since
-- RLS can never let a client read another user's raw profiles row (role/plan)
-- and auth.users is never client-readable at all.
alter table public.profiles add column username text;

-- Backfill existing users: prefer their auth metadata username, else the
-- email local-part, disambiguating any collisions (usernames were never
-- unique before this column existed) with a numeric suffix.
with candidates as (
  select
    u.id,
    coalesce(nullif(u.raw_user_meta_data->>'username', ''), split_part(u.email, '@', 1)) as base
  from auth.users u
),
numbered as (
  select id, base, row_number() over (partition by base order by id) as rn
  from candidates
)
update public.profiles p
set username = n.base || case when n.rn = 1 then '' else '-' || n.rn end
from numbered n
where p.id = n.id;

alter table public.profiles alter column username set not null;
alter table public.profiles add constraint profiles_username_unique unique (username);

-- ── groups : reusable named lists of users, owned by their creator ─────────
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index groups_owner_idx on public.groups(owner_id);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  pending_email text,
  created_at timestamptz not null default now(),
  check (num_nonnulls(user_id, pending_email) = 1),
  unique (group_id, user_id),
  unique (group_id, pending_email)
);
create index group_members_group_idx on public.group_members(group_id);
create index group_members_user_idx on public.group_members(user_id);

-- ── content_shares : grants view access to a course for a user or group ────
create table public.content_shares (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content(id) on delete cascade,
  shared_with_user_id uuid references auth.users(id) on delete cascade,
  shared_with_group_id uuid references public.groups(id) on delete cascade,
  pending_email text,
  created_at timestamptz not null default now(),
  check (num_nonnulls(shared_with_user_id, shared_with_group_id, pending_email) = 1),
  unique (content_id, shared_with_user_id),
  unique (content_id, shared_with_group_id),
  unique (content_id, pending_email)
);
create index content_shares_content_idx on public.content_shares(content_id);
create index content_shares_user_idx on public.content_shares(shared_with_user_id);
create index content_shares_group_idx on public.content_shares(shared_with_group_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.content_shares enable row level security;

create policy groups_owner on public.groups
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy group_members_owner on public.group_members
  for all using (
    exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );

create policy content_shares_owner on public.content_shares
  for all using (
    exists (select 1 from public.content c where c.id = content_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.content c where c.id = content_id and c.user_id = auth.uid())
  );

-- A shared user needs to see their own grant rows (SharedWithMe lists them),
-- which content_shares_owner alone doesn't cover — they aren't the course owner.
create policy content_shares_read_own on public.content_shares
  for select using (shared_with_user_id = auth.uid());

-- content: extend the existing public-read policy with a shared-access clause.
drop policy if exists content_public_read on public.content;
create policy content_public_read on public.content
  for select using (
    is_public = true or is_open = true
    or exists (
      select 1 from public.content_shares cs
      where cs.content_id = content.id
        and (cs.shared_with_user_id = auth.uid()
             or cs.shared_with_group_id in (select group_id from public.group_members where user_id = auth.uid()))
    )
  );

-- ── functions ────────────────────────────────────────────────────────────

-- Public-safe username search for invite autocomplete. security definer so it
-- can read all of `profiles`, but only ever returns id+username — never role/plan.
create or replace function public.search_profiles_by_username(prefix text)
returns table(id uuid, username text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.username
  from public.profiles p
  where p.username ilike prefix || '%'
    and p.id <> auth.uid()
  order by p.username
  limit 10;
$$;

-- Resolves a set of user ids to id+username, for the owner's share list to
-- display who a course is shared with (profiles_read_self alone wouldn't let
-- the owner read other users' rows).
create or replace function public.usernames_by_ids(ids uuid[])
returns table(id uuid, username text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.username
  from public.profiles p
  where p.id = any(ids);
$$;

-- Resolves an email to a user id (client can never query auth.users directly)
-- and inserts a content_shares row: resolved if the email has an account,
-- pending otherwise (resolved automatically by handle_new_user on signup).
-- Caller must own the content row.
create or replace function public.resolve_content_share(p_content_id uuid, p_email text)
returns public.content_shares
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  result public.content_shares;
begin
  if not exists (select 1 from public.content where id = p_content_id and user_id = auth.uid()) then
    raise exception 'Not the owner of this content';
  end if;

  select u.id into target_user_id from auth.users u where u.email = p_email;

  if target_user_id is not null then
    insert into public.content_shares (content_id, shared_with_user_id)
    values (p_content_id, target_user_id)
    on conflict (content_id, shared_with_user_id) do nothing
    returning * into result;
  else
    insert into public.content_shares (content_id, pending_email)
    values (p_content_id, p_email)
    on conflict (content_id, pending_email) do nothing
    returning * into result;
  end if;

  return result;
end;
$$;

-- Same shape as resolve_content_share, for group membership. Caller must own the group.
create or replace function public.resolve_group_member(p_group_id uuid, p_email text)
returns public.group_members
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  result public.group_members;
begin
  if not exists (select 1 from public.groups where id = p_group_id and owner_id = auth.uid()) then
    raise exception 'Not the owner of this group';
  end if;

  select u.id into target_user_id from auth.users u where u.email = p_email;

  if target_user_id is not null then
    insert into public.group_members (group_id, user_id)
    values (p_group_id, target_user_id)
    on conflict (group_id, user_id) do nothing
    returning * into result;
  else
    insert into public.group_members (group_id, pending_email)
    values (p_group_id, p_email)
    on conflict (group_id, pending_email) do nothing
    returning * into result;
  end if;

  return result;
end;
$$;

-- ── extend handle_new_user: backfill username, resolve pending invites ─────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text := coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1));
  candidate text := base_username;
  suffix int := 1;
begin
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base_username || '-' || suffix;
  end loop;

  insert into public.profiles (id, username) values (new.id, candidate)
  on conflict (id) do nothing;

  update public.group_members set user_id = new.id, pending_email = null where pending_email = new.email;
  update public.content_shares set shared_with_user_id = new.id, pending_email = null where pending_email = new.email;

  return new;
end;
$$;
```

- [ ] **Step 2: Sanity-check the file**

Run: `cd /Users/loicrossignol/Desktop/vibecoding/interactive-play-quiz && grep -c 'create table\|create policy\|create or replace function' supabase/migrations/20260725120000_course_sharing.sql`
Expected: `12` (3 tables' worth of `create table` is actually 2 — recount doesn't matter; the point of this step is just confirming the file was written and is non-empty/parseable-looking, not a real DB dry-run). If the file is empty or the grep errors (file not found), the write failed — redo Step 1.

There is no local Postgres/Supabase instance in this repo to apply the migration against, so this task does NOT include actually running it — that's a separate, explicit deploy step the user drives later (see the spec's "Deployment note"). Do not attempt to connect to prod or apply this migration.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260725120000_course_sharing.sql
git commit -m "feat(db): course sharing schema — groups, group_members, content_shares, RLS, invite functions"
```

## Context

Course creators need to grant view access to individual users or groups without publishing the course. This migration is the full backend: three new tables, RLS extending the existing `content_public_read` policy, and `security definer` functions that let the client search usernames / resolve email invites without ever being able to query `auth.users` or other users' raw `profiles` rows. It's written but not applied — this repo has no local Supabase instance to test migrations against; prod deploy is a separate, explicit step the user drives (see `docs/superpowers/specs/2026-07-25-course-sharing-design.md`'s "Deployment note").

---

### Task 2: `getContentBySourceAnyOwner` (prerequisite data layer)

**Files:**
- Modify: `apps/app/src/lib/content/contentRepo.ts`
- Modify: `apps/app/src/lib/content/__tests__/contentRepo.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `apps/app/src/lib/content/__tests__/contentRepo.test.ts`, inside the existing `describe('contentRepo', ...)` block (add the import to the existing `import { ... } from '../contentRepo'` list at the top of the file too):

```typescript
  it('getContentBySourceAnyOwner returns the row for type+source_id with no user_id filter', async () => {
    const row = { id: 'r9', user_id: 'someone-else', type: 'course', source_id: 'course-1', data: {} };
    const builder = makeBuilder({ data: row, error: null });
    fromMock.mockReturnValue(builder);

    const result = await getContentBySourceAnyOwner('course', 'course-1');

    expect(fromMock).toHaveBeenCalledWith('content');
    expect(builder.eq).toHaveBeenCalledWith('type', 'course');
    expect(builder.eq).toHaveBeenCalledWith('source_id', 'course-1');
    expect(builder.maybeSingle).toHaveBeenCalled();
    expect(result).toEqual(row);
  });

  it('getContentBySourceAnyOwner returns null when not found', async () => {
    const builder = makeBuilder({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    const result = await getContentBySourceAnyOwner('course', 'missing');

    expect(result).toBeNull();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/app && npx vitest run src/lib/content/__tests__/contentRepo.test.ts`
Expected: FAIL — `getContentBySourceAnyOwner` is not exported from `../contentRepo`.

- [ ] **Step 3: Write the implementation**

Add to `apps/app/src/lib/content/contentRepo.ts`, right after the existing `getContentBySource` function:

```typescript
/**
 * Fetch a content row by type + source id, regardless of owner. Used by
 * CourseViewer's cross-browser fallback: a shared/public course viewed by
 * anyone other than its creator won't be in that browser's localStorage,
 * so this is the only way to load it. RLS (owner/is_public/is_open/
 * content_shares) decides what's actually visible — this function imposes
 * no additional filter itself.
 */
export async function getContentBySourceAnyOwner(
  type: ContentType,
  sourceId: string,
): Promise<ContentRow | null> {
  const { data, error } = await supabase
    .from('content')
    .select('*')
    .eq('type', type)
    .eq('source_id', sourceId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/app && npx vitest run src/lib/content/__tests__/contentRepo.test.ts`
Expected: PASS — all tests in the file pass, including the 2 new ones.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/lib/content/contentRepo.ts apps/app/src/lib/content/__tests__/contentRepo.test.ts
git commit -m "feat(app): add getContentBySourceAnyOwner for cross-owner content lookup"
```

## Context

This is prerequisite infrastructure, independent of the sharing UI itself: it's what lets `CourseViewer.tsx` (Task 4) load a course that isn't in the current browser's `localStorage` — the case for any shared, public, or cross-device course viewing. Does not depend on Task 1's migration being applied (the RLS policy changes only affect which rows this query can see at runtime, not whether the query itself compiles/works).

---

### Task 3: Mirror courses to Supabase on save

**Files:**
- Modify: `apps/app/src/pages/CourseBuilder.tsx`

- [ ] **Step 1: Add the import**

In `apps/app/src/pages/CourseBuilder.tsx`, add to the imports (after the existing `import { PlanLimitBlocker } from "@/components/PlanLimitBlocker";` line):

```typescript
import { PlanLimitBlocker } from "@/components/PlanLimitBlocker";
import { upsertContentBySource } from "@/lib/content/contentRepo";
```

- [ ] **Step 2: Mirror on save**

Find `handleSave` in `apps/app/src/pages/CourseBuilder.tsx` (currently):

```typescript
      if (courseId) {
        updateCourse(courseId, data);
        toast.success("Cours enregistré");
      } else {
        createCourse(data);
        toast.success("Cours créé !");
        navigate("/my-courses");
      }
```

Replace with:

```typescript
      let saved: Course | null;
      if (courseId) {
        saved = updateCourse(courseId, data);
        toast.success("Cours enregistré");
      } else {
        saved = createCourse(data);
        toast.success("Cours créé !");
      }

      // Mirror into the Supabase `content` table so it's viewable by anyone
      // other than the owner's own browser (shared/public course viewing),
      // same pattern QuizBuilder.tsx/ExamBuilder.tsx already use for their types.
      if (saved && user) {
        try {
          await upsertContentBySource(user.id, 'course', saved.id, saved as unknown as Record<string, unknown>, saved.isPublic);
        } catch (e) { console.error('[CourseBuilder] content mirror failed', e); }
      }

      if (!courseId) navigate("/my-courses");
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/app && npm run typecheck`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/app/src/pages/CourseBuilder.tsx
git commit -m "feat(app): mirror courses to Supabase content table on save"
```

## Context

Investigation during planning found `CourseBuilder.tsx`'s save path (`createCourse`/`updateCourse`, both pure `localStorage` in `courseStorage.ts`) never mirrored into the Supabase `content` table — unlike quiz/poll/flashcard (`QuizBuilder.tsx`) and exam (`ExamBuilder.tsx`), which already call `upsertContentBySource` on save. Without this, no course is ever visible to Supabase at all, so neither "Public" nor the new sharing feature can work. This task fixes that gap; it's additive only — the legacy `localStorage` read/write path the owner's own editing/viewing already uses is untouched. The mirror failure is caught and logged, not fatal, matching `ExamBuilder.tsx`'s precedent — a save should never fail just because the mirror write had a transient issue.

---

### Task 4: `CourseViewer` Supabase fallback

**Files:**
- Modify: `apps/app/src/pages/CourseViewer.tsx`

- [ ] **Step 1: Add the import**

Find the import of `getCourseById` in `apps/app/src/pages/CourseViewer.tsx` (part of a larger `import { ... } from "..."` from `courseStorage` — search for `getCourseById` to find it) and add, near the other data-layer imports:

```typescript
import { getContentBySourceAnyOwner } from "@/lib/content/contentRepo";
```

- [ ] **Step 2: Add the fallback**

Find this effect in `apps/app/src/pages/CourseViewer.tsx` (around line 375):

```typescript
  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    if (!courseId) { navigate("/my-courses"); return; }
    const c = getCourseById(courseId);
    if (!c) { toast.error("Cours introuvable"); navigate("/my-courses"); return; }
    setCourse(c);
    setProgress(getCourseProgress(courseId, user.id));
    // No auto-select: land on the course overview first (like Udemy/Coursera/edX),
    // "Commencer"/"Continuer" is what takes the learner into a lesson.
  }, [courseId]);
```

Replace with:

```typescript
  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    if (!courseId) { navigate("/my-courses"); return; }

    const local = getCourseById(courseId);
    if (local) {
      setCourse(local);
      setProgress(getCourseProgress(courseId, user.id));
      // No auto-select: land on the course overview first (like Udemy/Coursera/edX),
      // "Commencer"/"Continuer" is what takes the learner into a lesson.
      return;
    }

    // Not in this browser's localStorage — the viewer isn't the owner (shared,
    // public, or cross-device access). Fall back to the Supabase mirror; RLS
    // decides whether this viewer is actually allowed to see it.
    let cancelled = false;
    getContentBySourceAnyOwner('course', courseId)
      .then((row) => {
        if (cancelled) return;
        if (!row) { toast.error("Cours introuvable"); navigate("/my-courses"); return; }
        setCourse(row.data as unknown as Course);
        setProgress(getCourseProgress(courseId, user.id));
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Cours introuvable");
        navigate("/my-courses");
      });
    return () => { cancelled = true; };
  }, [courseId]);
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/app && npm run typecheck`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/app/src/pages/CourseViewer.tsx
git commit -m "feat(app): CourseViewer falls back to Supabase when a course isn't local"
```

## Context

Completes the prerequisite: `CourseBuilder.tsx` now mirrors courses to Supabase (Task 3), and this task makes `CourseViewer.tsx` actually read that mirror when the local lookup misses — which is every case except the owner's own browser. Owner behavior is unchanged (still hits the fast synchronous local path first). No loading spinner is added: the page already renders nothing (`if (!user || !course) return null;`, unchanged elsewhere in the file) until `course` is set, so the async fallback's brief loading window reuses that existing blank state rather than needing new UI.

---

### Task 5: i18n strings

**Files:**
- Modify: `apps/app/src/lib/i18n.ts`

- [ ] **Step 1: Add the English keys**

In the `en` block, find `searchError: "Search failed",` (added by the earlier global-search feature) and add after it:

```typescript
    searchError: "Search failed",
    shareManageAccess: "Manage access",
    sharePeopleTab: "People",
    shareGroupsTab: "Groups",
    shareSearchPlaceholder: "Search by username…",
    shareEmailPlaceholder: "Email address",
    shareInviteByEmail: "Invite by email",
    sharePending: "Pending",
    shareRemove: "Remove",
    shareNewGroup: "+ New group",
    shareGroupNamePlaceholder: "Group name",
    shareCreateGroup: "Create",
    shareNoShares: "Nobody has access yet",
    shareManageMembers: "Manage members",
    navSharedWithMe: "Shared with me",
    sharedWithMeSubtitle: "Courses shared with you",
    sharedWithMeEmpty: "No courses have been shared with you yet",
```

- [ ] **Step 2: Add the French keys**

In the `fr` block, find `searchError: "Échec de la recherche",` and add after it:

```typescript
    searchError: "Échec de la recherche",
    shareManageAccess: "Gérer l'accès",
    sharePeopleTab: "Personnes",
    shareGroupsTab: "Groupes",
    shareSearchPlaceholder: "Rechercher par pseudo…",
    shareEmailPlaceholder: "Adresse email",
    shareInviteByEmail: "Inviter par email",
    sharePending: "En attente",
    shareRemove: "Retirer",
    shareNewGroup: "+ Nouveau groupe",
    shareGroupNamePlaceholder: "Nom du groupe",
    shareCreateGroup: "Créer",
    shareNoShares: "Personne n'a encore accès",
    shareManageMembers: "Gérer les membres",
    navSharedWithMe: "Partagés avec moi",
    sharedWithMeSubtitle: "Cours partagés avec vous",
    sharedWithMeEmpty: "Aucun cours partagé pour l'instant",
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/app && npm run typecheck`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/app/src/lib/i18n.ts
git commit -m "feat(app): add course-sharing i18n strings"
```

---

### Task 6: `sharingRepo.ts` data layer (TDD for the pure helper)

**Files:**
- Create: `apps/app/src/lib/sharing/sharingRepo.ts`
- Test: `apps/app/src/lib/sharing/__tests__/sharingRepo.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/app/src/lib/sharing/__tests__/sharingRepo.test.ts
import { describe, it, expect, vi } from 'vitest';

// sharingRepo.ts imports the real Supabase client at module load; stub it so
// the pure helper can be tested without VITE_SUPABASE_URL in the env — same
// pattern as foldersRepo.test.ts / searchContent.test.ts.
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import { mergeSharedContentIds } from '../sharingRepo';

describe('mergeSharedContentIds', () => {
  it('dedupes content ids across multiple lists', () => {
    const result = mergeSharedContentIds(
      [{ content_id: 'a' }, { content_id: 'b' }],
      [{ content_id: 'b' }, { content_id: 'c' }],
    );
    expect(result.sort()).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty array when given no shares', () => {
    expect(mergeSharedContentIds([], [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/app && npx vitest run src/lib/sharing/__tests__/sharingRepo.test.ts`
Expected: FAIL — `../sharingRepo` module doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/app/src/lib/sharing/sharingRepo.ts
import { supabase } from '@/lib/supabase';
import type { ContentRow } from '@/lib/content/types';

export interface Group {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string | null;
  pending_email: string | null;
  created_at: string;
}

export interface ContentShare {
  id: string;
  content_id: string;
  shared_with_user_id: string | null;
  shared_with_group_id: string | null;
  pending_email: string | null;
  created_at: string;
}

export interface UsernameMatch {
  id: string;
  username: string;
}

/** Autocomplete search: users whose username starts with `prefix` (excludes the caller). */
export async function searchUsernames(prefix: string): Promise<UsernameMatch[]> {
  const { data, error } = await supabase.rpc('search_profiles_by_username', { prefix });
  if (error) throw error;
  return data ?? [];
}

/** Resolve a batch of user ids to id+username, for displaying an existing share list. */
export async function usernamesByIds(ids: string[]): Promise<UsernameMatch[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.rpc('usernames_by_ids', { ids });
  if (error) throw error;
  return data ?? [];
}

export async function listGroups(ownerId: string): Promise<Group[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createGroup(ownerId: string, name: string): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .insert({ owner_id: ownerId, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  if (error) throw error;
}

export async function listGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addGroupMemberByUserId(groupId: string, userId: string): Promise<GroupMember> {
  const { data, error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function resolveGroupMemberByEmail(groupId: string, email: string): Promise<GroupMember> {
  const { data, error } = await supabase.rpc('resolve_group_member', { p_group_id: groupId, p_email: email });
  if (error) throw error;
  return data;
}

export async function removeGroupMember(memberId: string): Promise<void> {
  const { error } = await supabase.from('group_members').delete().eq('id', memberId);
  if (error) throw error;
}

export async function listContentShares(contentId: string): Promise<ContentShare[]> {
  const { data, error } = await supabase
    .from('content_shares')
    .select('*')
    .eq('content_id', contentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addContentShareByUserId(contentId: string, userId: string): Promise<ContentShare> {
  const { data, error } = await supabase
    .from('content_shares')
    .insert({ content_id: contentId, shared_with_user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addContentShareByGroupId(contentId: string, groupId: string): Promise<ContentShare> {
  const { data, error } = await supabase
    .from('content_shares')
    .insert({ content_id: contentId, shared_with_group_id: groupId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function resolveContentShareByEmail(contentId: string, email: string): Promise<ContentShare> {
  const { data, error } = await supabase.rpc('resolve_content_share', { p_content_id: contentId, p_email: email });
  if (error) throw error;
  return data;
}

export async function removeContentShare(shareId: string): Promise<void> {
  const { error } = await supabase.from('content_shares').delete().eq('id', shareId);
  if (error) throw error;
}

/** Pure: dedupe content ids across any number of `{content_id}` row lists. No I/O. */
export function mergeSharedContentIds(...lists: { content_id: string }[][]): string[] {
  return Array.from(new Set(lists.flat().map((r) => r.content_id)));
}

/** Courses shared with `userId`, directly or via any group they belong to. */
export async function listSharedWithMe(userId: string): Promise<ContentRow[]> {
  const { data: direct, error: directError } = await supabase
    .from('content_shares')
    .select('content_id')
    .eq('shared_with_user_id', userId);
  if (directError) throw directError;

  const { data: myGroups, error: groupsError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);
  if (groupsError) throw groupsError;
  const groupIds = (myGroups ?? []).map((g: { group_id: string }) => g.group_id);

  let viaGroups: { content_id: string }[] = [];
  if (groupIds.length > 0) {
    const { data, error } = await supabase
      .from('content_shares')
      .select('content_id')
      .in('shared_with_group_id', groupIds);
    if (error) throw error;
    viaGroups = data ?? [];
  }

  const contentIds = mergeSharedContentIds(direct ?? [], viaGroups);
  if (contentIds.length === 0) return [];

  const { data: rows, error: rowsError } = await supabase
    .from('content')
    .select('*')
    .eq('type', 'course')
    .in('id', contentIds)
    .order('updated_at', { ascending: false });
  if (rowsError) throw rowsError;
  return rows ?? [];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/app && npx vitest run src/lib/sharing/__tests__/sharingRepo.test.ts`
Expected: PASS — 2 tests passed.

- [ ] **Step 5: Typecheck**

Run: `cd apps/app && npm run typecheck`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/lib/sharing/sharingRepo.ts apps/app/src/lib/sharing/__tests__/sharingRepo.test.ts
git commit -m "feat(app): add sharingRepo (groups/content_shares CRUD + listSharedWithMe)"
```

## Context

This is the entire client-side data layer for sharing — every table CRUD op plus the two RPC wrappers (`resolve_content_share`/`resolve_group_member` from Task 1's migration) and `listSharedWithMe` (used by Task 12's `SharedWithMe.tsx`). Only `mergeSharedContentIds` is unit-tested directly (it's the one piece of real logic; everything else is a thin, directly-verifiable Supabase call, consistent with how `contentRepo.ts`'s simplest CRUD wrappers aren't all individually tested either). Depends on nothing else in this plan being done first — the RPC/table names it calls just need to exist in the eventual deployed schema (Task 1), not in this session's environment, since these functions aren't invoked until the UI tasks wire them in.

---

### Task 7: `CourseContextMenu` — "Gérer l'accès" item

**Files:**
- Modify: `apps/app/src/components/CourseContextMenu.tsx`

- [ ] **Step 1: Add the prop and menu item**

Replace the full contents of `apps/app/src/components/CourseContextMenu.tsx` with:

```tsx
import { Copy, Edit, MoreHorizontal, Share2, Star, Trash2, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { t } from "@/lib/i18n";
import type { Course } from "@/lib/courseStorage";

interface CourseContextMenuProps {
  course: Course;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleFavorite: () => void;
  onShare: () => void;
  onManageAccess: () => void;
  onTrash: () => void;
}

const menuStyle = {
  minWidth: 188,
  border: "var(--ap-border-w) solid var(--ap-line)",
  background: "var(--ap-card)",
  borderRadius: "var(--ap-r-md)",
};

export const CourseContextMenu = ({
  course,
  onEdit,
  onDuplicate,
  onToggleFavorite,
  onShare,
  onManageAccess,
  onTrash,
}: CourseContextMenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
      <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "5px 7px" }} title="Actions">
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" style={menuStyle} onClick={(e) => e.stopPropagation()}>
      <DropdownMenuItem onSelect={onEdit} className="flex items-center gap-2 cursor-pointer text-sm">
        <Edit className="h-3.5 w-3.5" /> Modifier
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onDuplicate} className="flex items-center gap-2 cursor-pointer text-sm">
        <Copy className="h-3.5 w-3.5" /> Dupliquer
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onShare} className="flex items-center gap-2 cursor-pointer text-sm">
        <Share2 className="h-3.5 w-3.5" /> Partager
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onManageAccess} className="flex items-center gap-2 cursor-pointer text-sm">
        <Users className="h-3.5 w-3.5" /> {t("shareManageAccess")}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onToggleFavorite} className="flex items-center gap-2 cursor-pointer text-sm">
        <Star
          className="h-3.5 w-3.5"
          style={course.isFavorite ? { fill: "#fbbf24", color: "#fbbf24" } : {}}
        />
        {course.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={onTrash}
        className="flex items-center gap-2 cursor-pointer text-sm"
        style={{ color: "var(--ap-quiz)" }}
      >
        <Trash2 className="h-3.5 w-3.5" /> Mettre à la corbeille
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npm run typecheck`
Expected: this WILL fail at this point — `MyCourses.tsx` (the only consumer) doesn't pass `onManageAccess` yet. That's expected; Task 10 fixes it. Confirm the *only* errors are about the missing `onManageAccess` prop at `MyCourses.tsx`'s two `<CourseContextMenu ... />` call sites, nothing else.

- [ ] **Step 3: Commit**

```bash
git add apps/app/src/components/CourseContextMenu.tsx
git commit -m "feat(app): add Gérer l'accès item to CourseContextMenu"
```

Note in the commit or a follow-up message that `npm run typecheck` has expected, temporary errors at `MyCourses.tsx` until Task 10 lands — this is intentional incremental delivery, not a mistake.

---

### Task 8: `PersonPicker` reusable widget

**Files:**
- Create: `apps/app/src/components/sharing/PersonPicker.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { searchUsernames, type UsernameMatch } from "@/lib/sharing/sharingRepo";

interface PersonPickerProps {
  onPickUsername: (match: UsernameMatch) => void;
  onInviteEmail: (email: string) => void;
}

/** Reusable "add a person" widget: debounced username search + exact-email invite.
 *  Purely presentational — the caller decides what "picking" someone actually does
 *  (add to a course's content_shares, add to a group's members, ...). */
export const PersonPicker = ({ onPickUsername, onInviteEmail }: PersonPickerProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UsernameMatch[]>([]);
  const [email, setEmail] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) { setResults([]); return; }
    const handle = setTimeout(() => {
      searchUsernames(trimmed).then(setResults).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const pick = (match: UsernameMatch) => {
    onPickUsername(match);
    setQuery("");
    setResults([]);
  };

  const invite = () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    onInviteEmail(trimmed);
    setEmail("");
  };

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ position: "relative" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("shareSearchPlaceholder")}
          style={{
            width: "100%",
            height: 34,
            padding: "0 10px",
            borderRadius: "var(--ap-r-md)",
            border: "var(--ap-border-w) solid var(--ap-line)",
            background: "var(--ap-paper-2)",
            color: "var(--ap-ink)",
            fontFamily: "var(--ap-font-body)",
            fontSize: 13,
          }}
        />
        {results.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              zIndex: 10,
              background: "var(--ap-card)",
              border: "var(--ap-border-w) solid var(--ap-line)",
              borderRadius: "var(--ap-r-md)",
              boxShadow: "var(--ap-shadow-card)",
              overflow: "hidden",
            }}
          >
            {results.map((match) => (
              <button
                key={match.id}
                type="button"
                onClick={() => pick(match)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 10px",
                  background: "transparent",
                  border: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ap-ink)",
                  fontFamily: "var(--ap-font-body)",
                }}
              >
                @{match.username}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") invite(); }}
          placeholder={t("shareEmailPlaceholder")}
          type="email"
          style={{
            flex: 1,
            height: 34,
            padding: "0 10px",
            borderRadius: "var(--ap-r-md)",
            border: "var(--ap-border-w) solid var(--ap-line)",
            background: "var(--ap-paper-2)",
            color: "var(--ap-ink)",
            fontFamily: "var(--ap-font-body)",
            fontSize: 13,
          }}
        />
        <button
          type="button"
          onClick={invite}
          className="ap-btn ap-btn--sm"
        >
          {t("shareInviteByEmail")}
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npm run typecheck`
Expected: no new errors (component isn't consumed yet, but should type-check standalone).

- [ ] **Step 3: Commit**

```bash
git add apps/app/src/components/sharing/PersonPicker.tsx
git commit -m "feat(app): add PersonPicker (username search + email invite widget)"
```

---

### Task 9: `ShareCourseModal`

**Files:**
- Create: `apps/app/src/components/ShareCourseModal.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { t } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { PersonPicker } from "@/components/sharing/PersonPicker";
import {
  addContentShareByGroupId,
  addContentShareByUserId,
  addGroupMemberByUserId,
  createGroup,
  listContentShares,
  listGroupMembers,
  listGroups,
  removeContentShare,
  removeGroupMember,
  resolveContentShareByEmail,
  resolveGroupMemberByEmail,
  usernamesByIds,
  type ContentShare,
  type Group,
  type GroupMember,
  type UsernameMatch,
} from "@/lib/sharing/sharingRepo";

interface ShareCourseModalProps {
  contentId: string | null;
  courseTitle: string;
  onClose: () => void;
}

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
};

const panelStyle: React.CSSProperties = {
  width: "min(520px, 92vw)", maxHeight: "80vh", overflowY: "auto",
  background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)",
  borderRadius: "var(--ap-r-lg)", boxShadow: "var(--ap-shadow-card)", padding: 20,
};

const tabBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: "6px 14px", borderRadius: "var(--ap-r-pill)", border: "none", cursor: "pointer",
  fontSize: 13, fontWeight: 800, fontFamily: "var(--ap-font-body)",
  background: active ? "var(--ap-brand)" : "var(--ap-paper-2)",
  color: active ? "#fff" : "var(--ap-ink)",
});

const rowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
  borderBottom: "var(--ap-border-w) solid var(--ap-line)",
};

export const ShareCourseModal = ({ contentId, courseTitle, onClose }: ShareCourseModalProps) => {
  const user = getCurrentUser();
  const [tab, setTab] = useState<"people" | "groups">("people");
  const [shares, setShares] = useState<ContentShare[]>([]);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<Record<string, GroupMember[]>>({});

  const reloadShares = (id: string) => {
    listContentShares(id).then((rows) => {
      setShares(rows);
      const ids = rows.map((r) => r.shared_with_user_id).filter((v): v is string => !!v);
      if (ids.length) usernamesByIds(ids).then((matches) => {
        setUsernames(Object.fromEntries(matches.map((m) => [m.id, m.username])));
      });
    });
  };

  const reloadGroups = () => {
    if (!user) return;
    listGroups(user.id).then(setGroups);
  };

  useEffect(() => {
    if (!contentId) return;
    reloadShares(contentId);
    reloadGroups();
  }, [contentId]);

  if (!contentId) return null;

  const sharedGroupIds = new Set(shares.map((s) => s.shared_with_group_id).filter(Boolean));

  const handlePickUsername = (match: UsernameMatch) => {
    addContentShareByUserId(contentId, match.id).then(() => reloadShares(contentId));
  };
  const handleInviteEmail = (email: string) => {
    resolveContentShareByEmail(contentId, email).then(() => reloadShares(contentId));
  };
  const handleRemoveShare = (shareId: string) => {
    removeContentShare(shareId).then(() => reloadShares(contentId));
  };

  const toggleGroupShare = (group: Group, shared: boolean) => {
    if (shared) {
      addContentShareByGroupId(contentId, group.id).then(() => reloadShares(contentId));
    } else {
      const share = shares.find((s) => s.shared_with_group_id === group.id);
      if (share) removeContentShare(share.id).then(() => reloadShares(contentId));
    }
  };

  const handleCreateGroup = () => {
    if (!user || !newGroupName.trim()) return;
    createGroup(user.id, newGroupName.trim()).then((group) => {
      setNewGroupName("");
      reloadGroups();
      setExpandedGroupId(group.id);
    });
  };

  const loadMembers = (groupId: string) => {
    listGroupMembers(groupId).then((members) => {
      setGroupMembers((prev) => ({ ...prev, [groupId]: members }));
    });
  };

  const toggleExpandGroup = (groupId: string) => {
    const next = expandedGroupId === groupId ? null : groupId;
    setExpandedGroupId(next);
    if (next) loadMembers(next);
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h2 className="ap-h3" style={{ fontSize: 16 }}>{t("shareManageAccess")}</h2>
            <p className="ap-muted" style={{ fontSize: 12 }}>{courseTitle}</p>
          </div>
          <button type="button" onClick={onClose} className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn" aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button type="button" style={tabBtnStyle(tab === "people")} onClick={() => setTab("people")}>{t("sharePeopleTab")}</button>
          <button type="button" style={tabBtnStyle(tab === "groups")} onClick={() => setTab("groups")}>{t("shareGroupsTab")}</button>
        </div>

        {tab === "people" ? (
          <div>
            <PersonPicker onPickUsername={handlePickUsername} onInviteEmail={handleInviteEmail} />
            <div style={{ marginTop: 16 }}>
              {shares.filter((s) => s.shared_with_user_id || s.pending_email).length === 0 ? (
                <p className="ap-muted" style={{ fontSize: 13 }}>{t("shareNoShares")}</p>
              ) : (
                shares
                  .filter((s) => s.shared_with_user_id || s.pending_email)
                  .map((share) => (
                    <div key={share.id} style={rowStyle}>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>
                        {share.shared_with_user_id
                          ? `@${usernames[share.shared_with_user_id] ?? "…"}`
                          : share.pending_email}
                      </span>
                      {share.pending_email && !share.shared_with_user_id && (
                        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--ap-muted)" }}>{t("sharePending")}</span>
                      )}
                      <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" onClick={() => handleRemoveShare(share.id)}>
                        {t("shareRemove")}
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateGroup(); }}
                placeholder={t("shareGroupNamePlaceholder")}
                style={{
                  flex: 1, height: 34, padding: "0 10px", borderRadius: "var(--ap-r-md)",
                  border: "var(--ap-border-w) solid var(--ap-line)", background: "var(--ap-paper-2)",
                  color: "var(--ap-ink)", fontFamily: "var(--ap-font-body)", fontSize: 13,
                }}
              />
              <button type="button" className="ap-btn ap-btn--sm" onClick={handleCreateGroup}>{t("shareCreateGroup")}</button>
            </div>

            {groups.map((group) => (
              <div key={group.id} style={{ marginBottom: 8 }}>
                <div style={rowStyle}>
                  <input
                    type="checkbox"
                    checked={sharedGroupIds.has(group.id)}
                    onChange={(e) => toggleGroupShare(group, e.target.checked)}
                  />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{group.name}</span>
                  <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" onClick={() => toggleExpandGroup(group.id)}>
                    {t("shareManageMembers")}
                  </button>
                </div>
                {expandedGroupId === group.id && (
                  <div style={{ paddingLeft: 24, paddingTop: 8 }}>
                    <PersonPicker
                      onPickUsername={(match) => addGroupMemberByUserId(group.id, match.id).then(() => loadMembers(group.id))}
                      onInviteEmail={(email) => resolveGroupMemberByEmail(group.id, email).then(() => loadMembers(group.id))}
                    />
                    <div style={{ marginTop: 8 }}>
                      {(groupMembers[group.id] ?? []).map((member) => (
                        <div key={member.id} style={rowStyle}>
                          <span style={{ flex: 1, fontSize: 13 }}>
                            {member.pending_email ?? member.user_id}
                          </span>
                          <button
                            type="button"
                            className="ap-btn ap-btn--ghost ap-btn--sm"
                            onClick={() => removeGroupMember(member.id).then(() => loadMembers(group.id))}
                          >
                            {t("shareRemove")}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/app/src/components/ShareCourseModal.tsx
git commit -m "feat(app): add ShareCourseModal (people + groups tabs)"
```

## Context

`member.user_id` is shown raw (a uuid) rather than a resolved username in the groups-tab member list, unlike the people-tab share list which resolves via `usernamesByIds`. This is a known, acceptable trim for this task — resolving it would mean fetching usernames per-expanded-group too; if it reads as a rough edge in review, it's fine to add (mirror the people-tab's `usernames` state pattern, scoped per group), just don't treat it as a blocking spec gap on its own.

---

### Task 10: Wire into `MyCourses.tsx`

**Files:**
- Modify: `apps/app/src/pages/MyCourses.tsx`

- [ ] **Step 1: Add the import and modal state**

Add to the imports:

```typescript
import { CourseGeneratorModal } from "@/components/CourseGeneratorModal";
import { ShareCourseModal } from "@/components/ShareCourseModal";
```

In the `MyCourses` component, alongside `const [generatorOpen, setGeneratorOpen] = useState(false);`:

```typescript
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [manageAccessTarget, setManageAccessTarget] = useState<{ contentId: string; title: string } | null>(null);
```

- [ ] **Step 2: Pass a handler down to the card/row components**

`CourseCard`/`CourseRow` currently receive `d` (the `ContentDisplay`, which has `.id` — the Supabase row id needed for `content_shares.content_id`) and `course` (derived from `d.data`, which has the *local* id used for routing — do not confuse the two). Update `CourseItemProps` and both render functions:

```typescript
interface CourseItemProps {
  d: ContentDisplay;
  ctx: ItemCtx;
  navigate: ReturnType<typeof useNavigate>;
  userId: string | undefined;
  onManageAccess: (contentId: string, title: string) => void;
}
```

In `CourseCard` and `CourseRow`, add `onManageAccess` to the destructured props, and wire it into `CourseContextMenu`:

```typescript
function CourseCard({ d, ctx, navigate, userId, onManageAccess }: CourseItemProps) {
```
```typescript
function CourseRow({ d, ctx, navigate, userId, onManageAccess }: CourseItemProps) {
```

Both `<CourseContextMenu ... />` call sites (in `CourseCard` and `CourseRow`) get one more prop:

```tsx
          <CourseContextMenu
            course={course}
            onEdit={() => navigate(`/course-builder?courseId=${course.id}`)}
            onDuplicate={ctx.onDuplicate}
            onToggleFavorite={ctx.onFavorite}
            onShare={() => shareCourse(course)}
            onManageAccess={() => onManageAccess(d.id, course.title)}
            onTrash={ctx.onTrash}
          />
```

- [ ] **Step 3: Pass the handler from `MyCourses` and render the modal**

Update the `renderCard`/`renderRow` calls and add the modal:

```tsx
        renderCard={(d, ctx) => <CourseCard d={d} ctx={ctx} navigate={navigate} userId={user?.id} onManageAccess={(contentId, title) => setManageAccessTarget({ contentId, title })} />}
        renderRow={(d, ctx) => <CourseRow d={d} ctx={ctx} navigate={navigate} userId={user?.id} onManageAccess={(contentId, title) => setManageAccessTarget({ contentId, title })} />}
      />
      <CourseGeneratorModal open={generatorOpen} onClose={() => { setGeneratorOpen(false); reloadRef.current?.(); }} />
      <ShareCourseModal
        contentId={manageAccessTarget?.contentId ?? null}
        courseTitle={manageAccessTarget?.title ?? ""}
        onClose={() => setManageAccessTarget(null)}
      />
```

(The closing `</>` and rest of the file are unchanged — this replaces the existing `<ContentExplorer .../>` closing tag through the end of the returned JSX.)

- [ ] **Step 4: Typecheck**

Run: `cd apps/app && npm run typecheck`
Expected: no errors — this also resolves the temporary `onManageAccess` errors from Task 7.

- [ ] **Step 5: Build**

Run: `cd apps/app && npm run build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/pages/MyCourses.tsx
git commit -m "feat(app): wire ShareCourseModal into MyCourses via CourseContextMenu"
```

---

### Task 11: Sidebar nav item + route

**Files:**
- Modify: `apps/app/src/components/AppSidebar.tsx`
- Modify: `apps/app/src/App.tsx`

- [ ] **Step 1: Add the nav item**

In `apps/app/src/components/AppSidebar.tsx`, add `Share2` to the `lucide-react` import and add a new entry to `NAV_ITEMS` (placed first, so it's the top item — visible right under the "Créer"/Dashboard block):

```typescript
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  ClipboardList,
  Compass,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Library,
  Plus,
  Presentation,
  Settings,
  Share2,
  Users,
  X,
} from "lucide-react";
```

```typescript
const NAV_ITEMS = [
  { label: t("navSharedWithMe"), icon: Share2, path: "/shared-with-me", requiresAuth: true },
  { label: t("questionBank"), icon: Library, path: "/question-bank", requiresAuth: true },
  { label: t("discoverPublic"), icon: Compass, path: "/discover", requiresAuth: false },
  { label: t("footerCommunity"), icon: Users, path: "/community", requiresAuth: false },
  { label: t("settings"), icon: Settings, path: "/profile", requiresAuth: true },
];
```

- [ ] **Step 2: Add the route**

In `apps/app/src/App.tsx`, find the lazy-loaded page imports (`const Dashboard = lazy(() => import("./pages/Dashboard"));` and similar) and add:

```typescript
const SharedWithMe = lazy(() => import("./pages/SharedWithMe"));
```

Find `<Route path="/dashboard" element={<Dashboard />} />` and add right after it:

```tsx
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/shared-with-me" element={<SharedWithMe />} />
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/app && npm run typecheck`
Expected: fails until Task 12 creates `./pages/SharedWithMe` — that's expected at this point, same incremental-delivery note as Task 7. Confirm the only error is the missing module.

- [ ] **Step 4: Commit**

```bash
git add apps/app/src/components/AppSidebar.tsx apps/app/src/App.tsx
git commit -m "feat(app): add Partagés avec moi nav item and route"
```

---

### Task 12: `SharedWithMe.tsx` page

**Files:**
- Create: `apps/app/src/pages/SharedWithMe.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { listSharedWithMe } from "@/lib/sharing/sharingRepo";
import type { ContentRow } from "@/lib/content/types";

const SharedWithMe = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [courses, setCourses] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    listSharedWithMe(user.id)
      .then(setCourses)
      .finally(() => setLoading(false));
  }, [user?.id]);

  return (
    <AppLayout subtitle={t("navSharedWithMe")}>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div style={{ marginBottom: "32px" }}>
          <h1 className="ap-h2" style={{ fontSize: "26px", marginBottom: "4px" }}>{t("navSharedWithMe")}</h1>
          <p className="ap-muted" style={{ fontSize: "14px" }}>{t("sharedWithMeSubtitle")}</p>
        </div>

        {!loading && courses.length === 0 && (
          <p className="ap-muted" style={{ fontSize: 14 }}>{t("sharedWithMeEmpty")}</p>
        )}

        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {courses.map((row) => {
            const title = typeof row.data?.title === "string" ? row.data.title : "";
            const description = typeof row.data?.description === "string" ? row.data.description : "";
            const sourceId = row.source_id ?? row.id;
            return (
              <div
                key={row.id}
                className="ap-card ap-card--hover cursor-pointer p-5"
                onClick={() => navigate(`/course/${sourceId}`)}
              >
                <GraduationCap style={{ width: 28, height: 28, color: "var(--ap-pres)", marginBottom: 8 }} />
                <h3 className="ap-h3 line-clamp-2" style={{ fontSize: 15 }}>{title}</h3>
                {description && <p className="ap-muted mt-1 text-sm line-clamp-2">{description}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default SharedWithMe;
```

- [ ] **Step 2: Typecheck and build**

Run: `cd apps/app && npm run typecheck && npm run build`
Expected: both succeed — this also resolves Task 11's expected temporary error.

- [ ] **Step 3: Run the full test suite**

Run: `cd apps/app && npx vitest run`
Expected: all tests pass, no regressions.

- [ ] **Step 4: Manual check**

Run: `cd apps/app && npm run dev`. As a course owner, share a course with a second test account (by username or email) via "Gérer l'accès" from a course card's `⋯` menu. Log in as that second account, confirm the course appears under "Partagés avec moi" in the sidebar, and that clicking it opens `/course/:id` successfully (not "Cours introuvable"). This step needs the Task 1 migration actually applied to whatever Supabase project the dev server points at — if it isn't, note that in the report rather than guessing at the result.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/pages/SharedWithMe.tsx
git commit -m "feat(app): add SharedWithMe page"
```

## Context

`row.source_id ?? row.id` for the route: mirrored course rows always have `source_id` set (the local `Course.id` used for routing, per Task 3's `upsertContentBySource(user.id, 'course', saved.id, ...)`), but falling back to `row.id` keeps this defensive rather than crashing if a row is ever missing it. `CourseViewer.tsx`'s Task 4 fallback resolves by `source_id`, which is exactly what gets passed here.

---

## Self-Review Notes

- **Spec coverage:** prerequisite mirror/fallback → Tasks 2–4; schema/RLS/functions → Task 1; i18n → Task 5; data layer → Task 6; creator UI (people + groups tabs, inline group creation, member management) → Tasks 7–10; invitee UI (`SharedWithMe`, nav, route) → Tasks 11–12. `CourseBuilder.tsx` toolbar entry point was explicitly trimmed from the spec's UI section in favor of the `CourseContextMenu` path only — flagged to the user before planning, not a silent gap.
- **Placeholders:** none — every step has real code or an exact command. Two tasks (7, 11) have an intentionally-expected transient typecheck failure until a later task lands; both are called out explicitly so an implementer doesn't mistake it for a bug in their own work.
- **Type consistency:** `ContentShare`/`Group`/`GroupMember`/`UsernameMatch` (Task 6) are the single source of truth for these shapes, reused verbatim by `PersonPicker` (Task 8), `ShareCourseModal` (Task 9), and `SharedWithMe` (Task 12) — no redefinition. `d.id` (Supabase row id, used for `content_shares.content_id`) vs `course.id` (legacy local id, used for routing) distinction is called out explicitly in Task 10 to prevent the implementer from wiring the wrong one.
