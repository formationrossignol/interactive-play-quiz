# SCORM support — design

Date: 2026-07-28
Status: approved, pending implementation plan

## Scope

Add SCORM 1.2 and SCORM 2004 package support as a new Lesson type inside the
existing Course/Module/Lesson system. Five parts, built in this order:

1. Import of SCORM 1.2 packages
2. Import of SCORM 2004 packages
3. Content display (playback)
4. Score / progress / time tracking
5. Reporting for course owners

**Explicit scope limits** (agreed during brainstorming):
- Single-SCO packages only. Multi-SCO manifests are parsed but only the
  default organization's first `<item>` is launched; no SCORM 2004
  sequencing/navigation engine.
- No CSV export in this iteration — reporting is in-app only.
- `cmi.interactions` are captured and stored, but there is no dedicated
  detail UI for them yet (future work).

## Why a Lesson type, not a new top-level entity

SCORM content is consumed the same way as the existing `document`/`video`/
`iframe` lesson types: embedded inside a Module, inside a Course, with
progress tracked per learner. Reusing `Module`/`Course`/`CourseProgress`
avoids duplicating course structure, favoriting, folders, and sharing that
already exist for courses.

## Data model

### `Lesson` type extension (`apps/app/src/lib/courseStorage.ts`)

```ts
type: 'text' | 'quiz' | 'poll' | 'flashcard' | 'document' | 'video' | 'iframe' | 'file-upload' | 'scorm';
scormPackageId?: string;   // storage path segment, see below
scormVersion?: '1.2' | '2004';
scormLaunchPath?: string;  // relative path to the launch file inside the package
scormTitle?: string;       // title read from imsmanifest.xml, used as default lesson title
```

No migration needed here — `Lesson` lives inside `content.data` (jsonb, type
`'course'`), per the existing polymorphic `content` table
(`supabase/migrations/20260713120000_content_and_folders.sql`).

### New table `scorm_tracking`

One row per `(user_id, course_id, lesson_id)`, upserted each session — same
shape as `CourseProgress`, not an attempt-history log.

```sql
create table public.scorm_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.content(id) on delete cascade,
  lesson_id text not null,
  scorm_version text not null check (scorm_version in ('1.2','2004')),
  lesson_status text,          -- 1.2: cmi.core.lesson_status
  completion_status text,      -- 2004: cmi.completion_status
  success_status text,         -- 2004: cmi.success_status
  score_raw numeric,
  score_min numeric,
  score_max numeric,
  score_scaled numeric,
  progress_measure numeric,
  total_time text,             -- accumulated, SCORM time-interval format
  suspend_data text,           -- resume state, opaque to us
  entry text,
  exit text,
  attempt_count integer not null default 1,
  interactions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, course_id, lesson_id)
);

create index scorm_tracking_course_idx on public.scorm_tracking(course_id);

alter table public.scorm_tracking enable row level security;

create policy scorm_tracking_owner on public.scorm_tracking
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy scorm_tracking_course_owner_read on public.scorm_tracking
  for select using (
    exists (select 1 from public.content c
            where c.id = course_id and c.user_id = auth.uid())
  );
```

### New Storage bucket `scorm-packages`

Same pattern as `presentation-media`
(`supabase/migrations/20260723120000_presentation_media_bucket.sql`):
public read, owner-only write, path convention `<user_id>/<packageId>/…`.

## Import pipeline

New `apps/app/src/lib/scormImport.ts`. Triggered from a new "Ajouter leçon
SCORM" action in the course/module editor (`.zip` file input).

1. Parse the `.zip` client-side with JSZip.
2. Read and parse `imsmanifest.xml`. Reject with an inline error if missing.
3. Detect version from manifest namespace/schemaversion:
   - `adlcp_rootv1p2` → `'1.2'`
   - `adlcp_v1p3` / schemaversion containing `2004` → `'2004'`
4. Walk the default `<organization>` → first `<item identifierref="…">` →
   resolve the matching `<resource href="…">` as the launch file. Reject
   with an inline error if no resolvable resource is found.
5. Upload every file extracted from the zip to
   `scorm-packages/<user_id>/<packageId>/<relative_path>` (packageId =
   generated id, same `genId()` used elsewhere in `courseStorage.ts`).
6. Return `{ packageId, version, launchPath, title }`, written onto the new
   `Lesson`.

## Playback runtime

### The cross-origin constraint

SCORM content finds its runtime API by walking `window.parent` (and
`window.opener`) looking for an object named `API` (1.2) or `API_1484_11`
(2004) — the standard "FindAPI" algorithm every SCORM package ships with.
Browsers block that walk across origins. Since package files are hosted on
Supabase Storage (a different origin than the app), serving them directly
would silently break every SetValue/Commit call — the SCO would fail to
find the API and run with no tracking at all, with no visible error.

### Fix: same-origin proxy

A Vercel rewrite, `/scorm-content/:userId/:packageId/*` →
`https://lwwfgdebmggxjuvlazwf.supabase.co/storage/v1/object/public/scorm-packages/:userId/:packageId/*`.
Pure HTTP passthrough, no server code. This also fixes relative
links/assets inside multi-page SCOs, since they resolve against the
same-origin proxy path instead of the Storage host.

### `ScormPlayer.tsx` (new component)

- Renders `<iframe src="/scorm-content/<user_id>/<packageId>/<launchPath>">`.
- Before mount, sets `window.API` (1.2) or `window.API_1484_11` (2004) —
  whichever matches `scormVersion` — on the app's own top window.
- API shim implements, backed by in-memory CMI state:
  - 1.2: `LMSInitialize`, `LMSGetValue`, `LMSSetValue`, `LMSCommit`,
    `LMSFinish`, `LMSGetLastError`.
  - 2004: `Initialize`, `GetValue`, `SetValue`, `Commit`, `Terminate`,
    `GetLastError`.
  - `SetValue` calls on `cmi.interactions.n.*` accumulate into the
    `interactions` array.
- Session timer starts at Initialize; accumulates into `total_time` on
  each Commit.
- Persists to `scorm_tracking` (upsert) on Commit, on Terminate/Finish, on
  `beforeunload`, and on a 30s autosave interval as a safety net against
  crashed/killed tabs.

## Reporting

New "Reporting" tab on the course management view, owner-only, reading
`scorm_tracking` filtered by `course_id`:

- **Aggregate card** per SCORM lesson: completion rate, average score,
  average time spent.
- **Per-learner table**: learner name, status (not started / in progress /
  completed / passed / failed), score, time spent, attempt count, last
  accessed. Same visual pattern as the existing MyExams/MyQuizzes results
  tables.

## Testing

- Unit: manifest parsing (version detection, launch-resource resolution)
  against fixture manifests for both versions, including malformed/missing
  manifest cases.
- Unit: API shim state machine (Initialize before Terminate, GetValue
  defaults, error codes on invalid calls).
- Integration: import → playback → tracking upsert round-trip against a
  small real SCORM 1.2 and SCORM 2004 test package.
- RLS: course owner can read other learners' `scorm_tracking` rows for
  their own course; cannot read rows for courses they don't own.
