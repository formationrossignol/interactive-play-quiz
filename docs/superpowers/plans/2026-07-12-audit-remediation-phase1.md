# Audit Remediation — Phase 1 (Security & Build Hardening) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the audit findings (`AUDIT_CODE.md`) that are fixable **without inventing a new backend architecture** — XSS sanitization (C-3), CSP headers (H-4), the masked `tsc` failure + missing CI gate (H-5), npm vulnerabilities that have fixes (H-3 partial), oversized JS bundles (H-7), and the duplicate lockfile (M-4).

**Architecture:** No structural changes. All fixes are localized: a new sanitization utility used at the two `dangerouslySetInnerHTML` call sites, a static header addition in `vercel.json`, a `typecheck` npm script wired into a new GitHub Actions workflow, six real type errors fixed at their call sites, `manualChunks` + one dynamic import to shrink bundles, and removal of the stale `bun.lockb`.

**Tech Stack:** Vite 5, React 18, TypeScript 5.8, Vitest 4, ESLint 9, DOMPurify (new dependency), GitHub Actions.

**Explicitly OUT OF SCOPE for this plan** (require an architecture decision first — see `AUDIT_CODE.md` §18 "moyen/long terme"):
- C-1 (client-side scoring / correct answers exposed to players)
- C-2 (Supabase RLS policies on `session_state`)
- C-4 (localStorage-only persistence of quizzes/exams/courses)
- H-1 (exams not shared between participant and host device)
- H-2 (attempt-count / timer bypass)
- H-6 (correct answers embedded in the live `quiz_data` payload)

These all require choosing a backend approach (Supabase schema + RLS vs. Edge Functions vs. a custom API) before they can be broken into concrete, placeholder-free tasks. Recommend a dedicated `brainstorming` session for "Arcade Pop backend & server-side scoring" before planning that work.

---

## File Structure

| File | Change |
|---|---|
| `src/lib/sanitizeHtml.ts` | **Create** — DOMPurify wrapper used before any `dangerouslySetInnerHTML` |
| `src/lib/__tests__/sanitizeHtml.test.ts` | **Create** — unit tests (jsdom environment) |
| `src/pages/CourseViewer.tsx` | **Modify** — wrap the two `dangerouslySetInnerHTML` call sites (lines ~481, ~606) with `sanitizeHtml(...)` |
| `package.json` | **Modify** — add `dompurify`, `@types/dompurify`, `jsdom` deps; add `typecheck` script |
| `vercel.json` | **Modify** — add `Content-Security-Policy` header |
| `src/components/RichTextEditor.tsx` | **Modify** — fix TipTap v3 `setContent` call (line 84) |
| `src/lib/courseGenerator.ts` | **Modify** — add missing `SavedQuiz` fields to `saveQuiz()` call (line 168) |
| `src/pages/ExamAdmin.tsx` | **Modify** — move `title` out of the `style` object into a real DOM attribute (line ~337) |
| `src/pages/Index.tsx` | **Modify** — remove dead `title`/`desc`/`cta` destructuring that doesn't exist on `contentTypes` (line ~340) |
| `.github/workflows/ci.yml` | **Create** — lint + typecheck + test, required on PRs |
| `vite.config.ts` | **Modify** — add `build.rollupOptions.output.manualChunks` |
| `src/components/QuestionBank.tsx` | **Modify** — dynamic `import('xlsx')` instead of static import; add a file-size guard |
| `bun.lockb` | **Delete** — resolve dual-lockfile ambiguity, standardize on npm |
| `.gitignore` | **Modify** — ignore `bun.lockb` so it can't silently reappear |

---

## Task 1: Sanitize HTML before `dangerouslySetInnerHTML` (audit C-3)

**Files:**
- Create: `src/lib/sanitizeHtml.ts`
- Test: `src/lib/__tests__/sanitizeHtml.test.ts`
- Modify: `package.json`
- Modify: `src/pages/CourseViewer.tsx:481`, `src/pages/CourseViewer.tsx:606`

- [ ] **Step 1: Install DOMPurify + jsdom (test environment)**

