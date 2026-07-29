# Org + RBAC foundation — design spec

Date: 2026-07-29
Status: approved (design), not yet planned/implemented

## Context

The long-term goal is a full user-profile-management system with 5 personas
(Apprenant, Formateur, Responsable pédagogique, Gestionnaire de scolarité,
Administrateur d'établissement). That ask bundles multiple independent
subsystems and is too large for a single spec. This document covers only the
**foundation sub-project**: multi-tenant org structure + cumulative role model
+ retrofitting existing content tables into it. Everything else (scolarité
domain, pédago reporting, SSO/SCIM/branding, per-persona UI gating) is a
separate future sub-project and explicitly out of scope here.

Today's role system is a single global flag: `profiles.role` (`user` |
`admin`), added in the pages-cms migration
(`supabase/migrations/20260716120000_pages_cms_foundation.sql`). That flag is
unrelated to this feature (it gates the marketing/site CMS) and is **not**
touched by this work.

## Goals

- Multi-tenant: distinct organizations ("établissements"), each with its own
  members and content.
- A user can hold multiple roles, across multiple orgs (many-to-many).
- Existing single-tenant content (quizzes, exams, folders, etc.) becomes
  correctly org-scoped with no data loss and no manual intervention.
- Self-serve org creation on signup; admin-driven email invitations to add
  members afterward.

## Non-goals (deferred to future sub-projects)

- Scolarité domain: promotions, groupes pédagogiques, absences, relevés,
  jurys.
- Pédago piloting/reporting dashboards.
- Admin établissement enterprise features: SSO, SCIM, branding, audit log.
- Per-persona UI feature gating (e.g. hiding "create exam" from learners).
  This spec makes the data layer correct; UI continues to behave as today.

## Data model

```sql
organizations
  id          uuid primary key default gen_random_uuid()
  name        text not null
  slug        text not null unique
  created_at  timestamptz not null default now()

user_org_roles                          -- many-to-many: user × org × role
  id          uuid primary key default gen_random_uuid()
  user_id     uuid not null references auth.users(id) on delete cascade
  org_id      uuid not null references organizations(id) on delete cascade
  role        text not null check (role in ('learner','trainer','pedago','registrar','admin'))
  created_at  timestamptz not null default now()
  unique (user_id, org_id, role)

org_invitations
  id          uuid primary key default gen_random_uuid()
  org_id      uuid not null references organizations(id) on delete cascade
  email       text not null
  role        text not null check (role in ('learner','trainer','pedago','registrar','admin'))
  invited_by  uuid not null references auth.users(id)
  token       uuid not null default gen_random_uuid() unique
  status      text not null default 'pending' check (status in ('pending','accepted','revoked','expired'))
  expires_at  timestamptz not null default (now() + interval '7 days')
  created_at  timestamptz not null default now()
```

`profiles.role` is untouched; org-scoped authorization never reads it.

## Permission function

Mirrors the existing `is_admin()` pattern:

```sql
create or replace function public.has_org_role(p_org_id uuid, p_roles text[])
returns boolean language sql stable set search_path = public as $$
  select exists (
    select 1 from public.user_org_roles
    where user_id = auth.uid() and org_id = p_org_id and role = any(p_roles)
  );
$$;
```

Used in RLS policies on org-scoped tables, e.g.:

```sql
create policy exams_write on public.exams
  for insert with check (has_org_role(org_id, array['trainer','pedago','admin']));
```

## Signup / org creation / invite flow

**New org signup:** existing Supabase auth signup, then a "create your
establishment" step (name → slug) creates the `organizations` row and a
`user_org_roles` row with `role = 'admin'` for that user. No manual
provisioning step.

**Invited signup:** invite link is `/invite/:token`. If the recipient has no
account, they sign up first via the existing flow, then the token is
consumed: insert `user_org_roles(org_id, role)` from the invitation row, mark
it `accepted`. If they already have an account, accepting just inserts the
`user_org_roles` row (adds a role in that org without creating a duplicate
account).

**Invite creation:** a user with `has_org_role(org_id, ['admin','pedago'])`
enters an email + role in an invite-management screen → insert
`org_invitations` row → edge function `send-org-invitation` sends the link
via Resend, mirroring `supabase/functions/send-welcome-email` (same
`RESEND_API_KEY` / `RESEND_FROM_EMAIL` env vars, same "Brivia" from-name).

**Multi-org membership / active org:** a user's active org is client-side
state only (`currentOrgId`, e.g. in a URL param or local storage), not a
server session concept. RLS never depends on it — every row already carries
its own `org_id` and policies check membership via `user_org_roles`
directly. An org switcher UI lets users with >1 org pick which one they're
viewing.

## Existing-content retrofit

**Bootstrap migration** (idempotent, mirrors the retry-safe pattern used in
`20260728160000_exam_scoring_tier2.sql`):

1. Create tables above.
2. Insert one bootstrap org: `name = 'Brivia'`, `slug = 'brivia'`.
3. For every existing `auth.users` row, insert
   `user_org_roles(org_id = brivia.id, role = 'admin')` — every current user
   becomes an admin of the bootstrap org (today there's no role
   differentiation to preserve, so this is the only non-lossy default).
4. Add `org_id uuid references organizations(id)` (nullable) to each table
   listed below, backfill every row to the bootstrap org's id, then alter to
   `not null`.

**Tables getting `org_id`** (indexed, `not null`, FK → organizations):
`content`, `folders`, `exams`, `exam_attempts`, `quiz_attempts`,
`content_shares`, `manual_evaluations`, `manual_evaluation_groups`,
`manual_grades`, `notifications`, `notification_preferences`.

**Rename:** `groups` → `share_groups`, `group_members` →
`share_group_members` (frees the `groups` name for the future scolarité
"groupe pédagogique" concept; updates FKs, RLS policy names, and any
application code/types referencing the old names).

**RLS rewrite:** every existing policy on the tables above gets an
`org_id`-aware clause — either `and org_id = <value>` alongside the current
owner check, or a `has_org_role(org_id, array[...])` check where the action
should be role-gated (e.g. exam creation restricted to
trainer/pedago/admin). Read policies stay permissive within the org unless
already owner-restricted today.

## Application-layer scope

- Signup flow: add "create establishment" step for new orgs; consume
  `?invite=token` for invited signups.
- Invite-management screen (admin/pédago only): list pending invitations,
  create new ones (email + role), revoke.
- Org switcher: shown only when a user belongs to >1 org.
- Any new loading state in these screens uses the existing skeleton system
  (`ListSkeleton` for invite lists, `Button` `loading` prop for
  invite/accept actions) per project CLAUDE.md — no spinners, no
  "Loading…" text.
- Existing quiz/exam/content UI is otherwise unchanged; it keeps working
  because every user still has exactly one org (the bootstrap org) until
  invites start diversifying membership.

## Testing

- RLS policy tests: cross-org isolation (user in org A cannot read/write org
  B's content), role-gated actions (learner cannot create exam), multi-role
  users (trainer-in-A + learner-in-B sees correct scoping in each).
- Migration idempotency: bootstrap migration re-runnable without duplicate
  orgs/roles (mirrors `exam_scoring_tier2` retry-safe pattern).
- Invite flow: token consumption is single-use, expired tokens rejected,
  accepting as an existing vs. new user both produce correct
  `user_org_roles` rows.
- Rename: verify no dangling references to `groups`/`group_members` remain
  in code or RLS after the rename.
