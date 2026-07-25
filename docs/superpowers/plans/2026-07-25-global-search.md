# Global Search Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a search input to the app's top header that finds the logged-in user's content (quiz/poll/flashcard/slide/course/exam) by title and jumps straight to its editor.

**Architecture:** Pure client-side. One `ilike` query against the existing polymorphic `content` Supabase table, a small pure mapping/routing module (unit-tested), and a self-contained `GlobalSearch` component mounted in `AppLayout`'s header.

**Tech Stack:** React + TypeScript, react-router-dom, Supabase JS client, Vitest.

Spec: `docs/superpowers/specs/2026-07-25-global-search-design.md`

---

## File Structure

- Create: `apps/app/src/lib/content/searchContent.ts` — `SearchResult` type, `mapSearchRows` (pure), `getSearchResultRoute` (pure), `searchContent` (Supabase query). Pure helpers colocated with the async wrapper because they're small and single-consumer; kept out of `contentRepo.ts` to keep that file's CRUD focus intact.
- Create: `apps/app/src/lib/content/__tests__/searchContent.test.ts` — tests for the two pure functions.
- Create: `apps/app/src/components/GlobalSearch.tsx` — the header search input + dropdown.
- Modify: `apps/app/src/lib/i18n.ts` — add `searchPlaceholder`, `searchNoResults` keys (en + fr blocks).
- Modify: `apps/app/src/components/AppLayout.tsx` — mount `<GlobalSearch user={user} />` in the header.

---

### Task 1: Pure search-mapping helpers (TDD)

**Files:**
- Create: `apps/app/src/lib/content/searchContent.ts`
- Test: `apps/app/src/lib/content/__tests__/searchContent.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/app/src/lib/content/__tests__/searchContent.test.ts
import { describe, it, expect } from 'vitest';

// searchContent.ts imports the real Supabase client at module load (for the
// searchContent() query fn); stub it so the pure helpers can be tested
// without VITE_SUPABASE_URL in the env — same pattern as foldersRepo.test.ts.
import { vi } from 'vitest';
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import { mapSearchRows, getSearchResultRoute } from '../searchContent';

describe('mapSearchRows', () => {
  it('drops trashed rows, keeps the rest shaped for display', () => {
    const rows = [
      { id: 'row-1', type: 'quiz', data: { id: 'item-1', title: 'Capitales du monde' } },
      { id: 'row-2', type: 'poll', data: { id: 'item-2', title: 'Sondage', deletedAt: '2026-01-01' } },
    ];
    expect(mapSearchRows(rows)).toEqual([
      { rowId: 'row-1', itemId: 'item-1', type: 'quiz', title: 'Capitales du monde' },
    ]);
  });

  it('falls back to the Supabase row id when data.id is missing', () => {
    const rows = [{ id: 'row-3', type: 'course', data: { title: 'Cours SVT' } }];
    expect(mapSearchRows(rows)).toEqual([
      { rowId: 'row-3', itemId: 'row-3', type: 'course', title: 'Cours SVT' },
    ]);
  });

  it('caps results at 8', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      id: `row-${i}`,
      type: 'quiz',
      data: { id: `item-${i}`, title: `Quiz ${i}` },
    }));
    expect(mapSearchRows(rows)).toHaveLength(8);
  });
});

describe('getSearchResultRoute', () => {
  it('maps every content type to its editor route', () => {
    expect(getSearchResultRoute('quiz', 'id1')).toBe('/builder?type=quiz&quizId=id1');
    expect(getSearchResultRoute('poll', 'id1')).toBe('/builder?type=poll&quizId=id1');
    expect(getSearchResultRoute('flashcard', 'id1')).toBe('/builder?type=flashcard&quizId=id1');
    expect(getSearchResultRoute('slide', 'id1')).toBe('/presentation-editor?id=id1');
    expect(getSearchResultRoute('course', 'id1')).toBe('/course-builder?courseId=id1');
    expect(getSearchResultRoute('exam', 'id1')).toBe('/exam-builder?examId=id1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/app && npx vitest run src/lib/content/__tests__/searchContent.test.ts`