```bash
npm install dompurify
npm install -D @types/dompurify jsdom
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/__tests__/sanitizeHtml.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '../sanitizeHtml';

describe('sanitizeHtml', () => {
  it('strips <script> tags entirely', () => {
    const dirty = '<p>Hello</p><script>alert(1)</script>';
    expect(sanitizeHtml(dirty)).toBe('<p>Hello</p>');
  });

  it('strips inline event handlers like onerror', () => {
    const dirty = '<img src="x" onerror="alert(1)">';
    expect(sanitizeHtml(dirty)).not.toContain('onerror');
  });

  it('strips javascript: URLs from links', () => {
    const dirty = '<a href="javascript:alert(1)">click</a>';
    expect(sanitizeHtml(dirty)).not.toContain('javascript:');
  });

  it('preserves safe formatting tags', () => {
    const safe = '<p><strong>Bold</strong> and <em>italic</em></p>';
    expect(sanitizeHtml(safe)).toBe(safe);
  });

  it('preserves images with allowed attributes', () => {
    const safe = '<img src="https://example.com/a.png" alt="desc">';
    expect(sanitizeHtml(safe)).toBe(safe);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/sanitizeHtml.test.ts`
Expected: FAIL — `Cannot find module '../sanitizeHtml'`

- [ ] **Step 4: Write the implementation**

Create `src/lib/sanitizeHtml.ts`:

