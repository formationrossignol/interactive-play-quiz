# SCORM Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SCORM 1.2 / SCORM 2004 package support as a new `'scorm'` Lesson type inside the existing Course/Module/Lesson system — import, playback, score/progress/time tracking, and per-course reporting for the owner.

**Architecture:** Packages are unzipped client-side (JSZip, already a dependency), their assets uploaded to a new public `scorm-packages` Storage bucket, and served back to the learner through a same-origin Vercel rewrite (`/scorm-content/...`) so the SCO's `window.parent` API lookup isn't blocked by cross-origin restrictions. A SCORM 1.2/2004 API shim is mounted on the app's own `window` before the iframe loads; it holds an in-memory CMI model and upserts to a new `scorm_tracking` Supabase table (one row per learner per lesson) on Commit/Terminate/unload. A new course-owner "Reporting" page reads that table, mirroring the existing `ExamAdmin.tsx` / `computeExamStats` pattern.

**Tech Stack:** React/Vite (`apps/app`), Supabase (Postgres + Storage + RLS), JSZip, Vitest, Vercel rewrites.

**Spec:** `docs/superpowers/specs/2026-07-28-scorm-support-design.md`

---

## Task 1: `scorm_tracking` table + RLS

**Files:**
- Create: `supabase/migrations/20260729120000_scorm_tracking.sql`

- [ ] **Step 1: Write the migration**

```sql
-- SCORM 1.2 / 2004 runtime tracking: one row per learner per lesson,
-- upserted each session (mirrors CourseProgress, not an attempt-history log).
-- See docs/superpowers/specs/2026-07-28-scorm-support-design.md.

create table public.scorm_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.content(id) on delete cascade,
  lesson_id text not null,
  scorm_version text not null check (scorm_version in ('1.2','2004')),
  lesson_status text,
  completion_status text,
  success_status text,
  score_raw numeric,
  score_min numeric,
  score_max numeric,
  score_scaled numeric,
  progress_measure numeric,
  total_time text,
  suspend_data text,
  entry text,
  exit text,
  attempt_count integer not null default 1,
  interactions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, course_id, lesson_id)
);

create index scorm_tracking_course_idx on public.scorm_tracking(course_id);

alter table public.scorm_tracking enable row level security;

-- Learner: full CRUD on their own row.
create policy scorm_tracking_owner on public.scorm_tracking
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Course owner: read-only access to every learner's row for their own course,
-- for the reporting page.
create policy scorm_tracking_course_owner_read on public.scorm_tracking
  for select using (
    exists (select 1 from public.content c
            where c.id = course_id and c.user_id = auth.uid())
  );
```

- [ ] **Step 2: Apply locally and verify**

Run: `cd supabase && supabase db reset` (or `supabase migration up` if you don't want a full reset)
Expected: migration applies with no errors; `\d scorm_tracking` in `supabase db psql` shows the table with the unique constraint and both RLS policies.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260729120000_scorm_tracking.sql
git commit -m "feat: add scorm_tracking table"
```

---

## Task 2: `scorm-packages` Storage bucket + RLS

**Files:**
- Create: `supabase/migrations/20260729130000_scorm_storage_bucket.sql`

- [ ] **Step 1: Write the migration**

Mirrors `supabase/migrations/20260723120000_presentation_media_bucket.sql` exactly, new bucket name and path convention `<user_id>/<packageId>/...` (bucket must be public — the Vercel rewrite in Task 11 fetches objects over plain HTTP with no auth header).

```sql
-- Storage bucket for imported SCORM package assets. Public read so the
-- Vercel same-origin rewrite (/scorm-content/...) can proxy objects without
-- an auth header. Path convention: <user_id>/<package_id>/<relative_path>.
insert into storage.buckets (id, name, public)
values ('scorm-packages', 'scorm-packages', true)
on conflict (id) do nothing;

create policy scorm_packages_owner_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'scorm-packages' and (storage.foldername(name))[1] = auth.uid()::text);

create policy scorm_packages_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'scorm-packages' and (storage.foldername(name))[1] = auth.uid()::text);

create policy scorm_packages_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'scorm-packages' and (storage.foldername(name))[1] = auth.uid()::text);

create policy scorm_packages_public_read on storage.objects
  for select using (bucket_id = 'scorm-packages');
```

- [ ] **Step 2: Apply locally and verify**

Run: `cd supabase && supabase db reset`
Expected: `select * from storage.buckets where id = 'scorm-packages';` returns one row with `public = true`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260729130000_scorm_storage_bucket.sql
git commit -m "feat: add scorm-packages storage bucket"
```

---

## Task 3: Extend `Lesson` type with SCORM fields

