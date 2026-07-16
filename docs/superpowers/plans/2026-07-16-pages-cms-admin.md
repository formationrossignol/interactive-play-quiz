# Pages CMS Admin UI (SP3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins an in-app `/admin` page to CRUD the CMS content (roadmap, changelog, guides, FAQ), moderate submissions (reviews, ideas, reports), and view changelog subscribers — no SQL.

**Architecture:** RLS already authorizes admins (SP1/SP2), so SP3 is front-only: a `useIsAdmin` gate, an `adminRepo`/`adminHooks` data layer whose reads include draft/pending rows and whose mutations invalidate both admin and public query keys, and a tabbed `/admin` page built from existing shadcn components. `RichTextEditor` (TipTap) edits `guides.body` and `changelog.intro`; the public changelog renders the (now-HTML) intro through `sanitizeHtml`.

**Tech Stack:** React 18, `@tanstack/react-query`, shadcn UI (`Tabs`, `Dialog`, `AlertDialog`, `Table`, `Select`, `Switch`, `Textarea`, `Badge`, `Button`, `Input`), existing `RichTextEditor` and `sanitizeHtml`. No new DB objects.

**Depends on:** SP1 + SP2 (both built; SP1 deployed, SP2 migration pending deploy — SP3 needs SP2 tables in prod to exercise moderation, but its code compiles/tests without a DB).

---

## File Structure

**Created:**
- `src/lib/pages/adminRepo.ts` — admin reads (all statuses) + CRUD/status/moderation/subscriber mutations.
- `src/lib/pages/adminHooks.ts` — React Query hooks wrapping adminRepo with cross-invalidation.
- `src/lib/pages/useIsAdmin.ts` — admin gate hook + `fetchMyRole`.
- `src/pages/admin/Admin.tsx` — gate + tabbed container.
- `src/pages/admin/ContentTab.tsx` — resource selector + table + delete/status.
- `src/pages/admin/editors/RoadmapEditor.tsx`, `GuideEditor.tsx`, `FaqEditor.tsx`, `ChangelogEditor.tsx` — Dialog forms.
- `src/pages/admin/ModerationTab.tsx` — reviews / ideas / reports queues.
- `src/pages/admin/SubscribersTab.tsx` — count + table.
- `src/lib/pages/__tests__/adminRepo.test.ts` — pure-logic tests (`toRoadmapInsert`, `convertIdea` shaping).

**Modified:**
- `src/lib/pages/types.ts` — add admin row types (full rows incl. status/sort) and input types.
- `src/App.tsx` — lazy `Admin` + `/admin` route.
- `src/pages/Changelog.tsx` — render intro via `sanitizeHtml` (HTML).
- `src/components/Header.tsx` — conditional "Admin" link.

---

## Task 1: Admin gate — useIsAdmin + Admin shell + route

**Files:**
- Create: `src/lib/pages/useIsAdmin.ts`
- Create: `src/pages/admin/Admin.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write `useIsAdmin.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export async function fetchMyRole(): Promise<'user' | 'admin' | null> {
  const uid = getCurrentUser()?.id;
  if (!uid) return null;
  const { data, error } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
  if (error) throw error;
  return (data?.role as 'user' | 'admin' | undefined) ?? null;
}

export function useIsAdmin() {
  const query = useQuery({ queryKey: ['admin', 'role'], queryFn: fetchMyRole });
  return { isAdmin: query.data === 'admin', isLoading: query.isLoading };
}
```

- [ ] **Step 2: Write `Admin.tsx` shell (gate + empty tabs)**

```tsx
import { Navigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSEO } from "@/hooks/useSEO";
import { useIsAdmin } from "@/lib/pages/useIsAdmin";
import { ContentTab } from "./ContentTab";
import { ModerationTab } from "./ModerationTab";
import { SubscribersTab } from "./SubscribersTab";

