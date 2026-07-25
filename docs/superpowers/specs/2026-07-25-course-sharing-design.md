# Course sharing (invite users/groups) — design

## Problem
A course creator can only make a course fully public (`is_public`) or fully private (owner-only). There's no way to grant view/follow access to a specific set of people (e.g. one class) without publishing the course to everyone.

## Scope
Course creators can share a course with individual users (by username search or exact email) or with reusable named groups of users. Shared users get **read/view access only** (can open and follow the course, cannot edit it). Scoped to `type = 'course'` content only — not quizzes/polls/etc.

## Data model

New migration (`supabase/migrations/<timestamp>_course_sharing.sql`), following this repo's existing pattern (see `supabase/migrations/20260713120000_content_and_folders.sql`, `20260716120000_pages_cms_foundation.sql`):

```sql
alter table public.profiles add column username text unique;

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
```

`handle_new_user()` (existing signup trigger in `20260716120000_pages_cms_foundation.sql`) is extended (via `create or replace function`) to, on new-row insert:
1. Copy `new.raw_user_meta_data->>'username'` into the new `profiles.username` (same insert, no extra round trip).
2. Resolve pending invites: `update group_members set user_id = new.id, pending_email = null where pending_email = new.email`, same for `content_shares`.

## Backend (RLS + functions)

- `groups` / `group_members`: owner-only CRUD, same shape as the existing `folders_owner`/`content_owner` "for all" policies (`owner_id = auth.uid()` / via a join to `groups.owner_id` for `group_members`).
- `content_shares`: the course owner (checked via a join to `content.user_id = auth.uid()`) manages rows for their own content. A user may also `select` rows where `shared_with_user_id = auth.uid()` (needed so `SharedWithMe.tsx` can list what's shared with them).
- `content`'s existing `content_public_read` policy (`is_public = true or is_open = true`) gets one more `or` clause:
  ```sql
  or exists (
    select 1 from public.content_shares cs
    where cs.content_id = content.id
      and (cs.shared_with_user_id = auth.uid()
           or cs.shared_with_group_id in (select group_id from public.group_members where user_id = auth.uid()))
  )
  ```
- `search_profiles_by_username(prefix text) returns table(id uuid, username text)` — `security definer`, same pattern as the existing `is_admin()` function. Case-insensitive prefix match (`where username ilike prefix || '%'`), limit 10, excludes `auth.uid()` itself. This is the only way the client ever reads another user's identity — no raw `profiles` select policy is added for other users' rows.
- `resolve_content_share(p_content_id uuid, p_email text)` — `security definer`. Verifies the caller owns `p_content_id` (raises if not), looks up `auth.users` by email (client can never query `auth.users` directly), inserts a `content_shares` row with `shared_with_user_id` if found, else `pending_email`. Returns the inserted row (or its resolved/pending state) so the UI can show "en attente".
- `resolve_group_member(p_group_id uuid, p_email text)` — same shape, for `group_members`, verifies caller owns the group.

Both `search_profiles_by_username` and the two `resolve_*` functions are the only new server-side surface; everything else (listing shares, listing groups, removing a share/member, adding by resolved user id from the username search) goes through normal RLS-gated table CRUD via `supabase-js`.

## UI — sharing (creator side)

- `apps/app/src/components/CourseContextMenu.tsx`: new menu item "Gérer l'accès" (`Users` icon from lucide-react), alongside the existing "Partager" (copy-link, unchanged) item. New `onManageAccess` prop.
- New `apps/app/src/components/ShareCourseModal.tsx`, opened from `MyCourses.tsx` (new `manageAccessCourseId` state, same pattern as how `CourseGeneratorModal`'s open state is already managed in that file) and from `CourseBuilder.tsx`'s toolbar (a "Gérer l'accès" button, course must already be saved — i.e. have an id — to share it).
  - Two tabs: **Personnes** and **Groupes**.
  - Personnes tab: a search input (debounced, same 300ms pattern as `GlobalSearch.tsx`) calling `search_profiles_by_username`, results shown as a dropdown to click-to-add; below it, a plain text input + "Inviter par email" button calling `resolve_content_share`. Below both: the current share list (`content_shares` rows for this course, resolved via a join to get usernames) each with a remove (×) button; pending rows show an "en attente" badge instead of a username.
  - Groupes tab: checkbox list of the owner's `groups` (checked = shared), toggling calls insert/delete on `content_shares`. An inline "+ Nouveau groupe" opens a small inline form (name input) that creates the group, then lets the owner add members to it using the same username-search/email-invite UI as the Personnes tab (reused as a small shared sub-component, `PersonPicker`).

## UI — viewing shared courses (invitee side)

- New sidebar nav item "Partagés avec moi" in `apps/app/src/components/AppSidebar.tsx`'s `NAV_ITEMS` (auth-required, between Dashboard and the "Mes créations" group — placed where it's visible but not competing with the creator-focused items), route `/shared-with-me`.
- New `apps/app/src/pages/SharedWithMe.tsx`: flat card list (no folders/trash/favorites — simpler than `ContentExplorer`), querying `content_shares` rows where `shared_with_user_id = me` OR `shared_with_group_id in (my groups)`, joined to `content` (`type = 'course'`) for title/description. Each card links to the existing `/course/:courseId` route (`CourseViewer.tsx`) — **no changes needed to `CourseViewer.tsx`**, since the RLS extension above already makes `getContent()` succeed for shared users.

## Out of scope (explicitly not building)
- Editing shared courses — view-only, confirmed.
- Sharing content types other than `course`.
- Group membership visibility for members ("you're in group X").
- Email/push notifications when something is shared.
- Un-sharing cascades or audit log of share history.
- Removing `username` uniqueness edge cases beyond a DB `unique` constraint + a friendly error surfaced on conflict (no separate "check availability" endpoint).

## Testing
- Unit tests for any new pure mapping/shaping functions (e.g. turning `content_shares` + `content` join rows into display cards for `SharedWithMe.tsx`), following the `mapSearchRows`-style pattern from the global-search feature.
- RLS is exercised manually against a Supabase project (this codebase has no RLS integration test harness today — consistent with how `content_public_read`/`exam_attempts_*` policies were validated when added).
- Manual: as course owner, share with a second test account by username, confirm that account sees the course under "Partagés avec moi" and can open it; share by email for an account that doesn't exist yet, sign up with that email, confirm it appears afterward; create a group, add a member, share a course with the group, confirm the member sees it.

## Deployment note
Per project history, prod Supabase schema changes are applied by hand via the Management API (port 5432 is firewalled) rather than a tracked migration pipeline — this migration file should be written the same way as the existing ones in `supabase/migrations/`, but actually applying it to prod is a separate, explicit deploy step the user drives (not something to do silently as part of "finishing the branch").