**Files:**
- Modify: `apps/app/src/lib/courseStorage.ts:4-16`
- Test: `apps/app/src/lib/__tests__/courseStorage.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `apps/app/src/lib/__tests__/courseStorage.test.ts` (append a new `describe` block):

```ts
describe('scorm lesson fields round-trip through a course', () => {
  it('persists scorm-specific fields on a lesson', () => {
    const created = createCourse({
      ...coursePayload(),
      modules: [{
        id: 'm1',
        title: 'Module 1',
        lessons: [{
          id: 'l1',
          title: 'SCORM lesson',
          content: '',
          type: 'scorm',
          scormPackageId: 'pkg-1',
          scormVersion: '1.2',
          scormLaunchPath: 'index_lms.html',
          scormTitle: 'Imported Course',
        }],
      }],
    });
    const lesson = getUserCourses(USER_ID)[0].modules[0].lessons[0];
    expect(lesson.type).toBe('scorm');
    expect(lesson.scormPackageId).toBe('pkg-1');
    expect(lesson.scormVersion).toBe('1.2');
    expect(lesson.scormLaunchPath).toBe('index_lms.html');
    expect(created.modules[0].lessons[0].scormTitle).toBe('Imported Course');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && npx vitest run src/lib/__tests__/courseStorage.test.ts -t "scorm lesson fields"`
Expected: FAIL — TypeScript error, `'scorm'` is not assignable to `Lesson["type"]` and the `scormPackageId`/etc. properties don't exist on `Lesson`.

- [ ] **Step 3: Extend the `Lesson` interface**

Edit `apps/app/src/lib/courseStorage.ts:4-16`:

```ts
export interface Lesson {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'quiz' | 'poll' | 'flashcard' | 'document' | 'video' | 'iframe' | 'file-upload' | 'scorm';
  linkedItemId?: string; // quiz/poll/flashcard: id of the linked saved_quizzes item
  estimatedMinutes?: number;
  documentName?: string;
  documentMimeType?: string;
  videoUrl?: string;
  videoType?: 'youtube' | 'url';
  iframeUrl?: string; // iframe: embedded page URL
  scormPackageId?: string;   // scorm: storage path segment under scorm-packages/<user_id>/<packageId>
  scormVersion?: '1.2' | '2004';
  scormLaunchPath?: string;  // scorm: relative path to the launch file inside the package
  scormTitle?: string;       // scorm: title read from imsmanifest.xml
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && npx vitest run src/lib/__tests__/courseStorage.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/lib/courseStorage.ts apps/app/src/lib/__tests__/courseStorage.test.ts
git commit -m "feat: add scorm fields to Lesson type"
```

---

## Task 4: SCORM manifest parsing (`scormManifest.ts`)

Pure parsing logic, kept separate from upload orchestration so it's testable without touching Supabase.

**Files:**
- Create: `apps/app/src/lib/scormManifest.ts`
- Test: `apps/app/src/lib/__tests__/scormManifest.test.ts`

- [ ] **Step 1: Write the failing test**

Build fixture manifests in-memory (same style as `presentationImport.test.ts`'s in-memory zip construction).

```ts
// apps/app/src/lib/__tests__/scormManifest.test.ts
import { describe, expect, it } from 'vitest';
import { parseScormManifest, ScormManifestError } from '../scormManifest';

const SCORM_12_MANIFEST = `<?xml version="1.0"?>
<manifest identifier="com.example.course" version="1"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG1">
    <organization identifier="ORG1">
      <title>Sample Course</title>
      <item identifier="ITEM1" identifierref="RES1"><title>Lesson 1</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES1" type="webcontent" adlcp:scormtype="sco" href="index_lms.html">
      <file href="index_lms.html"/>
    </resource>
  </resources>
</manifest>`;

const SCORM_2004_MANIFEST = `<?xml version="1.0"?>
<manifest identifier="com.example.course2004" version="1"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3">
  <metadata><schema>ADL SCORM</schema><schemaversion>2004 4th Edition</schemaversion></metadata>
  <organizations default="ORG1">
    <organization identifier="ORG1">
      <title>Sample 2004 Course</title>
      <item identifier="ITEM1" identifierref="RES1"><title>Lesson 1</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES1" type="webcontent" adlcp:scormType="sco" href="story.html">
      <file href="story.html"/>
    </resource>
  </resources>
</manifest>`;

describe('parseScormManifest', () => {
  it('detects SCORM 1.2 and resolves the launch file', () => {
    const result = parseScormManifest(SCORM_12_MANIFEST);
    expect(result.version).toBe('1.2');
    expect(result.launchPath).toBe('index_lms.html');
    expect(result.title).toBe('Sample Course');
  });

  it('detects SCORM 2004 and resolves the launch file', () => {
    const result = parseScormManifest(SCORM_2004_MANIFEST);
    expect(result.version).toBe('2004');
    expect(result.launchPath).toBe('story.html');
    expect(result.title).toBe('Sample 2004 Course');
  });

  it('throws ScormManifestError when there is no default organization', () => {
    const bad = SCORM_12_MANIFEST.replace('default="ORG1"', 'default="MISSING"');
    expect(() => parseScormManifest(bad)).toThrow(ScormManifestError);
  });

  it('throws ScormManifestError when the referenced resource is missing', () => {
    const bad = SCORM_12_MANIFEST.replace('identifier="RES1" type="webcontent"', 'identifier="OTHER" type="webcontent"');
    expect(() => parseScormManifest(bad)).toThrow(ScormManifestError);
  });

  it('throws ScormManifestError on malformed XML', () => {
    expect(() => parseScormManifest('<manifest><organizations>')).toThrow(ScormManifestError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && npx vitest run src/lib/__tests__/scormManifest.test.ts`
Expected: FAIL — `Cannot find module '../scormManifest'`.

- [ ] **Step 3: Implement `scormManifest.ts`**

```ts
// apps/app/src/lib/scormManifest.ts
export class ScormManifestError extends Error {}

export interface ScormManifestInfo {
  version: '1.2' | '2004';
  launchPath: string;
  title: string;
}

function detectVersion(doc: Document): '1.2' | '2004' {
  const schemaVersionEl = doc.getElementsByTagName('schemaversion')[0];
  const schemaVersion = schemaVersionEl?.textContent ?? '';
  if (/2004/.test(schemaVersion)) return '2004';
  if (/1\.2/.test(schemaVersion)) return '1.2';

  const manifestEl = doc.documentElement;
  const attrs = Array.from(manifestEl.attributes).map((a) => a.value).join(' ');
  if (/adlcp_v1p3|adlcp_v1p4/.test(attrs)) return '2004';
  if (/adlcp_rootv1p2/.test(attrs)) return '1.2';

  throw new ScormManifestError("Impossible de déterminer la version SCORM (schemaversion introuvable dans imsmanifest.xml).");
}

export function parseScormManifest(xml: string): ScormManifestInfo {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new ScormManifestError("imsmanifest.xml invalide (XML mal formé).");
  }

  const version = detectVersion(doc);

  const organizationsEl = doc.getElementsByTagName('organizations')[0];
  if (!organizationsEl) throw new ScormManifestError("Aucun élément <organizations> dans imsmanifest.xml.");

  const defaultId = organizationsEl.getAttribute('default');
  const organizations = Array.from(doc.getElementsByTagName('organization'));
  const organization = (defaultId && organizations.find((o) => o.getAttribute('identifier') === defaultId))
    ?? organizations[0];
  if (!organization) throw new ScormManifestError("Organisation par défaut introuvable dans imsmanifest.xml.");

  const titleEl = organization.getElementsByTagName('title')[0];
  const title = titleEl?.textContent?.trim() || 'Package SCORM importé';

  const firstItem = Array.from(organization.getElementsByTagName('item'))[0];
  if (!firstItem) throw new ScormManifestError("Aucun <item> lançable dans l'organisation par défaut.");

  const resourceRef = firstItem.getAttribute('identifierref');
  if (!resourceRef) throw new ScormManifestError("<item> sans identifierref.");

  const resource = Array.from(doc.getElementsByTagName('resource'))
    .find((r) => r.getAttribute('identifier') === resourceRef);
  if (!resource) throw new ScormManifestError(`Ressource "${resourceRef}" introuvable dans <resources>.`);

  const launchPath = resource.getAttribute('href');
  if (!launchPath) throw new ScormManifestError("La ressource lançable n'a pas d'attribut href.");

  return { version, launchPath, title };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && npx vitest run src/lib/__tests__/scormManifest.test.ts`
Expected: PASS, all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/lib/scormManifest.ts apps/app/src/lib/__tests__/scormManifest.test.ts
git commit -m "feat: add SCORM manifest parser"
```

---

## Task 5: Package import + upload (`scormImport.ts`)

**Files:**
- Create: `apps/app/src/lib/scormImport.ts`
- Test: `apps/app/src/lib/__tests__/scormImport.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/app/src/lib/__tests__/scormImport.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { importScormPackage } from '../scormImport';
import { supabase } from '../supabase';

vi.mock('../supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ error: null })),
      })),
    },
  },
}));

const MANIFEST = `<?xml version="1.0"?>
<manifest xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG1">
    <organization identifier="ORG1"><title>Test Course</title>
      <item identifier="ITEM1" identifierref="RES1"/>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES1" href="index.html"><file href="index.html"/></resource>
  </resources>
</manifest>`;

async function buildZip(): Promise<File> {
  const zip = new JSZip();
  zip.file('imsmanifest.xml', MANIFEST);
  zip.file('index.html', '<html><body>SCO</body></html>');
  zip.file('assets/style.css', 'body { color: red; }');
  const buffer = await zip.generateAsync({ type: 'arraybuffer' });
  return new File([buffer], 'course.zip', { type: 'application/zip' });
}

beforeEach(() => {
  vi.mocked(supabase.storage.from).mockClear();
});

describe('importScormPackage', () => {
  it('uploads every file in the zip and returns manifest info', async () => {
    const file = await buildZip();
    const result = await importScormPackage(file, 'user-1');

    expect(result.version).toBe('1.2');
    expect(result.launchPath).toBe('index.html');
    expect(result.title).toBe('Test Course');
    expect(result.packageId).toMatch(/^[a-z0-9]+$/);

    const fromMock = vi.mocked(supabase.storage.from);
    expect(fromMock).toHaveBeenCalledWith('scorm-packages');
    // imsmanifest.xml + index.html + assets/style.css = 3 uploads
    const uploadMock = fromMock.mock.results[0].value.upload;
    expect(uploadMock).toHaveBeenCalledTimes(3);
    expect(uploadMock.mock.calls.map((c: unknown[]) => c[0])).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`user-1/${result.packageId}/imsmanifest.xml`),
        expect.stringContaining(`user-1/${result.packageId}/index.html`),
        expect.stringContaining(`user-1/${result.packageId}/assets/style.css`),
      ]),
    );
  });

  it('rejects a zip with no imsmanifest.xml', async () => {
    const zip = new JSZip();
    zip.file('index.html', '<html></html>');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const file = new File([buffer], 'bad.zip', { type: 'application/zip' });

    await expect(importScormPackage(file, 'user-1')).rejects.toThrow(/imsmanifest\.xml/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && npx vitest run src/lib/__tests__/scormImport.test.ts`
Expected: FAIL — `Cannot find module '../scormImport'`.

- [ ] **Step 3: Implement `scormImport.ts`**

```ts
// apps/app/src/lib/scormImport.ts
import JSZip from 'jszip';
import { supabase } from './supabase';
import { parseScormManifest, ScormManifestError } from './scormManifest';
import { genId } from './courseStorage';

const MAX_PACKAGE_BYTES = 100 * 1024 * 1024; // 100MB, generous for a single-SCO package

export interface ScormImportResult {
  packageId: string;
  version: '1.2' | '2004';
  launchPath: string;
  title: string;
}

function guessContentType(path: string): string {
  if (path.endsWith('.html') || path.endsWith('.htm')) return 'text/html';
  if (path.endsWith('.js')) return 'application/javascript';
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.xml')) return 'application/xml';
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.gif')) return 'image/gif';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.mp3')) return 'audio/mpeg';
  if (path.endsWith('.mp4')) return 'video/mp4';
  return 'application/octet-stream';
}

/** Parses a SCORM .zip, uploads every contained file to the scorm-packages
 *  bucket at `<userId>/<packageId>/<relative_path>`, and returns manifest
 *  info to store on the Lesson. Throws ScormManifestError for a missing or
 *  invalid imsmanifest.xml, or Error if the zip itself can't be read. */
export async function importScormPackage(file: File, userId: string): Promise<ScormImportResult> {
  if (file.size > MAX_PACKAGE_BYTES) {
    throw new Error(`Package trop volumineux (max ${Math.round(MAX_PACKAGE_BYTES / 1024 / 1024)} Mo).`);
  }

  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const manifestFile = zip.file('imsmanifest.xml');
  if (!manifestFile) throw new ScormManifestError("imsmanifest.xml introuvable à la racine du package.");

  const manifestXml = await manifestFile.async('text');
  const manifest = parseScormManifest(manifestXml);

  const packageId = genId();
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);

  for (const entry of entries) {
    const bytes = await entry.async('arraybuffer');
    const path = `${userId}/${packageId}/${entry.name}`;
    const { error } = await supabase.storage
      .from('scorm-packages')
      .upload(path, bytes, { upsert: true, contentType: guessContentType(entry.name) });
    if (error) throw error;
  }

  return { packageId, version: manifest.version, launchPath: manifest.launchPath, title: manifest.title };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && npx vitest run src/lib/__tests__/scormImport.test.ts`
Expected: PASS, both tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/lib/scormImport.ts apps/app/src/lib/__tests__/scormImport.test.ts
git commit -m "feat: add SCORM package import/upload"
```

---

## Task 6: Tracking persistence + stats (`scormTracking.ts`)

Course ownership can differ from the learner, and the Supabase `content` row
for a course may live under a different id than the local `courseStorage.ts`
id (mirrored via `source_id`, same pattern `CourseViewer.tsx:559` already
uses). This module resolves that before every write/read.

**Files:**
- Create: `apps/app/src/lib/scormTracking.ts`
- Test: `apps/app/src/lib/__tests__/scormTracking.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/app/src/lib/__tests__/scormTracking.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import { upsertScormTracking, getScormTrackingForCourse, computeScormStats } from '../scormTracking';

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('@/lib/content/contentRepo', () => ({
  getContentBySourceAnyOwner: vi.fn(async () => ({ id: 'content-row-1' })),
}));

type Result = { data: unknown; error: unknown };

function makeBuilder(result: Result) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then: (resolve: (r: Result) => unknown) => unknown;
  } = {
    select: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    then: (resolve) => resolve(result),
  } as never;
  return builder;
}

const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  fromMock.mockReset();
});

describe('upsertScormTracking', () => {
  it('resolves the course content id and upserts keyed by user/course/lesson', async () => {
    const builder = makeBuilder({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    await upsertScormTracking({
      userId: 'user-1',
      localCourseId: 'course-local-1',
      lessonId: 'lesson-1',
      scormVersion: '1.2',
      lessonStatus: 'completed',
      scoreRaw: 90,
      totalTime: '0000:12:30',
      interactions: [],
    });

    expect(fromMock).toHaveBeenCalledWith('scorm_tracking');
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        course_id: 'content-row-1',
        lesson_id: 'lesson-1',
        scorm_version: '1.2',
        lesson_status: 'completed',
        score_raw: 90,
      }),
      { onConflict: 'user_id,course_id,lesson_id' },
    );
  });
});

describe('computeScormStats', () => {
  it('computes completion rate, average score, average time from tracking rows', async () => {
    const rows = [
      { lesson_status: 'completed', score_raw: 80, total_time: '0000:10:00' },
      { lesson_status: 'incomplete', score_raw: null, total_time: '0000:05:00' },
      { lesson_status: 'passed', score_raw: 100, total_time: '0000:20:00' },
    ];
    const builder = makeBuilder({ data: rows, error: null });
    fromMock.mockReturnValue(builder);

    const stats = await computeScormStats('course-local-1', 'lesson-1');
    expect(stats.totalLearners).toBe(3);
    expect(stats.completedCount).toBe(2); // 'completed' and 'passed' both count as done
    expect(stats.completionRate).toBe(67); // round(2/3 * 100)
    expect(stats.avgScore).toBe(90); // (80 + 100) / 2, only scored rows
    expect(stats.avgTimeMinutes).toBe(11.67); // (10 + 5 + 20) / 3 minutes, rounded to 2dp
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && npx vitest run src/lib/__tests__/scormTracking.test.ts`
Expected: FAIL — `Cannot find module '../scormTracking'`.

- [ ] **Step 3: Implement `scormTracking.ts`**

```ts
// apps/app/src/lib/scormTracking.ts
import { supabase } from '@/lib/supabase';
import { getContentBySourceAnyOwner } from '@/lib/content/contentRepo';

export interface ScormInteraction {
  id: string;
  type?: string;
  learnerResponse?: string;
  correctResponse?: string;
  result?: string;
  description?: string;
  timestamp: string;
}

export interface ScormTrackingInput {
  userId: string;
  localCourseId: string;
  lessonId: string;
  scormVersion: '1.2' | '2004';
  lessonStatus?: string;
  completionStatus?: string;
  successStatus?: string;
  scoreRaw?: number;
  scoreMin?: number;
  scoreMax?: number;
  scoreScaled?: number;
  progressMeasure?: number;
  totalTime?: string;
  suspendData?: string;
  entry?: string;
  exit?: string;
  interactions: ScormInteraction[];
}

async function resolveCourseContentId(localCourseId: string): Promise<string> {
  const row = await getContentBySourceAnyOwner('course', localCourseId);
  if (!row) throw new Error('Course content row not found — save/share the course before tracking SCORM progress.');
  return row.id;
}

export async function upsertScormTracking(input: ScormTrackingInput): Promise<void> {
  const courseId = await resolveCourseContentId(input.localCourseId);
  const { error } = await supabase.from('scorm_tracking').upsert(
    {
      user_id: input.userId,
      course_id: courseId,
      lesson_id: input.lessonId,
      scorm_version: input.scormVersion,
      lesson_status: input.lessonStatus ?? null,
      completion_status: input.completionStatus ?? null,
      success_status: input.successStatus ?? null,
      score_raw: input.scoreRaw ?? null,
      score_min: input.scoreMin ?? null,
      score_max: input.scoreMax ?? null,
      score_scaled: input.scoreScaled ?? null,
      progress_measure: input.progressMeasure ?? null,
      total_time: input.totalTime ?? null,
      suspend_data: input.suspendData ?? null,
      entry: input.entry ?? null,
      exit: input.exit ?? null,
      interactions: input.interactions,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,course_id,lesson_id' },
  );
  if (error) throw error;
}

interface ScormTrackingRow {
  user_id: string;
  lesson_status: string | null;
  completion_status: string | null;
  score_raw: number | null;
  total_time: string | null;
}

export async function getScormTrackingForCourse(localCourseId: string, lessonId: string): Promise<ScormTrackingRow[]> {
  const courseId = await resolveCourseContentId(localCourseId);
  const { data, error } = await supabase
    .from('scorm_tracking')
    .select('*')
    .eq('course_id', courseId)
    .eq('lesson_id', lessonId);
  if (error) throw error;
  return data ?? [];
}

const DONE_STATUSES = new Set(['completed', 'passed']);

/** SCORM total_time is HHHH:MM:SS(.ss) (1.2) or an ISO 8601 duration (2004,
 *  e.g. PT1H2M3S). Both formats appear in the wild depending on the
 *  authoring tool; this handles the common HHHH:MM:SS case used by both. */
function parseTotalTimeMinutes(totalTime: string | null): number | null {
  if (!totalTime) return null;
  const hms = totalTime.match(/^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/);
  if (hms) return Number(hms[1]) * 60 + Number(hms[2]) + Number(hms[3]) / 60;
  const iso = totalTime.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (iso) return Number(iso[1] ?? 0) * 60 + Number(iso[2] ?? 0) + Number(iso[3] ?? 0) / 60;
  return null;
}

export interface ScormStats {
  totalLearners: number;
  completedCount: number;
  completionRate: number | null;
  avgScore: number | null;
  avgTimeMinutes: number | null;
}

export async function computeScormStats(localCourseId: string, lessonId: string): Promise<ScormStats> {
  const rows = await getScormTrackingForCourse(localCourseId, lessonId);
  const completed = rows.filter((r) => DONE_STATUSES.has(r.lesson_status ?? r.completion_status ?? ''));
  const scored = rows.filter((r): r is ScormTrackingRow & { score_raw: number } => r.score_raw != null);
  const timed = rows.map((r) => parseTotalTimeMinutes(r.total_time)).filter((m): m is number => m != null);

  return {
    totalLearners: rows.length,
    completedCount: completed.length,
    completionRate: rows.length ? Math.round((completed.length / rows.length) * 100) : null,
    avgScore: scored.length ? Math.round(scored.reduce((s, r) => s + r.score_raw, 0) / scored.length) : null,
    avgTimeMinutes: timed.length ? Math.round((timed.reduce((s, m) => s + m, 0) / timed.length) * 100) / 100 : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && npx vitest run src/lib/__tests__/scormTracking.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/lib/scormTracking.ts apps/app/src/lib/__tests__/scormTracking.test.ts
git commit -m "feat: add SCORM tracking persistence and stats"
```

---

## Task 7: SCORM 1.2 / 2004 API shim (`scormApi.ts`)

Pure logic (no DOM/network) — the in-memory CMI model and the LMS method
surface the SCO calls. `ScormPlayer.tsx` (Task 8) wires this to `window` and
to `upsertScormTracking`.

**Files:**
- Create: `apps/app/src/lib/scormApi.ts`
- Test: `apps/app/src/lib/__tests__/scormApi.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/app/src/lib/__tests__/scormApi.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createScormApi } from '../scormApi';

describe('createScormApi — SCORM 1.2', () => {
  it('supports the LMSInitialize/GetValue/SetValue/Commit/Finish lifecycle', () => {
    const onCommit = vi.fn();
    const api = createScormApi('1.2', {}, onCommit);

    expect(api.LMSInitialize('')).toBe('true');
    expect(api.LMSGetValue('cmi.core.lesson_status')).toBe('not attempted');

    expect(api.LMSSetValue('cmi.core.lesson_status', 'completed')).toBe('true');
    expect(api.LMSSetValue('cmi.core.score.raw', '85')).toBe('true');
    expect(api.LMSGetValue('cmi.core.lesson_status')).toBe('completed');

    expect(api.LMSCommit('')).toBe('true');
    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ lessonStatus: 'completed', scoreRaw: 85 }));

    expect(api.LMSFinish('')).toBe('true');
    expect(onCommit).toHaveBeenCalledTimes(2); // Commit + Finish both flush
  });

  it('rejects SetValue before Initialize with error 301', () => {
    const api = createScormApi('1.2', {}, vi.fn());
    expect(api.LMSSetValue('cmi.core.lesson_status', 'completed')).toBe('false');
    expect(api.LMSGetLastError()).toBe('301');
  });

  it('records interactions written via cmi.interactions.n.*', () => {
    const onCommit = vi.fn();
    const api = createScormApi('1.2', {}, onCommit);
    api.LMSInitialize('');
    api.LMSSetValue('cmi.interactions.0.id', 'q1');
    api.LMSSetValue('cmi.interactions.0.type', 'choice');
    api.LMSSetValue('cmi.interactions.0.student_response', 'b');
    api.LMSSetValue('cmi.interactions.0.result', 'correct');
    api.LMSCommit('');

    const [state] = onCommit.mock.calls[0];
    expect(state.interactions).toEqual([
      expect.objectContaining({ id: 'q1', type: 'choice', learnerResponse: 'b', result: 'correct' }),
    ]);
  });
});

describe('createScormApi — SCORM 2004', () => {
  it('supports Initialize/GetValue/SetValue/Commit/Terminate under the 2004 method names', () => {
    const onCommit = vi.fn();
    const api = createScormApi('2004', {}, onCommit);

    expect(api.Initialize('')).toBe('true');
    expect(api.SetValue('cmi.completion_status', 'completed')).toBe('true');
    expect(api.SetValue('cmi.success_status', 'passed')).toBe('true');
    expect(api.SetValue('cmi.score.scaled', '0.9')).toBe('true');
    expect(api.Commit('')).toBe('true');
    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({
      completionStatus: 'completed', successStatus: 'passed', scoreScaled: 0.9,
    }));
    expect(api.Terminate('')).toBe('true');
  });

  it('seeds GetValue from initial tracking state (resume)', () => {
    const api = createScormApi('2004', { suspendData: '{"page":3}', completionStatus: 'incomplete' }, vi.fn());
    api.Initialize('');
    expect(api.GetValue('cmi.suspend_data')).toBe('{"page":3}');
    expect(api.GetValue('cmi.completion_status')).toBe('incomplete');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && npx vitest run src/lib/__tests__/scormApi.test.ts`
Expected: FAIL — `Cannot find module '../scormApi'`.

- [ ] **Step 3: Implement `scormApi.ts`**

```ts
// apps/app/src/lib/scormApi.ts
import type { ScormInteraction } from './scormTracking';

export interface ScormApiState {
  lessonStatus?: string;
  completionStatus?: string;
  successStatus?: string;
  scoreRaw?: number;
  scoreMin?: number;
  scoreMax?: number;
  scoreScaled?: number;
  progressMeasure?: number;
  suspendData?: string;
  entry?: string;
  exit?: string;
  interactions: ScormInteraction[];
}

export interface Scorm12Api {
  LMSInitialize(param: string): string;
  LMSGetValue(name: string): string;
  LMSSetValue(name: string, value: string): string;
  LMSCommit(param: string): string;
  LMSFinish(param: string): string;
  LMSGetLastError(): string;
  LMSGetErrorString(code: string): string;
  LMSGetDiagnostic(code: string): string;
}

export interface Scorm2004Api {
  Initialize(param: string): string;
  GetValue(name: string): string;
  SetValue(name: string, value: string): string;
  Commit(param: string): string;
  Terminate(param: string): string;
  GetLastError(): string;
  GetErrorString(code: string): string;
  GetDiagnostic(code: string): string;
}

const NOT_INITIALIZED = '301';
const GENERAL_EXCEPTION = '101';
const NO_ERROR = '0';

/** Builds a SCORM 1.2 or 2004 runtime API object backed by an in-memory CMI
 *  model. `initial` seeds resume state (suspend_data, completion status)
 *  from a previously-persisted scorm_tracking row. `onCommit` is called with
 *  the full current state on every Commit/Terminate call — the caller
 *  (ScormPlayer) is responsible for persisting it. */
export function createScormApi(
  version: '1.2' | '2004',
  initial: Partial<ScormApiState>,
  onCommit: (state: ScormApiState) => void,
): Scorm12Api & Scorm2004Api {
  void version; // only determines which method names ScormPlayer mounts on window; behavior is identical for both

  let initialized = false;
  let terminated = false;
  let lastError = NO_ERROR;

  const state: ScormApiState = {
    lessonStatus: initial.lessonStatus ?? 'not attempted',
    completionStatus: initial.completionStatus ?? 'incomplete',
    successStatus: initial.successStatus,
    scoreRaw: initial.scoreRaw,
    scoreMin: initial.scoreMin,
    scoreMax: initial.scoreMax,
    scoreScaled: initial.scoreScaled,
    progressMeasure: initial.progressMeasure,
    suspendData: initial.suspendData,
    entry: initial.entry ?? 'ab-initio',
    exit: initial.exit,
    interactions: [...(initial.interactions ?? [])],
  };

  const interactionAt = (index: number): ScormInteraction => {
    let entry = state.interactions[index];
    if (!entry) {
      entry = { id: String(index), timestamp: new Date().toISOString() };
      state.interactions[index] = entry;
    }
    return entry;
  };

  function get(name: string): string {
    if (!initialized) { lastError = NOT_INITIALIZED; return ''; }
    lastError = NO_ERROR;
    switch (name) {
      case 'cmi.core.lesson_status': return state.lessonStatus ?? '';
      case 'cmi.completion_status': return state.completionStatus ?? '';
      case 'cmi.success_status': return state.successStatus ?? '';
      case 'cmi.core.score.raw':
      case 'cmi.score.raw': return state.scoreRaw != null ? String(state.scoreRaw) : '';
      case 'cmi.score.scaled': return state.scoreScaled != null ? String(state.scoreScaled) : '';
      case 'cmi.suspend_data': return state.suspendData ?? '';
      case 'cmi.core.entry':
      case 'cmi.entry': return state.entry ?? '';
      case 'cmi.progress_measure': return state.progressMeasure != null ? String(state.progressMeasure) : '';
      default: return '';
    }
  }

  function set(name: string, value: string): string {
    if (!initialized) { lastError = NOT_INITIALIZED; return 'false'; }
    lastError = NO_ERROR;

    const interactionMatch = name.match(/^cmi\.interactions\.(\d+)\.(\w+)$/);
    if (interactionMatch) {
      const [, idxStr, field] = interactionMatch;
      const entry = interactionAt(Number(idxStr));
      if (field === 'id') entry.id = value;
      else if (field === 'type') entry.type = value;
      else if (field === 'student_response' || field === 'learner_response') entry.learnerResponse = value;
      else if (field === 'correct_responses.0.pattern') entry.correctResponse = value;
      else if (field === 'result') entry.result = value;
      else if (field === 'description') entry.description = value;
      return 'true';
    }

    switch (name) {
      case 'cmi.core.lesson_status': state.lessonStatus = value; return 'true';
      case 'cmi.completion_status': state.completionStatus = value; return 'true';
      case 'cmi.success_status': state.successStatus = value; return 'true';
      case 'cmi.core.score.raw':
      case 'cmi.score.raw': state.scoreRaw = Number(value); return 'true';
      case 'cmi.core.score.min':
      case 'cmi.score.min': state.scoreMin = Number(value); return 'true';
      case 'cmi.core.score.max':
      case 'cmi.score.max': state.scoreMax = Number(value); return 'true';
      case 'cmi.score.scaled': state.scoreScaled = Number(value); return 'true';
      case 'cmi.suspend_data': state.suspendData = value; return 'true';
      case 'cmi.core.exit':
      case 'cmi.exit': state.exit = value; return 'true';
      case 'cmi.progress_measure': state.progressMeasure = Number(value); return 'true';
      default: return 'true'; // unhandled but valid CMI element — accept, don't fail the SCO
    }
  }

  function commit(): string {
    if (!initialized) { lastError = NOT_INITIALIZED; return 'false'; }
    onCommit({ ...state, interactions: [...state.interactions] });
    return 'true';
  }

  function terminate(): string {
    if (!initialized || terminated) { lastError = GENERAL_EXCEPTION; return 'false'; }
    terminated = true;
    onCommit({ ...state, interactions: [...state.interactions] });
    return 'true';
  }

  function initialize(): string {
    if (initialized) { lastError = GENERAL_EXCEPTION; return 'false'; }
    initialized = true;
    lastError = NO_ERROR;
    return 'true';
  }

  return {
    LMSInitialize: initialize,
    Initialize: initialize,
    LMSGetValue: get,
    GetValue: get,
    LMSSetValue: set,
    SetValue: set,
    LMSCommit: commit,
    Commit: commit,
    LMSFinish: terminate,
    Terminate: terminate,
    LMSGetLastError: () => lastError,
    GetLastError: () => lastError,
    LMSGetErrorString: (code: string) => (code === NO_ERROR ? 'No error' : 'Error'),
    GetErrorString: (code: string) => (code === NO_ERROR ? 'No error' : 'Error'),
    LMSGetDiagnostic: () => '',
    GetDiagnostic: () => '',
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && npx vitest run src/lib/__tests__/scormApi.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/lib/scormApi.ts apps/app/src/lib/__tests__/scormApi.test.ts
git commit -m "feat: add SCORM 1.2/2004 API shim"
```

---

## Task 8: `ScormPlayer.tsx` component

Mounts the API shim onto `window`, renders the iframe, and wires
autosave/unload persistence.

**Files:**
- Create: `apps/app/src/components/ScormPlayer.tsx`
- Test: `apps/app/src/components/__tests__/ScormPlayer.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/app/src/components/__tests__/ScormPlayer.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ScormPlayer } from '../ScormPlayer';
import { upsertScormTracking } from '@/lib/scormTracking';

vi.mock('@/lib/scormTracking', () => ({ upsertScormTracking: vi.fn(async () => {}) }));

afterEach(() => {
  cleanup();
  delete (window as unknown as Record<string, unknown>).API;
  delete (window as unknown as Record<string, unknown>).API_1484_11;
});

describe('ScormPlayer', () => {
  it('mounts window.API for a 1.2 package and points the iframe at the proxy path', () => {
    const { container } = render(
      <ScormPlayer
        userId="user-1"
        localCourseId="course-1"
        lessonId="lesson-1"
        scormVersion="1.2"
        packageId="pkg-1"
        launchPath="index_lms.html"
        initialState={{}}
      />,
    );

    expect(typeof (window as unknown as { API?: unknown }).API).toBe('object');
    expect((window as unknown as { API_1484_11?: unknown }).API_1484_11).toBeUndefined();

    const iframe = container.querySelector('iframe');
    expect(iframe?.getAttribute('src')).toBe('/scorm-content/user-1/pkg-1/index_lms.html');
  });

  it('mounts window.API_1484_11 for a 2004 package', () => {
    render(
      <ScormPlayer
        userId="user-1"
        localCourseId="course-1"
        lessonId="lesson-1"
        scormVersion="2004"
        packageId="pkg-2"
        launchPath="story.html"
        initialState={{}}
      />,
    );
    expect(typeof (window as unknown as { API_1484_11?: unknown }).API_1484_11).toBe('object');
  });

  it('persists tracking state when the SCO calls Commit', () => {
    render(
      <ScormPlayer
        userId="user-1"
        localCourseId="course-1"
        lessonId="lesson-1"
        scormVersion="2004"
        packageId="pkg-2"
        launchPath="story.html"
        initialState={{}}
      />,
    );
    const api = (window as unknown as { API_1484_11: { Initialize: (p: string) => string; SetValue: (n: string, v: string) => string; Commit: (p: string) => string } }).API_1484_11;
    api.Initialize('');
    api.SetValue('cmi.completion_status', 'completed');
    api.Commit('');

    expect(vi.mocked(upsertScormTracking)).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1', localCourseId: 'course-1', lessonId: 'lesson-1',
        scormVersion: '2004', completionStatus: 'completed',
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && npx vitest run src/components/__tests__/ScormPlayer.test.tsx`
Expected: FAIL — `Cannot find module '../ScormPlayer'`.

- [ ] **Step 3: Implement `ScormPlayer.tsx`**

```tsx
// apps/app/src/components/ScormPlayer.tsx
import { useEffect, useRef } from 'react';
import { createScormApi, type ScormApiState } from '@/lib/scormApi';
import { upsertScormTracking, type ScormTrackingInput } from '@/lib/scormTracking';

export interface ScormPlayerProps {
  userId: string;
  localCourseId: string;
  lessonId: string;
  scormVersion: '1.2' | '2004';
  packageId: string;
  launchPath: string;
  initialState: Partial<ScormApiState>;
}

const AUTOSAVE_INTERVAL_MS = 30_000;

function toTrackingInput(
  props: Pick<ScormPlayerProps, 'userId' | 'localCourseId' | 'lessonId' | 'scormVersion'>,
  state: ScormApiState,
): ScormTrackingInput {
  return {
    userId: props.userId,
    localCourseId: props.localCourseId,
    lessonId: props.lessonId,
    scormVersion: props.scormVersion,
    lessonStatus: state.lessonStatus,
    completionStatus: state.completionStatus,
    successStatus: state.successStatus,
    scoreRaw: state.scoreRaw,
    scoreMin: state.scoreMin,
    scoreMax: state.scoreMax,
    scoreScaled: state.scoreScaled,
    progressMeasure: state.progressMeasure,
    suspendData: state.suspendData,
    entry: state.entry,
    exit: state.exit,
    interactions: state.interactions,
  };
}

/** Renders a SCORM SCO in an iframe served through the same-origin
 *  /scorm-content proxy (required so the SCO's window.parent API lookup
 *  isn't blocked by cross-origin restrictions — see the design spec) and
 *  mounts the matching runtime API (window.API for 1.2, window.API_1484_11
 *  for 2004) that the SCO's own runtime-detection code walks up to find. */
export function ScormPlayer({
  userId, localCourseId, lessonId, scormVersion, packageId, launchPath, initialState,
}: ScormPlayerProps) {
  const latestStateRef = useRef<ScormApiState | null>(null);

  useEffect(() => {
    const globalKey = scormVersion === '1.2' ? 'API' : 'API_1484_11';

    const persist = (state: ScormApiState) => {
      latestStateRef.current = state;
      void upsertScormTracking(toTrackingInput({ userId, localCourseId, lessonId, scormVersion }, state));
    };

    const api = createScormApi(scormVersion, initialState, persist);
    (window as unknown as Record<string, unknown>)[globalKey] = api;

    const autosave = window.setInterval(() => {
      if (latestStateRef.current) persist(latestStateRef.current);
    }, AUTOSAVE_INTERVAL_MS);

    const onUnload = () => {
      if (latestStateRef.current) persist(latestStateRef.current);
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      window.clearInterval(autosave);
      window.removeEventListener('beforeunload', onUnload);
      delete (window as unknown as Record<string, unknown>)[globalKey];
    };
    // Re-mounting the API on every keystroke elsewhere in the app would drop
    // in-flight SCO state; this effect intentionally runs once per lesson.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scormVersion, packageId, launchPath]);

  return (
    <iframe
      src={`/scorm-content/${userId}/${packageId}/${launchPath}`}
      title="Contenu SCORM"
      style={{ width: '100%', height: '75vh', border: 'none', display: 'block' }}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && npx vitest run src/components/__tests__/ScormPlayer.test.tsx`
Expected: PASS, all 3 tests green. If `@testing-library/react` isn't already a dependency, check `apps/app/package.json` first — if missing, add it (`npm install -D @testing-library/react --workspace=apps/app`) before this step; it's very likely already present given the app has React components under test elsewhere (verify with `grep -r "@testing-library/react" apps/app/package.json`).

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/components/ScormPlayer.tsx apps/app/src/components/__tests__/ScormPlayer.test.tsx
git commit -m "feat: add ScormPlayer component"
```

---

## Task 9: Course editor integration (`CourseBuilder.tsx`)

**Files:**
- Modify: `apps/app/src/pages/CourseBuilder.tsx:1,34-45,287-306,309-345,1036-1048`

- [ ] **Step 1: Add imports**

Edit the icon import block at `apps/app/src/pages/CourseBuilder.tsx:34-45` — add `PackageOpen` and `X` (for a remove/replace affordance) to the existing `lucide-react` import list, and add the new import at the top:

```ts
import { importScormPackage } from "@/lib/scormImport";
```

(Add this alongside the other `@/lib/*` imports near line 20.)

- [ ] **Step 2: Add the `scorm` option to the type Select**

Edit `apps/app/src/pages/CourseBuilder.tsx:792` — insert directly after the `file-upload` item:

```tsx
                          <SelectItem value="file-upload">Dépôt de fichier</SelectItem>
                          <SelectItem value="scorm">Package SCORM</SelectItem>
```

- [ ] **Step 3: Add icon/label cases**

Edit `apps/app/src/pages/CourseBuilder.tsx:287-307`:

```tsx
  const lessonTypeIcon = (type: Lesson["type"]) => {
    if (type === "quiz") return <BookOpen className="h-3.5 w-3.5" />;
    if (type === "poll") return <BarChart2 className="h-3.5 w-3.5" />;
    if (type === "flashcard") return <Layers className="h-3.5 w-3.5" />;
    if (type === "document") return <FileText className="h-3.5 w-3.5" />;
    if (type === "video") return <Video className="h-3.5 w-3.5" />;
    if (type === "iframe") return <Globe className="h-3.5 w-3.5" />;
    if (type === "file-upload") return <Upload className="h-3.5 w-3.5" />;
    if (type === "scorm") return <PackageOpen className="h-3.5 w-3.5" />;
    return <GraduationCap className="h-3.5 w-3.5" />;
  };

  const lessonTypeLabel = (type: Lesson["type"]) => {
    if (type === "quiz") return "Quiz";
    if (type === "poll") return "Sondage";
    if (type === "flashcard") return "Flashcards";
    if (type === "document") return "Document";
    if (type === "video") return "Vidéo";
    if (type === "iframe") return "Iframe";
    if (type === "file-upload") return "Dépôt de fichier";
    if (type === "scorm") return "Package SCORM";
    return "Texte";
  };
```

- [ ] **Step 4: Add the SCORM upload handler**

Insert after `handleFileUpload` (`apps/app/src/pages/CourseBuilder.tsx:309-345`), right before `handleCoverImageUpload`:

Only default the lesson title from the manifest if the user hasn't already
typed a custom one — look up the current lesson from `course.modules` before
calling `updateLesson`:

```tsx
  const handleScormUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    moduleId: string,
    lessonId: string,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const user = getCurrentUser();
    if (!user) return;

    const currentModule = course?.modules.find((m) => m.id === moduleId);
    const currentLesson = currentModule?.lessons.find((l) => l.id === lessonId);

    setScormUploading(lessonId);
    try {
      const result = await importScormPackage(file, user.id);
      updateLesson(moduleId, lessonId, {
        scormPackageId: result.packageId,
        scormVersion: result.version,
        scormLaunchPath: result.launchPath,
        scormTitle: result.title,
        title: currentLesson && currentLesson.title.trim() ? currentLesson.title : result.title,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import SCORM invalide");
    } finally {
      setScormUploading(null);
    }
  };
```

(Check the exact state variable name holding the course draft — it's referenced as `course` throughout this file per Task 12's earlier grep of `CourseBuilder.tsx`; confirm with `grep -n "const \[course, setCourse\]" apps/app/src/pages/CourseBuilder.tsx` and adjust the variable name in the snippet above if it differs.)

- [ ] **Step 5: Add the SCORM editor block**

Insert after the `file-upload` block, before the closing `</div>` at `apps/app/src/pages/CourseBuilder.tsx:1047-1048`:

```tsx
                  {lesson.type === "scorm" && (
                    <div>
                      {fieldLabel("Package SCORM")}
                      {lesson.scormPackageId ? (
                        <div style={{
                          display: "flex", alignItems: "center", gap: "10px",
                          padding: "10px 14px",
                          background: "var(--ap-paper-2)",
                          border: "var(--ap-border-w) solid var(--ap-line)",
                          borderRadius: "var(--ap-r-sm)",
                          marginBottom: "10px",
                        }}>
                          <PackageOpen className="h-4 w-4 flex-shrink-0" style={{ color: "var(--ap-brand)" }} />
                          <span style={{ flex: 1, fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {lesson.scormTitle} — SCORM {lesson.scormVersion}
                          </span>
                          <button
                            onClick={() => updateLesson(moduleId, lessonId, {
                              scormPackageId: undefined, scormVersion: undefined,
                              scormLaunchPath: undefined, scormTitle: undefined,
                            })}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ap-quiz)", display: "flex", padding: "2px" }}
                            title="Supprimer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null}
                      <label style={{
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        gap: "8px", padding: "24px",
                        border: "var(--ap-border-w) dashed var(--ap-line-2)",
                        borderRadius: "var(--ap-r-sm)",
                        cursor: scormUploading === lesson.id ? "wait" : "pointer",
                        background: "var(--ap-paper-2)",
                        opacity: scormUploading === lesson.id ? 0.6 : 1,
                      }}>
                        <PackageOpen className="h-5 w-5" style={{ color: "var(--ap-muted)" }} />
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ap-muted)" }}>
                          {scormUploading === lesson.id
                            ? "Import en cours…"
                            : lesson.scormPackageId ? "Remplacer le package" : "Importer un package .zip"}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--ap-muted)" }}>SCORM 1.2 ou 2004, package single-SCO, max 100 Mo</span>
                        <input
                          type="file"
                          accept=".zip"
                          style={{ display: "none" }}
                          disabled={scormUploading === lesson.id}
                          onChange={(e) => handleScormUpload(e, moduleId, lesson.id)}
                        />
                      </label>
                    </div>
                  )}
```

- [ ] **Step 6: Typecheck**

Run: `cd apps/app && npx tsc --noEmit`
Expected: no new errors. Fix any variable-name mismatches found in Step 4's parenthetical check.

- [ ] **Step 7: Commit**

```bash
git add apps/app/src/pages/CourseBuilder.tsx
git commit -m "feat: add SCORM lesson type to course editor"
```

---

## Task 10: Course viewer integration (`CourseViewer.tsx`)

**Files:**
- Modify: `apps/app/src/pages/CourseViewer.tsx:1,54-57,92-102,1189-1208`

- [ ] **Step 1: Add imports**

Edit the icon import list at `apps/app/src/pages/CourseViewer.tsx:3-25` — add `PackageOpen`. Add a new import near line 45:

```ts
import { ScormPlayer } from "@/components/ScormPlayer";
```

- [ ] **Step 2: Extend `TYPE_LABEL` and `TypeIcon`**

Edit `apps/app/src/pages/CourseViewer.tsx:54-57`:

```tsx
const TYPE_LABEL: Record<string, string> = {
  text: "Leçon", video: "Vidéo", quiz: "Quiz", poll: "Sondage", flashcard: "Flashcards",
  document: "Document", iframe: "Iframe", "file-upload": "Dépôt de fichier", scorm: "SCORM",
};
```

Edit `apps/app/src/pages/CourseViewer.tsx:92-102`:

```tsx
const TypeIcon = ({ type }: { type: string }) => {
  const props = { width: 13, height: 13, color: "#fff", strokeWidth: 2.4 } as const;
  if (type === "text") return <FileText {...props} />;
  if (type === "video") return <Video {...props} />;
  if (type === "quiz") return <BookOpen {...props} />;
  if (type === "poll") return <BarChart3 {...props} />;
  if (type === "flashcard") return <Layers3 {...props} />;
  if (type === "file-upload") return <Upload {...props} />;
  if (type === "iframe") return <MonitorSmartphone {...props} />;
  if (type === "scorm") return <PackageOpen {...props} />;
  return <Download {...props} />;
};
```

- [ ] **Step 3: Add a `TYPE_LAUNCH_BG.scorm` entry**

Edit `apps/app/src/pages/CourseViewer.tsx:84-89` — add a `scorm` key (reuse the `document`/pres soft tone since there's no dedicated SCORM token):

```tsx
const TYPE_LAUNCH_BG: Record<string, string> = {
  quiz:      "var(--ap-quiz-soft)",
  poll:      "var(--ap-poll-soft)",
  flashcard: "var(--ap-flash-soft)",
  document:  "var(--ap-pres-soft)",
  scorm:     "var(--ap-pres-soft)",
};
```

- [ ] **Step 4: Render the SCORM player block**

Insert after the `"iframe"` block, before the `"file-upload"` block comment at `apps/app/src/pages/CourseViewer.tsx:1208-1210`:

```tsx
              {/* ── SCORM ── */}
              {lesson.type === "scorm" && (
                !lesson.scormPackageId || !course ? (
                  <div style={{
                    background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-lg)",
                    boxShadow: "0 5px 0 var(--ap-line)", padding: 24,
                    display: "flex", alignItems: "center", gap: 20,
                  }}>
                    <span style={{ flexShrink: 0, width: 64, height: 64, borderRadius: "var(--ap-r-md)", display: "grid", placeItems: "center", fontSize: 30, background: TYPE_LAUNCH_BG.scorm }}>📦</span>
                    <p style={{ color: "var(--ap-muted)", fontWeight: 700, fontSize: 14 }}>Aucun package SCORM importé.</p>
                  </div>
                ) : (
                  <div style={{ borderRadius: "var(--ap-r-lg)", overflow: "hidden", border: "var(--ap-border-w) solid var(--ap-line)", boxShadow: "0 5px 0 var(--ap-line)" }}>
                    <ScormPlayer
                      userId={course.userId}
                      localCourseId={course.id}
                      lessonId={lesson.id}
                      scormVersion={lesson.scormVersion ?? "1.2"}
                      packageId={lesson.scormPackageId}
                      launchPath={lesson.scormLaunchPath ?? ""}
                      initialState={{}}
                    />
                  </div>
                )
              )}

```

Note: `initialState={{}}` means every session starts fresh rather than resuming `suspend_data` — resuming from a prior `scorm_tracking` row is deliberately left out of this task; if you want resume-on-reopen behavior, fetch the learner's own row (`getScormTrackingForCourse(course.id, lesson.id)` filtered to the current user, or a small `getOwnScormTracking` helper) before rendering `ScormPlayer` and pass it through `initialState`. Flagging as a natural follow-up, not silently doing a partial job — resume support wasn't in the approved spec's scope.

- [ ] **Step 5: Typecheck**

Run: `cd apps/app && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/pages/CourseViewer.tsx
git commit -m "feat: render SCORM lessons in course viewer"
```

---

## Task 11: Vercel same-origin proxy + CSP

**Files:**
- Modify: `apps/app/vercel.json`

- [ ] **Step 1: Read the current file and locate the Supabase project ref**

Run: `grep -n "VITE_SUPABASE_URL" apps/app/.env.local` (or check Vercel env — project is `lwwfgdebmggxjuvlazwf` per existing infra notes) to confirm the Storage host: `https://lwwfgdebmggxjuvlazwf.supabase.co`.

- [ ] **Step 2: Add the rewrite before the SPA catch-all**

Edit `apps/app/vercel.json` — find the `rewrites` array (around line 32-34) and add the new rule as the **first** entry (rewrites are evaluated in order; the SPA catch-all `/(.*)`→`/index.html` would otherwise swallow this):

```json
  "rewrites": [
    {
      "source": "/scorm-content/:userId/:packageId/(.*)",
      "destination": "https://lwwfgdebmggxjuvlazwf.supabase.co/storage/v1/object/public/scorm-packages/:userId/:packageId/$1"
    },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
```

- [ ] **Step 3: Add a scoped CSP header for `/scorm-content/*`**

Find the existing `headers` array (around line 21-30) applying CSP to `"source": "/(.*)"`. Add a new, more specific header entry **before** that catch-all one, so `/scorm-content/*` responses get a looser policy (legacy SCORM content commonly relies on inline scripts/eval) instead of the app-wide strict one:

```json
  "headers": [
    {
      "source": "/scorm-content/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self'; connect-src 'self'; frame-ancestors 'self'"
        }
      ]
    }
  ]
```

Keep the existing app-wide header entry unchanged below this new one — do not loosen it for any other path.

- [ ] **Step 4: Verify locally**

Run: `cd apps/app && npx vercel dev` (or deploy a preview and check) then load `/scorm-content/<userId>/<packageId>/imsmanifest.xml` for a package already uploaded via Task 5/9 — expect the raw XML to be returned with a 200, same-origin (no CORS error in the browser console).

- [ ] **Step 5: Commit**

```bash
git add apps/app/vercel.json
git commit -m "feat: proxy /scorm-content to Supabase Storage, scope CSP for SCORM"
```

---

## Task 12: Course-owner SCORM reporting page

**Files:**
- Create: `apps/app/src/pages/CourseScormReport.tsx`
- Modify: `apps/app/src/App.tsx` (add route)
- Modify: `apps/app/src/pages/CourseBuilder.tsx` (add nav entry point)

- [ ] **Step 1: Add the route**

Find the course routes block in `apps/app/src/App.tsx` (`apps/app/src/App.tsx:128-129`, next to `/course/:courseId`) and add:

```tsx
              <Route path="/course/:courseId/scorm-report/:lessonId" element={<CourseScormReport />} />
```

Add the import near the other page imports at the top of `App.tsx`:

```tsx
import CourseScormReport from "@/pages/CourseScormReport";
```

- [ ] **Step 2: Build the reporting page**

```tsx
// apps/app/src/pages/CourseScormReport.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Trophy, Users, Clock3, CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { getCourseById, type Lesson } from "@/lib/courseStorage";
import { getScormTrackingForCourse, computeScormStats, type ScormStats } from "@/lib/scormTracking";
import { showError } from "@/lib/errorTaxonomy";

interface LearnerRow {
  user_id: string;
  lesson_status: string | null;
  completion_status: string | null;
  score_raw: number | null;
  total_time: string | null;
  attempt_count: number;
  updated_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  passed: "Réussi", completed: "Terminé", failed: "Échoué",
  incomplete: "En cours", "not attempted": "Non commencé", browsed: "Consulté",
};

export default function CourseScormReport() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [stats, setStats] = useState<ScormStats | null>(null);
  const [rows, setRows] = useState<LearnerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId || !lessonId) return;
    const course = getCourseById(courseId);
    const found = course?.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId) ?? null;
    setLesson(found);

    Promise.all([
      computeScormStats(courseId, lessonId),
      getScormTrackingForCourse(courseId, lessonId) as Promise<unknown as LearnerRow[]>,
    ])
      .then(([s, r]) => { setStats(s); setRows(r as unknown as LearnerRow[]); })
      .catch((err) => showError(err))
      .finally(() => setLoading(false));
  }, [courseId, lessonId]);

  return (
    <AppLayout>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        <Breadcrumb items={[{ label: "Cours", href: "/my-courses" }, { label: lesson?.title ?? "Reporting SCORM" }]} />
        <button
          onClick={() => navigate(`/course-builder?id=${courseId}`)}
          className="cv-btn"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16, background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
        >
          <ChevronLeft className="h-4 w-4" /> Retour à l'éditeur
        </button>

        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>
          Reporting SCORM — {lesson?.title ?? "…"}
        </h1>

        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              <StatCard icon={<Users className="h-4 w-4" />} label="Apprenants" value={String(stats?.totalLearners ?? 0)} />
              <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Taux de complétion" value={stats?.completionRate != null ? `${stats.completionRate}%` : "—"} />
              <StatCard icon={<Trophy className="h-4 w-4" />} label="Score moyen" value={stats?.avgScore != null ? String(stats.avgScore) : "—"} />
              <StatCard icon={<Clock3 className="h-4 w-4" />} label="Temps moyen" value={stats?.avgTimeMinutes != null ? `${Math.round(stats.avgTimeMinutes)} min` : "—"} />
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid var(--ap-line)" }}>
                  <th style={{ padding: "8px 12px" }}>Apprenant</th>
                  <th style={{ padding: "8px 12px" }}>Statut</th>
                  <th style={{ padding: "8px 12px" }}>Score</th>
                  <th style={{ padding: "8px 12px" }}>Tentatives</th>
                  <th style={{ padding: "8px 12px" }}>Dernier accès</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 16, color: "var(--ap-muted)" }}>Aucun apprenant n'a encore commencé cette leçon.</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.user_id} style={{ borderBottom: "1px solid var(--ap-line)" }}>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 12 }}>{r.user_id}</td>
                    <td style={{ padding: "8px 12px" }}>{STATUS_LABEL[r.lesson_status ?? r.completion_status ?? ""] ?? "—"}</td>
                    <td style={{ padding: "8px 12px" }}>{r.score_raw ?? "—"}</td>
                    <td style={{ padding: "8px 12px" }}>{r.attempt_count}</td>
                    <td style={{ padding: "8px 12px" }}>{new Date(r.updated_at).toLocaleString("fr")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-md)", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ap-muted)", fontSize: 12, fontWeight: 700 }}>{icon}{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}
```

`getScormTrackingForCourse`'s return type in `scormTracking.ts` (Task 6) doesn't currently include `attempt_count` in the `ScormTrackingRow` interface it selects — before wiring this page, widen that interface to also include `attempt_count: number` and `user_id`/`updated_at` (the `select('*')` call already returns them from Postgres; only the TS type needs the extra fields). Update `apps/app/src/lib/scormTracking.ts`'s `ScormTrackingRow` interface:

```ts
interface ScormTrackingRow {
  user_id: string;
  lesson_status: string | null;
  completion_status: string | null;
  score_raw: number | null;
  total_time: string | null;
  attempt_count: number;
  updated_at: string;
}
```

- [ ] **Step 3: Add a nav entry point from the course editor**

In `CourseBuilder.tsx`'s SCORM lesson block (Task 9, Step 5), add a "Voir les résultats" link right after the package-info row, only shown once a package is imported:

```tsx
                      {lesson.scormPackageId && (
                        <button
                          onClick={() => navigate(`/course/${course?.id}/scorm-report/${lesson.id}`)}
                          className="cv-btn"
                          style={{ marginTop: 10, background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "var(--ap-brand)" }}
                        >
                          Voir les résultats des apprenants →
                        </button>
                      )}
```

(`navigate` is already in scope in `CourseBuilder.tsx` via `useNavigate()` — confirm with `grep -n "const navigate" apps/app/src/pages/CourseBuilder.tsx`.)

- [ ] **Step 4: Typecheck**

Run: `cd apps/app && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/pages/CourseScormReport.tsx apps/app/src/App.tsx apps/app/src/pages/CourseBuilder.tsx apps/app/src/lib/scormTracking.ts
git commit -m "feat: add SCORM reporting page for course owners"
```

---

## Task 13: Full test suite + manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd apps/app && npx vitest run`
Expected: all tests pass, including every test file added in Tasks 3-8.

- [ ] **Step 2: Typecheck the whole app**

Run: `cd apps/app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test with a real SCORM package**

Download a small public-domain SCORM 1.2 test package (e.g. the ADL "Golf Explanation" sample, commonly used for SCORM conformance testing) or build a minimal one by zipping the fixture manifest + a trivial HTML file that calls `LMSInitialize/LMSSetValue('cmi.core.lesson_status','completed')/LMSCommit/LMSFinish` from a `<script>` tag. Steps:
1. `npm run dev` from repo root.
2. Open a course in `CourseBuilder`, add a lesson, set type to "Package SCORM", upload the test `.zip`.
3. Confirm the package info row shows the detected title/version.
4. Open the course in `CourseViewer` as the learner, confirm the SCO renders in the iframe with no CSP console errors and no cross-origin errors.
5. Trigger the SCO's completion action (or wait for its own script to fire); confirm — via `supabase db psql` — a `scorm_tracking` row appears with `lesson_status = 'completed'`.
6. From `CourseBuilder`, click "Voir les résultats des apprenants", confirm the reporting page shows 1 learner, completion rate 100%.

Expected: all 6 steps succeed with no console errors.

- [ ] **Step 4: Commit** (only if Step 3 surfaced fixes)

```bash
git add -A
git commit -m "fix: smoke-test fixes for SCORM playback"
```

---

## Self-review notes

- **Spec coverage:** Import 1.2 (Task 4/5, version detection), import 2004 (same), content display (Task 8/10), score/progress/time tracking (Task 6/7), reporting (Task 12) — all 5 spec requirements have a task.
- **Cross-origin constraint**: addressed structurally in Task 11 (proxy) + Task 8 (mounts API on top window, relies on same-origin iframe).
- **Known follow-up, not silently dropped**: `initialState={{}}` in Task 10 means no resume-on-reopen; called out explicitly in that task rather than pretending it's handled.
- **Type consistency checked**: `ScormApiState`/`ScormTrackingInput`/`ScormTrackingRow` field names cross-referenced between Tasks 6, 7, 8, 12 — `lessonStatus`/`completionStatus`/`scoreRaw`/`interactions` etc. spelled identically everywhere they cross a module boundary.