const Admin = () => {
  const { isAdmin, isLoading } = useIsAdmin();
  useSEO({ title: "Administration", description: "Gestion du contenu et modération.", path: "/admin" });

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Header />
        <main className="lq" style={{ flex: 1, display: "grid", placeItems: "center" }}>Chargement…</main>
        <Footer />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <main className="lq" style={{ flex: 1 }}>
        <div className="wrap">
          <div className="page-hero">
            <span className="eyebrow">Administration</span>
            <h1>Console de gestion</h1>
          </div>
          <Tabs defaultValue="content">
            <TabsList>
              <TabsTrigger value="content">Contenu</TabsTrigger>
              <TabsTrigger value="moderation">Modération</TabsTrigger>
              <TabsTrigger value="subscribers">Abonnés</TabsTrigger>
            </TabsList>
            <TabsContent value="content"><ContentTab /></TabsContent>
            <TabsContent value="moderation"><ModerationTab /></TabsContent>
            <TabsContent value="subscribers"><SubscribersTab /></TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;
```

Note: `ContentTab`, `ModerationTab`, `SubscribersTab` are created in later tasks. To let this task compile and be committed independently, create minimal stub files now, each exporting a named component returning `null` (they are fully implemented in Tasks 4, 6, 7). Create:
- `src/pages/admin/ContentTab.tsx`: `export const ContentTab = () => null;`
- `src/pages/admin/ModerationTab.tsx`: `export const ModerationTab = () => null;`
- `src/pages/admin/SubscribersTab.tsx`: `export const SubscribersTab = () => null;`

- [ ] **Step 3: Register the route in `src/App.tsx`**

Add near the other lazy imports:

```tsx
const Admin = lazy(() => import("./pages/admin/Admin"));
```

Add the route alongside the others (before the `*` catch-all):

```tsx
              <Route path="/admin" element={<Admin />} />
```

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/lib/pages/useIsAdmin.ts src/pages/admin/*.tsx src/App.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pages/useIsAdmin.ts src/pages/admin/Admin.tsx src/pages/admin/ContentTab.tsx src/pages/admin/ModerationTab.tsx src/pages/admin/SubscribersTab.tsx src/App.tsx
git commit -m "feat(admin): /admin route with is_admin gate + tab shell"
```

---

## Task 2: Admin types

**Files:**
- Modify: `src/lib/pages/types.ts`

- [ ] **Step 1: Append admin row + input types**

Append to `src/lib/pages/types.ts`:

```typescript
// ── Admin rows (full, incl. status/sort) ────────────────────────────────────
export type Status = 'draft' | 'published';

export interface RoadmapAdminRow {
  id: string; col: RoadmapCol; category: string; title: string; subtitle: string;
  tags: RoadmapTag[]; beta: boolean; locked: boolean; base_votes: number;
  shipped_label: string | null; shipped_link: boolean; status: Status; sort: number;
}
export interface GuideAdminRow {
  id: string; emoji: string; cover_token: string; duration_label: string; title: string;
  level: 'deb' | 'int' | 'avc'; format: 'video' | 'article'; url: string | null;
  body: string | null; status: Status; sort: number;
}
export interface FaqAdminRow {
  id: string; category: string; question: string; answer: string; status: Status; sort: number;
}
export interface ReleaseAdminRow {
  id: string; version: string; title: string; date_label: string;
  intro: string | null; media: string | null; status: Status; sort: number;
}
export interface ChangelogItemAdminRow {
  id: string; release_id: string; kind: ChangelogKind; text: string; from_votes: boolean; sort: number;
}

export interface PendingReview {
  id: string; persona: ReviewPersona; stars: number; text: string;
  author_name: string; author_role: string; created_at: string;
}
export interface IdeaRow {
  id: string; user_id: string; text: string; status: 'pending' | 'converted' | 'rejected'; created_at: string;
}
export interface AdminReportRow {
  id: string; user_id: string; type: ReportType; severity: ReportSeverity;
  title: string; body: string; status: ReportStatus; created_at: string;
}
export interface SubscriberRow { user_id: string; created_at: string; }
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pages/types.ts
git commit -m "feat(admin): admin row + input types"
```

---

## Task 3: adminRepo + one pure test

**Files:**
- Create: `src/lib/pages/adminRepo.ts`
- Create: `src/lib/pages/__tests__/adminRepo.test.ts`

- [ ] **Step 1: Write the failing test for the pure helper**

```typescript
// src/lib/pages/__tests__/adminRepo.test.ts
import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: () => ({ id: 'u1' }) }));
import { ideaToRoadmapInsert } from '../adminRepo';

describe('ideaToRoadmapInsert', () => {
  it('shapes a draft roadmap row from an idea conversion', () => {
    const row = ideaToRoadmapInsert({ col: 'idea', category: 'builder', title: 'T', subtitle: 'S' });
    expect(row).toEqual({
      col: 'idea', category: 'builder', title: 'T', subtitle: 'S',
      tags: [], beta: false, locked: false, base_votes: 0,
      shipped_label: null, shipped_link: false, status: 'draft', sort: 0,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pages/__tests__/adminRepo.test.ts`
Expected: FAIL — `ideaToRoadmapInsert` not exported.

- [ ] **Step 3: Write `adminRepo.ts`**

```typescript
import { supabase } from '@/lib/supabase';
import type {
  RoadmapAdminRow, GuideAdminRow, FaqAdminRow, ReleaseAdminRow, ChangelogItemAdminRow,
  PendingReview, IdeaRow, AdminReportRow, SubscriberRow,
  Status, ReportStatus,
} from './types';

const throwIf = <T>({ data, error }: { data: T; error: unknown }): T => {
  if (error) throw error;
  return data;
};

// ── Generic content list / status / delete ──────────────────────────────────
async function listAll<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').order('sort', { ascending: true });
  if (error) throw error;
  return (data ?? []) as T[];
}

export const listRoadmap = () => listAll<RoadmapAdminRow>('roadmap_items');
export const listGuides = () => listAll<GuideAdminRow>('guides');
export const listFaq = () => listAll<FaqAdminRow>('faq_items');
export const listReleases = () => listAll<ReleaseAdminRow>('changelog_releases');

export async function listReleaseItems(releaseId: string): Promise<ChangelogItemAdminRow[]> {
  const { data, error } = await supabase.from('changelog_items').select('*')
    .eq('release_id', releaseId).order('sort', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChangelogItemAdminRow[];
}

export async function createRow(table: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from(table).insert(values);
  if (error) throw error;
}
export async function updateRow(table: string, id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from(table).update(patch).eq('id', id);
  if (error) throw error;
}
export async function deleteRow(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}
export const setStatus = (table: string, id: string, status: Status) => updateRow(table, id, { status });

// ── Moderation ───────────────────────────────────────────────────────────────
export async function listReviews(status = 'pending'): Promise<PendingReview[]> {
  const { data, error } = await supabase.from('reviews')
    .select('id,persona,stars,text,author_name,author_role,created_at')
    .eq('status', status).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PendingReview[];
}
export const setReviewStatus = (id: string, status: 'published' | 'rejected') =>
  updateRow('reviews', id, { status });

export async function listIdeas(status = 'pending'): Promise<IdeaRow[]> {
  const { data, error } = await supabase.from('roadmap_ideas').select('*')
    .eq('status', status).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as IdeaRow[];
}
export const setIdeaStatus = (id: string, status: 'converted' | 'rejected') =>
  updateRow('roadmap_ideas', id, { status });

/** Pure: shape a draft roadmap_items insert from an idea-conversion form. */
export function ideaToRoadmapInsert(input: { col: string; category: string; title: string; subtitle: string }) {
  return {
    col: input.col, category: input.category, title: input.title, subtitle: input.subtitle,
    tags: [], beta: false, locked: false, base_votes: 0,
    shipped_label: null, shipped_link: false, status: 'draft', sort: 0,
  };
}
export async function convertIdeaToRoadmap(
  ideaId: string, input: { col: string; category: string; title: string; subtitle: string },
): Promise<void> {
  await createRow('roadmap_items', ideaToRoadmapInsert(input));
  await setIdeaStatus(ideaId, 'converted');
}

export async function listReports(status?: ReportStatus): Promise<AdminReportRow[]> {
  let q = supabase.from('reports').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AdminReportRow[];
}
export const setReportStatus = (id: string, status: ReportStatus) =>
  updateRow('reports', id, { status });

// ── Subscribers ──────────────────────────────────────────────────────────────
export async function listSubscribers(): Promise<SubscriberRow[]> {
  const { data, error } = await supabase.from('changelog_subscribers')
    .select('user_id,created_at').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SubscriberRow[];
}
```

(The `throwIf` helper is unused above; remove it — kept concise: delete that block if lint flags it.)

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run src/lib/pages/__tests__/adminRepo.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pages/adminRepo.ts src/lib/pages/__tests__/adminRepo.test.ts
git commit -m "feat(admin): adminRepo (content CRUD, moderation, subscribers) + test"
```

---

## Task 4: adminHooks

**Files:**
- Create: `src/lib/pages/adminHooks.ts`

- [ ] **Step 1: Write the hooks (with cross-invalidation)**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as repo from './adminRepo';
import type { Status, ReportStatus } from './types';

// Map a content table to the public query key it feeds, so admin edits refresh public pages.
const PUBLIC_KEY: Record<string, string> = {
  roadmap_items: 'roadmap', changelog_releases: 'changelog', changelog_items: 'changelog',
  guides: 'guides', faq_items: 'faq', reviews: 'reviews',
};

function useContentList<T>(key: string, fetcher: () => Promise<T[]>) {
  return useQuery({ queryKey: ['admin', key], queryFn: fetcher });
}

export const useAdminRoadmap = () => useContentList(['roadmap_items'].join(), repo.listRoadmap);
export const useAdminGuides = () => useContentList(['guides'].join(), repo.listGuides);
export const useAdminFaq = () => useContentList(['faq_items'].join(), repo.listFaq);
export const useAdminReleases = () => useContentList(['changelog_releases'].join(), repo.listReleases);

export function useContentMutations(table: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', table] });
    const pub = PUBLIC_KEY[table];
    if (pub) qc.invalidateQueries({ queryKey: ['pages', pub] });
  };
  return {
    create: useMutation({ mutationFn: (v: Record<string, unknown>) => repo.createRow(table, v), onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) => repo.updateRow(table, id, patch), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => repo.deleteRow(table, id), onSuccess: invalidate }),
    setStatus: useMutation({ mutationFn: ({ id, status }: { id: string; status: Status }) => repo.setStatus(table, id, status), onSuccess: invalidate }),
  };
}

export const useReleaseItems = (releaseId: string) =>
  useQuery({ queryKey: ['admin', 'changelog_items', releaseId], queryFn: () => repo.listReleaseItems(releaseId), enabled: !!releaseId });

// Moderation
export function useModerationReviews() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['admin', 'reviews'], queryFn: () => repo.listReviews('pending') });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'published' | 'rejected' }) => repo.setReviewStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'reviews'] }); qc.invalidateQueries({ queryKey: ['pages', 'reviews'] }); },
  });
  return { list, setStatus };
}

export function useModerationIdeas() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['admin', 'ideas'], queryFn: () => repo.listIdeas('pending') });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['admin', 'ideas'] }); qc.invalidateQueries({ queryKey: ['admin', 'roadmap_items'] }); qc.invalidateQueries({ queryKey: ['pages', 'roadmap'] }); };
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: 'converted' | 'rejected' }) => repo.setIdeaStatus(id, status), onSuccess: invalidate });
  const convert = useMutation({ mutationFn: ({ ideaId, input }: { ideaId: string; input: { col: string; category: string; title: string; subtitle: string } }) => repo.convertIdeaToRoadmap(ideaId, input), onSuccess: invalidate });
  return { list, setStatus, convert };
}

export function useModerationReports() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['admin', 'reports'], queryFn: () => repo.listReports() });
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: ReportStatus }) => repo.setReportStatus(id, status), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'reports'] }) });
  return { list, setStatus };
}

export const useSubscribers = () => useQuery({ queryKey: ['admin', 'subscribers'], queryFn: repo.listSubscribers });
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pages/adminHooks.ts
git commit -m "feat(admin): adminHooks with public-key cross-invalidation"
```

---

## Task 5: Content editors (Dialog forms)

**Files:**
- Create: `src/pages/admin/editors/RoadmapEditor.tsx` (exemplar — full code below)
- Create: `src/pages/admin/editors/GuideEditor.tsx`
- Create: `src/pages/admin/editors/FaqEditor.tsx`
- Create: `src/pages/admin/editors/ChangelogEditor.tsx`

All four follow the **same pattern** (exemplar fully written for Roadmap; the others use the same skeleton with the field list given). The pattern: a controlled `<Dialog>` receiving `{ open, onOpenChange, initial?, onSave }`; local state per field seeded from `initial`; a Save button calling `onSave(values)`.

- [ ] **Step 1: Write `RoadmapEditor.tsx` (the exemplar — complete)**

```tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { RoadmapAdminRow } from "@/lib/pages/types";

const COLS = ["idea", "planned", "dev", "shipped"];
const CATS = ["builder", "live", "exams", "analytics", "integrations", "orga", "a11y"];

type Values = Omit<RoadmapAdminRow, "id">;

export function RoadmapEditor({ open, onOpenChange, initial, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  initial?: RoadmapAdminRow; onSave: (v: Values) => void;
}) {
  const [v, setV] = useState<Values>(() => ({
    col: initial?.col ?? "idea", category: initial?.category ?? "builder",
    title: initial?.title ?? "", subtitle: initial?.subtitle ?? "",
    tags: initial?.tags ?? [], beta: initial?.beta ?? false, locked: initial?.locked ?? false,
    base_votes: initial?.base_votes ?? 0, shipped_label: initial?.shipped_label ?? null,
    shipped_link: initial?.shipped_link ?? false, status: initial?.status ?? "draft", sort: initial?.sort ?? 0,
  }));
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((s) => ({ ...s, [k]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Éditer" : "Nouvelle"} carte roadmap</DialogTitle></DialogHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Select value={v.col} onValueChange={(x) => set("col", x as Values["col"])}>
            <SelectTrigger><SelectValue placeholder="Colonne" /></SelectTrigger>
            <SelectContent>{COLS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={v.category} onValueChange={(x) => set("category", x)}>
            <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
            <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Titre" value={v.title} onChange={(e) => set("title", e.target.value)} />
          <Textarea placeholder="Sous-titre" value={v.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
          <Input type="number" placeholder="Votes de base" value={v.base_votes} onChange={(e) => set("base_votes", Number(e.target.value))} />
          <Input placeholder="Libellé livré (optionnel)" value={v.shipped_label ?? ""} onChange={(e) => set("shipped_label", e.target.value || null)} />
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><Switch checked={v.beta} onCheckedChange={(x) => set("beta", x)} /> Bêta</label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><Switch checked={v.locked} onCheckedChange={(x) => set("locked", x)} /> Vote verrouillé</label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><Switch checked={v.shipped_link} onCheckedChange={(x) => set("shipped_link", x)} /> Lien « nouveauté »</label>
        </div>
        <DialogFooter>
          <Button disabled={!v.title.trim()} onClick={() => onSave(v)}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Note: `tags` editing is kept minimal — the editor preserves `initial.tags` and does not expose a tag UI (YAGNI for MVP admin; tags are rarely edited and can be managed later). If the reviewer wants inline tag editing, that's a follow-up.

- [ ] **Step 2: Write `GuideEditor.tsx`** — same skeleton as RoadmapEditor, `Values = Omit<GuideAdminRow,"id">`, fields:
  - `emoji` (Input), `cover_token` (Select of `--ap-quiz-soft`, `--ap-brand-soft`, `--ap-pres-soft`, `--ap-poll-soft`, `--ap-flash-soft`), `duration_label` (Input), `title` (Input), `level` (Select deb/int/avc), `format` (Select video/article), `url` (Input, nullable), `body` (**`RichTextEditor` from `@/components/RichTextEditor`**, `value={v.body ?? ""} onChange={(html) => set("body", html)}`), `status` default draft, `sort` default 0.
  - Save disabled when `!v.title.trim()`.

- [ ] **Step 3: Write `FaqEditor.tsx`** — same skeleton, `Values = Omit<FaqAdminRow,"id">`, fields: `category` (Input), `question` (Input), `answer` (Textarea). Save disabled when `!v.question.trim() || !v.answer.trim()`.

- [ ] **Step 4: Write `ChangelogEditor.tsx`** — edits a release + its items. `Values` for the release = `Omit<ReleaseAdminRow,"id">` with fields `version` (Input), `title` (Input), `date_label` (Input), `media` (Input, nullable), `intro` (**`RichTextEditor`**, nullable → `value={v.intro ?? ""}`). Below the release fields, render the release's items (from `useReleaseItems(releaseId)` when editing an existing release) with per-item `kind` (Select new/imp/fix), `text` (Input), `from_votes` (Switch), plus add/remove item buttons wired through the item mutations exposed by the parent. For a NEW release (no id yet), items are added after the release is created (save release first, then manage items on re-open). Keep the item editor simple: a list with inline `Select`/`Input`/`Switch` and a "＋ Ajouter un item" button.

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/pages/admin/editors/*.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/editors
git commit -m "feat(admin): content editor dialogs (roadmap, guide, faq, changelog)"
```

---

## Task 6: ContentTab — resource table + status/delete + editor wiring

**Files:**
- Modify: `src/pages/admin/ContentTab.tsx` (replace the stub)

- [ ] **Step 1: Implement ContentTab**

```tsx
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAdminRoadmap, useAdminGuides, useAdminFaq, useAdminReleases, useContentMutations } from "@/lib/pages/adminHooks";
import { RoadmapEditor } from "./editors/RoadmapEditor";
import { GuideEditor } from "./editors/GuideEditor";
import { FaqEditor } from "./editors/FaqEditor";
import { ChangelogEditor } from "./editors/ChangelogEditor";

type Res = "roadmap_items" | "guides" | "faq_items" | "changelog_releases";
const RES_LABEL: Record<Res, string> = {
  roadmap_items: "Roadmap", guides: "Guides", faq_items: "FAQ", changelog_releases: "Changelog",
};

export const ContentTab = () => {
  const [res, setRes] = useState<Res>("roadmap_items");
  const [editing, setEditing] = useState<{ open: boolean; row?: unknown }>({ open: false });

  const roadmap = useAdminRoadmap();
  const guides = useAdminGuides();
  const faq = useAdminFaq();
  const releases = useAdminReleases();
  const mut = useContentMutations(res);

  const rows: { id: string; label: string; status: string }[] = (() => {
    if (res === "roadmap_items") return (roadmap.data ?? []).map((r) => ({ id: r.id, label: r.title, status: r.status }));
    if (res === "guides") return (guides.data ?? []).map((r) => ({ id: r.id, label: r.title, status: r.status }));
    if (res === "faq_items") return (faq.data ?? []).map((r) => ({ id: r.id, label: r.question, status: r.status }));
    return (releases.data ?? []).map((r) => ({ id: r.id, label: `${r.version} — ${r.title}`, status: r.status }));
  })();
  const fullRow = (id: string): unknown => {
    if (res === "roadmap_items") return roadmap.data?.find((r) => r.id === id);
    if (res === "guides") return guides.data?.find((r) => r.id === id);
    if (res === "faq_items") return faq.data?.find((r) => r.id === id);
    return releases.data?.find((r) => r.id === id);
  };

  const onSave = (values: Record<string, unknown>) => {
    const row = editing.row as { id?: string } | undefined;
    if (row?.id) mut.update.mutate({ id: row.id, patch: values });
    else mut.create.mutate(values);
    setEditing({ open: false });
  };

  const Editor = { roadmap_items: RoadmapEditor, guides: GuideEditor, faq_items: FaqEditor, changelog_releases: ChangelogEditor }[res];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Select value={res} onValueChange={(x) => setRes(x as Res)}>
          <SelectTrigger style={{ width: 220 }}><SelectValue /></SelectTrigger>
          <SelectContent>{(Object.keys(RES_LABEL) as Res[]).map((r) => <SelectItem key={r} value={r}>{RES_LABEL[r]}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={() => setEditing({ open: true, row: undefined })}>Nouveau</Button>
      </div>

      <Table>
        <TableHeader><TableRow><TableHead>Titre</TableHead><TableHead>Statut</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.label}</TableCell>
              <TableCell><Badge variant={row.status === "published" ? "default" : "secondary"}>{row.status}</Badge></TableCell>
              <TableCell style={{ display: "flex", gap: 8 }}>
                <Button size="sm" variant="outline" onClick={() => setEditing({ open: true, row: fullRow(row.id) })}>Éditer</Button>
                <Button size="sm" variant="outline" onClick={() => mut.setStatus.mutate({ id: row.id, status: row.status === "published" ? "draft" : "published" })}>
                  {row.status === "published" ? "Dépublier" : "Publier"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button size="sm" variant="destructive">Suppr.</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Supprimer ?</AlertDialogTitle><AlertDialogDescription>Action irréversible.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => mut.remove.mutate(row.id)}>Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editing.open && (
        // @ts-expect-error editor prop shapes are per-resource; row is the matching admin row or undefined
        <Editor open={editing.open} onOpenChange={(o: boolean) => setEditing({ open: o })} initial={editing.row} onSave={onSave} />
      )}
    </div>
  );
};
```

Note: the `@ts-expect-error` on the polymorphic `Editor` is deliberate — each editor has a resource-specific `initial`/`onSave` type; the container dispatches by `res`. If the reviewer prefers, split into four typed branches instead of the dynamic component. Keep whichever compiles cleanly; if `@ts-expect-error` reports "unused" (no error to suppress), replace the dynamic `Editor` with a `switch (res)` rendering each editor with its concrete props.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/pages/admin/ContentTab.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/ContentTab.tsx
git commit -m "feat(admin): ContentTab table + status/delete + editor wiring"
```

---

## Task 7: ModerationTab

**Files:**
- Modify: `src/pages/admin/ModerationTab.tsx` (replace the stub)

- [ ] **Step 1: Implement ModerationTab**

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useModerationReviews, useModerationIdeas, useModerationReports } from "@/lib/pages/adminHooks";
import type { ReportStatus } from "@/lib/pages/types";

const REPORT_STATUSES: ReportStatus[] = ["open", "in_progress", "waiting", "resolved"];

export const ModerationTab = () => {
  const reviews = useModerationReviews();
  const ideas = useModerationIdeas();
  const reports = useModerationReports();
  const [convert, setConvert] = useState<{ ideaId: string; text: string } | null>(null);
  const [col, setCol] = useState("idea");
  const [category, setCategory] = useState("builder");
  const [title, setTitle] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, paddingTop: 16 }}>
      <section>
        <h3>Avis en attente</h3>
        {(reviews.list.data ?? []).map((r) => (
          <div key={r.id} className="card" style={{ padding: 16, marginBottom: 10 }}>
            <div>{"★".repeat(r.stars)} — <b>{r.author_name}</b> <small>{r.author_role}</small></div>
            <p>{r.text}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <Button size="sm" onClick={() => reviews.setStatus.mutate({ id: r.id, status: "published" })}>Publier</Button>
              <Button size="sm" variant="outline" onClick={() => reviews.setStatus.mutate({ id: r.id, status: "rejected" })}>Rejeter</Button>
            </div>
          </div>
        ))}
        {(reviews.list.data ?? []).length === 0 && <p style={{ opacity: 0.6 }}>Aucun avis en attente.</p>}
      </section>

      <section>
        <h3>Idées en attente</h3>
        {(ideas.list.data ?? []).map((i) => (
          <div key={i.id} className="card" style={{ padding: 16, marginBottom: 10 }}>
            <p>{i.text}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <Button size="sm" onClick={() => { setConvert({ ideaId: i.id, text: i.text }); setTitle(i.text.slice(0, 60)); }}>Convertir</Button>
              <Button size="sm" variant="outline" onClick={() => ideas.setStatus.mutate({ id: i.id, status: "rejected" })}>Rejeter</Button>
            </div>
          </div>
        ))}
        {(ideas.list.data ?? []).length === 0 && <p style={{ opacity: 0.6 }}>Aucune idée en attente.</p>}
      </section>

      <section>
        <h3>Tickets</h3>
        <Table>
          <TableHeader><TableRow><TableHead>Titre</TableHead><TableHead>Type</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
          <TableBody>
            {(reports.list.data ?? []).map((rep) => (
              <TableRow key={rep.id}>
                <TableCell>{rep.title}</TableCell>
                <TableCell>{rep.type}</TableCell>
                <TableCell>
                  <Select value={rep.status} onValueChange={(x) => reports.setStatus.mutate({ id: rep.id, status: x as ReportStatus })}>
                    <SelectTrigger style={{ width: 170 }}><SelectValue /></SelectTrigger>
                    <SelectContent>{REPORT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <Dialog open={!!convert} onOpenChange={(o) => !o && setConvert(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convertir en carte roadmap</DialogTitle></DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Input placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Select value={col} onValueChange={setCol}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["idea", "planned", "dev"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["builder", "live", "exams", "analytics", "integrations", "orga", "a11y"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button disabled={!title.trim()} onClick={() => {
              if (!convert) return;
              ideas.convert.mutate({ ideaId: convert.ideaId, input: { col, category, title: title.trim(), subtitle: "" } });
              setConvert(null);
            }}>Créer la carte (brouillon)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/pages/admin/ModerationTab.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/ModerationTab.tsx
git commit -m "feat(admin): moderation tab (reviews, ideas→convert, reports)"
```

---

## Task 8: SubscribersTab

**Files:**
- Modify: `src/pages/admin/SubscribersTab.tsx` (replace the stub)

- [ ] **Step 1: Implement SubscribersTab**

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSubscribers } from "@/lib/pages/adminHooks";