```ts
import DOMPurify from 'dompurify';

/** Strips scripts, event handlers, and dangerous URLs from user-authored HTML
 *  (lesson content, imported documents) before it's rendered via dangerouslySetInnerHTML. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'img',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel'],
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/sanitizeHtml.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Wire it into CourseViewer**

In `src/pages/CourseViewer.tsx`, add the import near the top (alongside the other `@/lib/*` imports, e.g. after the `getQuizById` import):

```ts
import { sanitizeHtml } from "@/lib/sanitizeHtml";
```

Replace the text-lesson render (around line 481):

```tsx
                lesson.content ? (
                  <div className="cv-prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(lesson.content) }} />
                ) : (
```

Replace the markdown-document render (around line 606):

```tsx
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(lesson.content)) }}
```

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all test files pass (previous `authMigration` suite + new `sanitizeHtml` suite)

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/lib/sanitizeHtml.ts src/lib/__tests__/sanitizeHtml.test.ts src/pages/CourseViewer.tsx
git commit -m "fix(security): sanitize lesson HTML before dangerouslySetInnerHTML"
```

---

## Task 2: Add a Content-Security-Policy header (audit H-4)

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Read current headers block**

Current `vercel.json` "/(.*)" rule only sets `X-Content-Type-Options`. Add a CSP to the same rule. The app talks to Supabase (any `*.supabase.co` project URL) and embeds YouTube videos (`CourseViewer.tsx` uses `youtube.com/embed`), so both must be allowed.

- [ ] **Step 2: Edit `vercel.json`**

Replace:

```json
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
```

with:

```json
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src https://www.youtube.com; object-src 'none'; base-uri 'self'; form-action 'self'"
        }
      ]
    }
```

> `style-src 'unsafe-inline'` is required because the app renders extensive inline `style={{...}}` React props — removing it would break the current UI and is out of scope for this pass. `script-src` has no `'unsafe-inline'`/`'unsafe-eval'`, so injected `<script>` tags (the C-3 vector) are blocked by the browser even if a sanitizer bypass were ever found — defense in depth.

- [ ] **Step 3: Verify the header locally**

Run: `npm run build && npx vercel dev` (or, if Vercel CLI isn't authenticated locally, skip to deployment verification) — otherwise verify after the next preview deploy:

```bash
curl -sI https://<preview-url>/ | grep -i content-security-policy
```

Expected: header present with the value from Step 2.

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "fix(security): add Content-Security-Policy header"
```

---

## Task 3: Fix the masked `tsc` failures + add a `typecheck` script (audit H-5)

**Files:**
- Modify: `package.json`
- Modify: `src/components/RichTextEditor.tsx:84`
- Modify: `src/lib/courseGenerator.ts:168-184`
- Modify: `src/pages/ExamAdmin.tsx:330-341`
- Modify: `src/pages/Index.tsx:340`

- [ ] **Step 1: Add the `typecheck` script**

In `package.json`, under `"scripts"`, add:

```json
    "typecheck": "tsc --noEmit -p tsconfig.app.json",
```

- [ ] **Step 2: Run it to confirm the 6 known failures**

Run: `npm run typecheck`
Expected: 6 errors — `RichTextEditor.tsx(84,47)`, `courseGenerator.ts(168,27)`, `ExamAdmin.tsx(337,19)`, `Index.tsx(340,54)`, `Index.tsx(340,70)`, `Index.tsx(340,84)`.

- [ ] **Step 3: Fix `RichTextEditor.tsx:84` — TipTap v3 `setContent` signature**

TipTap v3 replaced the `emitUpdate: boolean` second argument with an options object. Change:

```ts
      editor.commands.setContent(value || "", false);
```

to:

```ts
      editor.commands.setContent(value || "", { emitUpdate: false });
```

- [ ] **Step 4: Fix `courseGenerator.ts:168` — missing `SavedQuiz` fields**

`saveQuiz()` requires `category`, `speedBonus`, `transitionTime` (see `src/lib/quizStorage.ts` `SavedQuiz` type). Change the call (currently missing those three fields):

```ts
    const quiz = saveQuiz({
      title: m.quiz.title,
      description: `Quiz de validation — ${m.title}\n\nObjectif : ${m.pedagogical_objective}`,
      questions: m.quiz.questions.map((q) => ({
        id: genId(),
        type: q.type,
        question: q.question,
        answers: q.answers ?? ['Vrai', 'Faux'],
        correctAnswer: q.correctAnswer,
        points: q.points ?? 100,
        timeLimit: q.timeLimit ?? 30,
      })),
      isPublic: false,
      isFavorite: false,
      tags: [],
      type: 'quiz',
      category: 'Formation',
      speedBonus: true,
      transitionTime: 5,
    });
```

- [ ] **Step 5: Fix `ExamAdmin.tsx:337` — `title` is a DOM attribute, not a CSS property**

The current code puts `title: \`Q${i + 1}\`,` inside the `style={{...}}` object, which isn't a valid CSS property. Move it to a real `title` prop on the element. Change:

```tsx
                <div key={qId} style={{
                  width: 28, height: 28, borderRadius: 6, fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: noAnswer ? 'var(--ap-paper-2)' : correct === true ? '#e8faf3' : correct === false ? '#fff3f0' : '#eef4ff',
                  color: noAnswer ? 'var(--ap-muted)' : correct === true ? '#15c08a' : correct === false ? '#ff5a4d' : '#2f7bff',
                  border: `1.5px solid ${noAnswer ? 'var(--ap-line)' : correct === true ? '#4dd9a0' : correct === false ? '#ff9e96' : '#89b4ff'}`,
                  title: `Q${i + 1}`,
                }}>
                  {i + 1}
                </div>
```

to:

```tsx
                <div key={qId} title={`Q${i + 1}`} style={{
                  width: 28, height: 28, borderRadius: 6, fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: noAnswer ? 'var(--ap-paper-2)' : correct === true ? '#e8faf3' : correct === false ? '#fff3f0' : '#eef4ff',
                  color: noAnswer ? 'var(--ap-muted)' : correct === true ? '#15c08a' : correct === false ? '#ff5a4d' : '#2f7bff',
                  border: `1.5px solid ${noAnswer ? 'var(--ap-line)' : correct === true ? '#4dd9a0' : correct === false ? '#ff9e96' : '#89b4ff'}`,
                }}>
                  {i + 1}
                </div>
```

(This also fixes a minor accessibility gap — hovering the square now shows "Q1", "Q2", etc.)

- [ ] **Step 6: Fix `Index.tsx:340` — dead destructuring of non-existent fields**

None of the `contentTypes` entries define `title`, `desc`, or `cta` — every entry only has `titleKey`/`descKey`/`ctaKey` (all truthy `as const` strings), so the `title`/`desc`/`cta` fallback branches are unreachable dead code that also fails to type-check. Change:

```tsx
          {contentTypes.map(({ key, label, titleKey, title, descKey, desc, ctaKey, cta, accentVar, accentDeepVar, badgeClass, btnClass, icon, route }) => {
            const resolvedTitle = titleKey ? t(titleKey) : (title as string);
            const resolvedDesc = descKey ? t(descKey) : (desc as string);
            const resolvedCta = ctaKey ? t(ctaKey) : (cta as string);
```

to:

```tsx
          {contentTypes.map(({ key, label, titleKey, descKey, ctaKey, accentVar, accentDeepVar, badgeClass, btnClass, icon, route }) => {
            const resolvedTitle = t(titleKey);
            const resolvedDesc = t(descKey);
            const resolvedCta = t(ctaKey);
```

- [ ] **Step 7: Run typecheck to verify it passes**

Run: `npm run typecheck`
Expected: exit 0, no errors.

- [ ] **Step 8: Run the full test suite + build to confirm no regressions**

Run: `npm test && npm run build`
Expected: both succeed.

- [ ] **Step 9: Commit**

```bash
git add package.json src/components/RichTextEditor.tsx src/lib/courseGenerator.ts src/pages/ExamAdmin.tsx src/pages/Index.tsx
git commit -m "fix(types): resolve 6 tsc errors and add typecheck script"
```

---

## Task 4: Add CI workflow gating lint + typecheck + test (audit H-5)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm test

      - name: Build
        run: npm run build
```

- [ ] **Step 2: Verify locally that every step in the workflow currently passes**

Run each command exactly as the workflow does:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: `lint` still reports the pre-existing 230 errors/44 warnings from `AUDIT_CODE.md` §2 — **this workflow does not yet fail the build on lint errors** (see note below), but `typecheck`, `test`, and `build` must all exit 0 given Task 3's fixes.

> **Scope note:** `npm run lint` currently has 230 pre-existing errors (mostly `@typescript-eslint/no-explicit-any`) unrelated to this audit's P0/P1 items. Making `lint` a hard gate today would block all future PRs on unrelated pre-existing debt. This workflow **runs** lint (so the count is visible in every PR) but treating it as a merge-blocking gate is a separate, explicitly scoped cleanup task — track it in `AUDIT_CODE.md` M-6 follow-up rather than silently failing this CI job.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add lint/typecheck/test/build workflow"
```

- [ ] **Step 4: Push the branch and confirm the workflow runs**

```bash
git push -u origin HEAD
```

Then check the Actions tab (or `gh run list --limit 1`) to confirm the workflow triggered and its steps match Step 2's local results.

---

## Task 5: Mitigate the `xlsx` prototype-pollution/ReDoS exposure (audit H-3)

`npm audit` reports `xlsx` has **no available fix** upstream. Swapping the library is a separate evaluation (out of scope here — it touches both import and export code paths and needs a compatibility check). The concrete, scoped mitigation available today: shrink the attack surface by rejecting oversized files before they ever reach `XLSX.read()`, and apply `npm audit fix` to the two dependencies that **do** have a fix (`rollup`, `yaml` — both dev-only, non-breaking).

**Files:**
- Modify: `src/components/QuestionBank.tsx`
- Test: `src/lib/__tests__/fileValidation.test.ts`
- Create: `src/lib/fileValidation.ts`

- [ ] **Step 1: Apply the available upstream fixes**

```bash
npm audit fix
npm audit
```

Expected: `rollup` and `yaml` advisories gone; `xlsx` advisory remains (no fix available — expected, not a regression).

- [ ] **Step 2: Write the failing test for a file-size guard**

Create `src/lib/__tests__/fileValidation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { assertSafeImportFile } from '../fileValidation';

function makeFile(sizeBytes: number, name = 'questions.xlsx'): File {
  return new File([new Uint8Array(sizeBytes)], name);
}

describe('assertSafeImportFile', () => {
  it('accepts a file under the size limit', () => {
    expect(() => assertSafeImportFile(makeFile(1024))).not.toThrow();
  });

  it('rejects a file over 5MB', () => {
    expect(() => assertSafeImportFile(makeFile(6 * 1024 * 1024))).toThrow(/trop volumineux/i);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/fileValidation.test.ts`
Expected: FAIL — `Cannot find module '../fileValidation'`

- [ ] **Step 4: Write the implementation**

Create `src/lib/fileValidation.ts`:

```ts
const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024; // 5MB

/** Rejects import files above a size cap before they reach xlsx/js-yaml parsing,
 *  bounding the blast radius of known prototype-pollution/ReDoS issues in those parsers. */