Expected: FAIL — `../searchContent` has no exported member `mapSearchRows` (module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```typescript
// apps/app/src/lib/content/searchContent.ts
import { supabase } from '@/lib/supabase';
import { CONTENT_TYPES, type ContentType } from './types';

export interface SearchResult {
  rowId: string;
  itemId: string;
  type: ContentType;
  title: string;
}

interface SearchRow {
  id: string;
  type: string;
  data: Record<string, unknown> | null;
}

/** Drop trashed rows, cap at 8, shape rows for display. Pure — no I/O. */
export function mapSearchRows(rows: SearchRow[]): SearchResult[] {
  return rows
    .filter((row) => !row.data?.deletedAt)
    .slice(0, 8)
    .map((row) => ({
      rowId: row.id,
      itemId: String((row.data?.id as string | undefined) ?? row.id),
      type: row.type as ContentType,
      title: String(row.data?.title ?? ''),
    }));
}

/** Each content type's existing editor route (mirrors MyQuizzes/MyPolls/MyFlashcards/
 *  MySlides' `editRoute` configs and MyCourses/MyExams' inline navigate() targets). */
export function getSearchResultRoute(type: ContentType, id: string): string {
  switch (type) {
    case 'quiz':
      return `/builder?type=quiz&quizId=${id}`;
    case 'poll':
      return `/builder?type=poll&quizId=${id}`;
    case 'flashcard':
      return `/builder?type=flashcard&quizId=${id}`;
    case 'slide':
      return `/presentation-editor?id=${id}`;
    case 'course':
      return `/course-builder?courseId=${id}`;
    case 'exam':
      return `/exam-builder?examId=${id}`;
  }
}

/** Search the current user's content across all types by title (case-insensitive substring). */
export async function searchContent(userId: string, query: string): Promise<SearchResult[]> {
  const { data, error } = await supabase
    .from('content')
    .select('id,type,data')
    .eq('user_id', userId)
    .in('type', CONTENT_TYPES as unknown as string[])
    .ilike('data->>title', `%${query}%`)
    .order('updated_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return mapSearchRows((data ?? []) as SearchRow[]);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/app && npx vitest run src/lib/content/__tests__/searchContent.test.ts`
Expected: PASS — 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/lib/content/searchContent.ts apps/app/src/lib/content/__tests__/searchContent.test.ts
git commit -m "feat(app): add searchContent + route-lookup helpers"
```

---

### Task 2: i18n keys

**Files:**
- Modify: `apps/app/src/lib/i18n.ts:22-23` (en block) and `apps/app/src/lib/i18n.ts:434-435` (fr block)

- [ ] **Step 1: Add the English keys**

In the `en` block, `creationTypeExam` is immediately followed by `createNew`:

```typescript
    creationTypeExam: "Exams",
    createNew: "Create",
```

Change to:

```typescript
    creationTypeExam: "Exams",
    searchPlaceholder: "Search your content…",
    searchNoResults: "No results",
    createNew: "Create",
```

- [ ] **Step 2: Add the French keys**

In the `fr` block, the same two lines read:

```typescript
    creationTypeExam: "Examens",
    createNew: "Créer",
```

Change to:

```typescript
    creationTypeExam: "Examens",
    searchPlaceholder: "Rechercher dans vos contenus…",
    searchNoResults: "Aucun résultat",
    createNew: "Créer",
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/app && npm run typecheck`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/app/src/lib/i18n.ts
git commit -m "feat(app): add global search i18n strings"
```

---

### Task 3: GlobalSearch component

**Files:**
- Create: `apps/app/src/components/GlobalSearch.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/app/src/components/GlobalSearch.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, BookOpen, ClipboardList, GraduationCap, Layers, Presentation, Search } from "lucide-react";
import { t } from "@/lib/i18n";
import type { User as AuthUser } from "@/lib/auth";
import type { ContentType } from "@/lib/content/types";
import { getSearchResultRoute, searchContent, type SearchResult } from "@/lib/content/searchContent";

type LabelKey = "creationTypeQuiz" | "creationTypePoll" | "creationTypeFlashcard" | "creationTypeSlide" | "creationTypeCourse" | "creationTypeExam";

const TYPE_META: Record<ContentType, { icon: typeof BookOpen; labelKey: LabelKey }> = {
  quiz: { icon: BookOpen, labelKey: "creationTypeQuiz" },
  poll: { icon: BarChart3, labelKey: "creationTypePoll" },
  flashcard: { icon: Layers, labelKey: "creationTypeFlashcard" },
  slide: { icon: Presentation, labelKey: "creationTypeSlide" },
  course: { icon: GraduationCap, labelKey: "creationTypeCourse" },
  exam: { icon: ClipboardList, labelKey: "creationTypeExam" },
};

interface GlobalSearchProps {
  user: AuthUser | null;
}

export const GlobalSearch = ({ user }: GlobalSearchProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!user || trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      searchContent(user.id, trimmed)
        .then((found) => {
          setResults(found);
          setHighlighted(0);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, user]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const openResult = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    navigate(getSearchResultRoute(result.type, result.itemId));
  };

  if (!user) return null;

  return (
    <div ref={containerRef} style={{ position: "relative", flex: 1, maxWidth: 420 }}>
      <div style={{ position: "relative" }}>
        <Search
          className="h-4 w-4"
          style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ap-muted)", pointerEvents: "none" }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length) setOpen(true); }}
          onKeyDown={(e) => {
            if (!open || results.length === 0) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((i) => (i + 1) % results.length); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((i) => (i - 1 + results.length) % results.length); }
            else if (e.key === "Enter") { e.preventDefault(); openResult(results[highlighted]); }
            else if (e.key === "Escape") { setOpen(false); }
          }}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          style={{
            width: "100%",
            height: 38,
            padding: "0 12px 0 34px",
            borderRadius: "var(--ap-r-lg)",
            border: "var(--ap-border-w) solid var(--ap-line)",
            background: "var(--ap-paper-2)",
            color: "var(--ap-ink)",
            fontFamily: "var(--ap-font-body)",
            fontSize: 13,
            outline: "none",
          }}
        />
      </div>

      {open && (
        <div
          className="z-50"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "var(--ap-card)",
            border: "var(--ap-border-w) solid var(--ap-line)",
            borderRadius: "var(--ap-r-lg)",
            boxShadow: "var(--ap-shadow-card)",
            overflow: "hidden",
          }}
        >
          {results.length === 0 ? (
            <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--ap-muted)" }}>
              {loading ? "…" : t("searchNoResults")}
            </div>
          ) : (
            results.map((result, i) => {
              const meta = TYPE_META[result.type];
              const Icon = meta.icon;
              return (
                <button
                  key={result.rowId}
                  type="button"
                  onMouseEnter={() => setHighlighted(i)}
                  onClick={() => openResult(result)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "8px 12px",
                    background: i === highlighted ? "var(--ap-brand-soft)" : "transparent",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "var(--ap-font-body)",
                  }}
                >
                  <Icon className="h-4 w-4" style={{ color: "var(--ap-muted)", flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: "var(--ap-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {result.title || t("untitled")}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "var(--ap-muted)", flexShrink: 0 }}>
                    {t(meta.labelKey)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/app/src/components/GlobalSearch.tsx
git commit -m "feat(app): add GlobalSearch header component"
```

---

### Task 4: Mount in AppLayout

**Files:**
- Modify: `apps/app/src/components/AppLayout.tsx`

- [ ] **Step 1: Import the component**

In `apps/app/src/components/AppLayout.tsx`, add to the imports (near the other component imports, after the `AppSidebar` import at line 17):

```typescript
import { AppSidebar } from "@/components/AppSidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
```

- [ ] **Step 2: Render it between the logo block and the account menu**

The header currently reads (`AppLayout.tsx:91-106`):

```tsx
          <div
            className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-80"
            onClick={() => (user ? navigate("/my-quizzes") : (window.location.href = "/"))}
          >
            <span className="ap-logo">
              <BrandMonogram size={22} />
            </span>
            <div>
              <BrandWordmark size={20} />
              {subtitle && (
                <p className="text-xs font-semibold mt-0.5" style={{ color: "var(--ap-muted)" }}>{subtitle}</p>
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
```

Insert `<GlobalSearch user={user} />` right after the logo `</div>` and before the account-menu `<div className="ml-auto ...">`:

```tsx
          <div
            className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-80"
            onClick={() => (user ? navigate("/my-quizzes") : (window.location.href = "/"))}
          >
            <span className="ap-logo">
              <BrandMonogram size={22} />
            </span>
            <div>
              <BrandWordmark size={20} />
              {subtitle && (
                <p className="text-xs font-semibold mt-0.5" style={{ color: "var(--ap-muted)" }}>{subtitle}</p>
              )}
            </div>
          </div>

          <GlobalSearch user={user} />

          <div className="ml-auto flex items-center gap-2">
```

- [ ] **Step 3: Typecheck and build**

Run: `cd apps/app && npm run typecheck && npm run build`
Expected: both succeed with no new errors.

- [ ] **Step 4: Manual check**

Run: `cd apps/app && npm run dev`, log in, type 2+ characters of an existing quiz/poll/course title into the new header search box, confirm the dropdown shows it with the right icon/type label, click it, confirm it lands on that item's editor route (`/builder?...`, `/course-builder?...`, etc. per `getSearchResultRoute`).

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/components/AppLayout.tsx
git commit -m "feat(app): mount GlobalSearch in the app header"
```

---

## Self-Review Notes

- **Spec coverage:** query/debounce/limit-8/dedup-trashed → Task 1 + 3; component placement/keyboard nav/click-outside → Task 3; routing map → Task 1; i18n strings → Task 2; mount point → Task 4. No gaps.
- **Placeholders:** none — every step has real code or an exact command.
- **Type consistency:** `SearchResult`, `getSearchResultRoute`, `searchContent` signatures match between Task 1 (definition) and Task 3 (consumption). `ContentType` reused from `./types`, not redefined.