export const SubscribersTab = () => {
  const { data, isLoading } = useSubscribers();
  const rows = data ?? [];
  return (
    <div style={{ paddingTop: 16 }}>
      <p style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
        {isLoading ? "…" : rows.length} <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.7 }}>abonné{rows.length > 1 ? "s" : ""} au changelog</span>
      </p>
      <Table>
        <TableHeader><TableRow><TableHead>Utilisateur</TableHead><TableHead>Abonné le</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map((s) => (
            <TableRow key={s.user_id}>
              <TableCell style={{ fontFamily: "monospace" }}>{s.user_id.slice(0, 8)}…</TableCell>
              <TableCell>{new Date(s.created_at).toLocaleDateString("fr-FR")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/pages/admin/SubscribersTab.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/SubscribersTab.tsx
git commit -m "feat(admin): subscribers tab (count + list)"
```

---

## Task 9: Public changelog intro as sanitized HTML

**Files:**
- Modify: `src/pages/Changelog.tsx`

- [ ] **Step 1: Render intro through sanitizeHtml**

In `src/pages/Changelog.tsx`, add `import { sanitizeHtml } from "@/lib/sanitizeHtml";`, and replace the intro render `{r.intro && <p>{r.intro}</p>}` with:

```tsx
                    {r.intro && <div className="rel-intro" dangerouslySetInnerHTML={{ __html: sanitizeHtml(r.intro) }} />}
```

Rationale: SP3 lets admins edit intro with TipTap (HTML). Seed intros are plain text, which sanitize-render unchanged.

- [ ] **Step 2: Typecheck + lint + tests**

Run: `npm run typecheck && npx eslint src/pages/Changelog.tsx && npm run test`
Expected: PASS (existing `sanitizeHtml` tests stay green).

- [ ] **Step 3: Commit**

```bash
git add src/pages/Changelog.tsx
git commit -m "feat(pages): render changelog intro as sanitized HTML"
```

---

## Task 10: Header admin link

**Files:**
- Modify: `src/components/Header.tsx`

- [ ] **Step 1: Add a conditional Admin entry**

In `src/components/Header.tsx`, import `useIsAdmin` (`import { useIsAdmin } from "@/lib/pages/useIsAdmin";`) and call `const { isAdmin } = useIsAdmin();` inside the component. Add an "Admin" navigation entry that renders only when `isAdmin` — the least invasive placement is the authenticated user's dropdown menu, next to the existing `navigate("/profile")` item:

```tsx
{isAdmin && (
  <DropdownMenuItem onSelect={() => navigate("/admin")}>Admin</DropdownMenuItem>
)}
```

Match the exact dropdown component/props already used in Header (it uses `DropdownMenuItem` with `onSelect`). If the profile menu uses a different element, mirror that element. Do not restructure the nav.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/components/Header.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat(admin): conditional Admin link in header for admins"
```

---

## Task 11: Verification

**Files:** none

- [ ] **Step 1: Full test suite + typecheck + lint**

Run: `npm run test && npm run typecheck && npx eslint src/pages/admin src/lib/pages`
Expected: all PASS.

- [ ] **Step 2: Manual smoke test (requires SP2 deployed to prod)**

Logged in as admin, open `/admin`:
- Content: create/edit/publish/unpublish/delete a roadmap card, a guide (rich body), a FAQ item, a changelog release (rich intro); confirm the public page reflects publish/unpublish.
- Moderation: publish a pending review (appears on `/reviews`); convert an idea (creates a draft roadmap card); change a report status.
- Subscribers: count matches.
Logged in as a non-admin (or logged out): `/admin` redirects to `/`.

- [ ] **Step 3: Update project memory**

Note in `pages-cms-program` that SP3 is built; the pages-CMS program (SP1+SP2+SP3) is complete pending SP2/SP3 not needing DB deploy beyond SP2's migration.

---

## Self-Review Notes

- **Spec coverage:** gate + redirect (Task 1) ✓; admin types (Task 2) ✓; data layer reads-incl-draft + mutations + convert (Task 3) ✓; cross-invalidation hooks (Task 4) ✓; content editors incl. TipTap for guide body + changelog intro (Task 5) ✓; content table CRUD/status (Task 6) ✓; moderation reviews/ideas/reports (Task 7) ✓; subscribers count+list, no email (Task 8) ✓; public intro sanitized HTML consequence (Task 9) ✓; conditional header link (Task 10) ✓.
- **No new DB objects / no migration** — RLS admin already deployed (SP1) / pending with SP2. Correct per spec.
- **Security:** gate is cosmetic; RLS `is_admin()` is the real barrier. All mutations pass through RLS regardless of UI.
- **Pragmatic UI granularity:** RoadmapEditor is the complete exemplar; GuideEditor/FaqEditor/ChangelogEditor reuse the identical Dialog skeleton with the field lists given (Task 5 steps 2-4) — this is a deliberate, low-risk repetition of a small pattern, not hidden logic.
- **Known simplifications (flagged, not omissions):** roadmap `tags` not inline-editable (preserved on edit); changelog item editing is basic; these are noted for follow-up, consistent with the "complete admin, MVP ergonomics" scope.
```