export function assertSafeImportFile(file: File): void {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error(`Fichier trop volumineux (max ${MAX_IMPORT_FILE_BYTES / 1024 / 1024} Mo).`);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/fileValidation.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Wire the guard into `QuestionBank.tsx`**

Add the import near the top of `src/components/QuestionBank.tsx` (alongside the `xlsx` import):

```ts
import { assertSafeImportFile } from "@/lib/fileValidation";
```

In `handleFileImport`, guard before reading the file:

```ts
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      assertSafeImportFile(file);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fichier invalide");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
```

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all suites pass (authMigration, sanitizeHtml, fileValidation).

- [ ] **Step 8: Commit**

```bash
npm audit fix
git add package.json package-lock.json src/lib/fileValidation.ts src/lib/__tests__/fileValidation.test.ts src/components/QuestionBank.tsx
git commit -m "fix(security): patch fixable npm advisories, cap import file size"
```

---

## Task 6: Shrink oversized JS bundles (audit H-7)

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/components/QuestionBank.tsx`

- [ ] **Step 1: Confirm the current baseline**

Run: `npm run build`
Expected (matches audit): `index-*.js` ~537 kB, `index-*.js` ~495 kB, `CourseBuilder-*.js` ~431 kB, `PollResults-*.js` ~373 kB (before gzip).

- [ ] **Step 2: Add `manualChunks` to split heavy third-party libs out of the main bundle**

In `vite.config.ts`, add a `build` block:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          editor: ["@tiptap/react", "@tiptap/starter-kit", "@tiptap/pm", "@tiptap/extension-link", "@tiptap/extension-placeholder", "@tiptap/extension-text-align", "@tiptap/extension-underline"],
          dnd: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
        },
      },
    },
  },
}));
```

- [ ] **Step 3: Convert the static `xlsx` import to a dynamic import**

`xlsx` (~429 kB unpacked) is currently imported statically in `src/components/QuestionBank.tsx:8` (`import * as XLSX from 'xlsx';`), pulling it into whatever chunk that component lands in even for users who never import/export Excel files. Remove the static import:

```ts
import * as XLSX from 'xlsx';
```

Replace both usage sites with lazy dynamic imports. In `handleFileImport`:

```ts
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      assertSafeImportFile(file);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fichier invalide");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet) as any[];
```

(leave the rest of the `try` block — the `imported`/`saveQuestions`/`toast.success` lines — unchanged; only the function became `async` and the module is now imported lazily inside it)

And in `exportToExcel`:

```ts
  const exportToExcel = async () => {
    const XLSX = await import('xlsx');
    const exportData = savedQuestions.map(q => ({
      question: q.question,
      type: q.type,
      answers: q.answers.join('|'),
      correctAnswer: q.correctAnswer,
      timeLimit: q.timeLimit,
      points: q.points
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");
    XLSX.writeFile(wb, "questions-export.xlsx");
    toast.success("Questions exportées");
  };
```

- [ ] **Step 4: Rebuild and compare bundle sizes**

Run: `npm run build`
Expected: a new `xlsx-*.js` (or similarly named) chunk appears, separate from the chunk containing `QuestionBank`; the `charts`/`editor`/`dnd` manual chunks appear; no single chunk should have grown relative to the Step 1 baseline.

- [ ] **Step 5: Manually verify Excel import/export still works**

Run: `npm run dev`, open the question bank UI, import a small `.xlsx` file, then export — confirm both operations complete without console errors (dynamic `import()` resolves correctly in dev and prod builds).

- [ ] **Step 6: Run typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: both pass (note `exportToExcel` is now `async` — check any caller doesn't need to `await` it; if a caller is a plain `onClick={exportToExcel}`, that remains valid since React ignores the returned promise).

- [ ] **Step 7: Commit**

```bash
git add vite.config.ts src/components/QuestionBank.tsx
git commit -m "perf: split heavy deps into manual chunks, lazy-load xlsx"
```

---

## Task 7: Resolve the duplicate lockfile (audit M-4)

**Files:**
- Delete: `bun.lockb`
- Modify: `.gitignore`

- [ ] **Step 1: Confirm npm is the lockfile of record**

`package-lock.json` is actively maintained (last modified alongside `package.json`); `bun.lockb` is stale and no `bun`-specific scripts exist anywhere in the repo or CI. Standardize on npm.

- [ ] **Step 2: Remove the stale lockfile**

```bash
git rm bun.lockb
```

- [ ] **Step 3: Prevent it from silently reappearing**

Add to `.gitignore` (near the existing `node_modules`/`dist` block):

```
bun.lockb
```

- [ ] **Step 4: Confirm npm install still works cleanly**

Run: `rm -rf node_modules && npm ci`
Expected: clean install, no errors.

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: remove stale bun.lockb, standardize on npm"
```

---

## Self-Review

**Spec coverage** — every item explicitly assigned to this phase is covered:
- C-3 (XSS) → Task 1
- H-4 (CSP) → Task 2
- H-5 (masked tsc failure + no CI) → Tasks 3 & 4
- H-3 (npm vulns, xlsx exposure) → Task 5
- H-7 (bundle size) → Task 6
- M-4 (dual lockfile) → Task 7

Items C-1, C-2, C-4, H-1, H-2, H-6 are explicitly deferred (see header) because they require a backend architecture decision not yet made — attempting to plan them now would produce placeholder steps ("call the scoring API" with no API defined), which this skill's rules forbid.

**Placeholder scan** — every step has real, complete code (no "TODO", no "add appropriate error handling" prose, no unresolved references). Reviewed and clean.

**Type consistency** — `sanitizeHtml(html: string): string` used identically in Task 1 Steps 4 and 6; `assertSafeImportFile(file: File): void` used identically in Task 5 Steps 4 and 6; `manualChunks` keys (`charts`/`editor`/`dnd`) don't collide with any existing chunk name seen in the audit's build output. Consistent.

---

## H-7 Follow-up Notes (bundle splitting — reverted, not solved)

Task 6's `manualChunks` approach as originally specified in this plan was implemented, reviewed, and **reverted** after two regressions found during code review:

1. **Attempt 1** (`manualChunks` grouping `recharts`→`charts`, TipTap→`editor`, dnd-kit→`dnd`) caused Vite to inject eager `<link rel="modulepreload">` for all three chunks (~964 kB combined) into the root `dist/index.html`, fetched on every page load — including the live-quiz player critical path, which uses none of these libraries. Roughly doubled first-paint JS for the app's most latency-sensitive route.

   ```ts
   build: {
     rollupOptions: {
       output: {
         manualChunks: {
           charts: ["recharts"],
           editor: ["@tiptap/react", "@tiptap/starter-kit", "@tiptap/extension-link", "@tiptap/extension-placeholder", "@tiptap/extension-text-align", "@tiptap/extension-underline"],
           dnd: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
         },
       },
     },
   },
   ```
   (`@tiptap/pm` had to be omitted — it has no root package export, only subpath exports like `@tiptap/pm/state`, so Rollup can't resolve it as a bare `manualChunks` specifier.)

2. **Attempt 2** tried suppressing the preload hint via `build.modulePreload.resolveDependencies`, filtering out chunks matching `/charts|editor|dnd-/`:
   ```ts
   modulePreload: {
     resolveDependencies: (filename, deps) =>
       deps.filter((dep) => !/\/(charts|editor|dnd)-/.test(dep)),
   },
   ```
   This removed the HTML preload hint, but code-review found the **actual module graph** still had static `import` edges from the main entry chunk into all three vendor chunks (confirmed by grepping the built entry `.js` for `import{...}from"./editor-*.js"` etc.). `resolveDependencies` only filters a resource hint — it can't sever a real static import edge. The three chunks were still eagerly fetched and executed on every page load, just serialized instead of parallelized (arguably worse).

**Root cause (unconfirmed, needs investigation with a real tool before retrying):** some shared low-level module used by both the app entry and these vendor packages appears to have been physically placed inside one of the manual chunk buckets by Rollup's chunking algorithm, creating a real cross-link. Recommend using `rollup-plugin-visualizer` (or `vite-bundle-visualizer`) to inspect the actual module graph before attempting `manualChunks` again, rather than guessing at package groupings.

**Also worth knowing before retrying:** neither `recharts` (used only by `PollResults.tsx`) nor the TipTap packages (used only by `CourseBuilder.tsx`) are shared across routes — vendor-splitting them provides no cross-route de-duplication benefit; the only theoretical upside is long-term browser-cache reuse across deploys. `@dnd-kit/*` genuinely is shared across 5 routes (`FolderCard.tsx`, `QuizBuilder.tsx`, `MyFlashcards.tsx`, `MyPolls.tsx`, `MyQuizzes.tsx`), but isolating it alone would not shrink the two chunks the audit actually flagged (`CourseBuilder` ~433 kB, `PollResults` ~372 kB) — those are large because they're each the sole consumer of a heavy library, not because of cross-route duplication. A real fix for those two specific chunks likely needs a different technique — e.g. dynamically importing `RichTextEditor`/`recharts` only at the point of use within the page, rather than vendor-level splitting.

**Current state:** `vite.config.ts` is unchanged from before this plan (no `build` block). `CourseBuilder`/`PollResults` remain large but correctly lazy-loaded only when their routes are visited — not eagerly fetched elsewhere. H-7 (audit finding) remains open.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-12-audit-remediation-phase1.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
