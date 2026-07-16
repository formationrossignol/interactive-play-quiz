# Pages CMS Interactions (SP2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let logged-in visitors vote on roadmap items (3-vote quota), submit ideas, subscribe to the changelog, file support tickets, and submit reviews — all persisted in Supabase with RLS.

**Architecture:** A new migration adds interaction tables (`roadmap_votes` with a quota trigger, `roadmap_ideas`, `reports`, `changelog_subscribers`), a public `roadmap_vote_counts` view, and an `insert` policy on the SP1 `reviews` table. A `src/lib/pages/interactionsRepo.ts` module holds the Supabase mutations/fetches; `useRoadmap` is extended to merge live vote counts, and new React Query mutation hooks drive the pages. Any interaction attempted without a session redirects to `/auth` via a small `requireAuth` guard. No emails are sent (DB-only).

**Tech Stack:** Supabase (Postgres + RLS + trigger + view), React 18, `@tanstack/react-query`, Vitest for pure functions. Auth accessor: `getCurrentUser()` from `@/lib/auth`. Route `/auth` already exists.

**Depends on:** SP1 (deployed to prod 2026-07-16). Tables `roadmap_items`, `reviews`, helper `is_admin()`, and the `src/lib/pages/` module already exist.

---

## File Structure

**Created:**
- `supabase/migrations/20260716140000_pages_cms_interactions.sql` — interaction tables, trigger, view, RLS, reviews insert policy.
- `src/lib/pages/interactionsRepo.ts` — Supabase fetch + mutation functions for votes, ideas, reports, subscription, reviews.
- `src/lib/pages/interactionHooks.ts` — React Query hooks (`useVote`, `useSubmitIdea`, `useChangelogSubscription`, `useSubmitReport`, `useMyReports`, `useSubmitReview`).
- `src/lib/pages/requireAuth.ts` — login guard helper.

**Modified:**
- `src/lib/pages/types.ts` — add `voted` to `RoadmapCard`; add `ReportRow`, `MyReport`, and interaction input types.
- `src/lib/pages/mappers.ts` — default `voted: false` in `groupRoadmap`; add pure `mergeRoadmapVotes`; add `mapReport`.
- `src/lib/pages/__tests__/mappers.test.ts` — tests for `mergeRoadmapVotes`, `mapReport`, and `groupRoadmap` `voted` default.
- `src/lib/pages/repo.ts` — extend roadmap fetch to include vote counts + my votes (or keep `fetchRoadmap` and add helpers consumed by the hook).
- `src/lib/pages/hooks.ts` — extend `useRoadmap` to return `{ view, remaining }` enriched with live votes.
- `src/pages/Roadmap.tsx` — real votes + quota + idea submit.
- `src/pages/Changelog.tsx` — subscribe toggle.
- `src/pages/Report.tsx` — submit ticket + my tickets list.
- `src/pages/Temoignages.tsx` — review submission form.

---

## Task 1: Migration — interaction tables, trigger, view, RLS

**Files:**
- Create: `supabase/migrations/20260716140000_pages_cms_interactions.sql`

- [ ] **Step 1: Write the migration file**

Create the file with exactly this content:

```sql
-- Pages CMS interactions (SP2): visitor writes (login required), DB-only.

-- ── roadmap_votes : 1 vote per (user,item), global quota of 3 ───────────────
create table public.roadmap_votes (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.roadmap_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index roadmap_votes_item_idx on public.roadmap_votes(item_id);

create or replace function public.enforce_vote_quota()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.roadmap_votes where user_id = new.user_id) >= 3 then
    raise exception 'vote quota exceeded' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger roadmap_votes_quota before insert on public.roadmap_votes
  for each row execute function public.enforce_vote_quota();

-- ── roadmap_ideas : free-text proposal, moderated in SP3 ────────────────────
create table public.roadmap_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  status text not null default 'pending' check (status in ('pending','converted','rejected')),
  created_at timestamptz not null default now()
);
create index roadmap_ideas_user_idx on public.roadmap_ideas(user_id);

-- ── reports : support ticket ────────────────────────────────────────────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('bug','question','billing')),
  severity int not null check (severity in (1,2,3)),
  title text not null,
  body text not null default '',
  status text not null default 'open' check (status in ('open','in_progress','waiting','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reports_user_idx on public.reports(user_id);
create trigger reports_touch before update on public.reports
  for each row execute function public.touch_updated_at();

-- ── changelog_subscribers : toggle (email comes from the account) ───────────
create table public.changelog_subscribers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ── public vote-count view ──────────────────────────────────────────────────
create view public.roadmap_vote_counts as
  select item_id, count(*)::int as votes
  from public.roadmap_votes
  group by item_id;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.roadmap_votes         enable row level security;
alter table public.roadmap_ideas         enable row level security;
alter table public.reports               enable row level security;
alter table public.changelog_subscribers enable row level security;

create policy roadmap_votes_read on public.roadmap_votes for select using (true);
create policy roadmap_votes_insert on public.roadmap_votes
  for insert with check (auth.uid() = user_id);
create policy roadmap_votes_delete on public.roadmap_votes
  for delete using (auth.uid() = user_id);

create policy roadmap_ideas_owner on public.roadmap_ideas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy roadmap_ideas_admin_read on public.roadmap_ideas
  for select using (public.is_admin());

create policy reports_owner on public.reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy reports_admin on public.reports
  for all using (public.is_admin()) with check (public.is_admin());

create policy changelog_subscribers_owner on public.changelog_subscribers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- reviews (created in SP1): visitor insert, forced pending and attributed to self.
create policy reviews_insert_self on public.reviews
  for insert with check (auth.uid() = author_user_id and status = 'pending');
```

- [ ] **Step 2: Self-check the SQL**

Verify by eye: balanced `$$`, every `create policy` names a distinct policy, the view has no RLS of its own (inherits `roadmap_votes_read using (true)`), `reports_touch` reuses the existing `public.touch_updated_at()`.

Do NOT apply to a database here (deploy is Task 10, done by the human via the Management API — 5432 is firewalled). This step is a file + eyeball check only.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260716140000_pages_cms_interactions.sql
git commit -m "feat(db): SP2 interaction tables, vote quota trigger, RLS"
```

---

## Task 2: Types — voted flag, report + input types

**Files:**
- Modify: `src/lib/pages/types.ts`

- [ ] **Step 1: Add `voted` to `RoadmapCard`**

In `src/lib/pages/types.ts`, change the `RoadmapCard` interface to add a `voted` field:

```typescript
export interface RoadmapCard {
  id: string;
  votes: number;
  title: string;
  sub: string;
  tags: RoadmapTag[];
  cat: string;
  locked: boolean;
  beta: boolean;
  voted: boolean;
}
```

- [ ] **Step 2: Append the SP2 types at the end of the file**

```typescript
// ── Interactions (SP2) ──────────────────────────────────────────────────────
export type ReportType = 'bug' | 'question' | 'billing';
export type ReportSeverity = 1 | 2 | 3;
export type ReportStatus = 'open' | 'in_progress' | 'waiting' | 'resolved';

export interface ReportRow {
  id: string;
  type: ReportType;
  severity: ReportSeverity;
  title: string;
  body: string;
  status: ReportStatus;
  created_at: string;
}
// Shape the Report page renders in "Mes tickets".
export interface MyReport {
  id: string;
  shortId: string;   // "#" + first 4 hex of uuid
  title: string;
  meta: string;      // e.g. "Bug · 14 juil. 2026"
  statusClass: string;
  statusLabel: string;
}

export interface NewReport {
  type: ReportType;
  severity: ReportSeverity;
  title: string;
  body: string;
}
export interface NewReview {
  persona: ReviewPersona;
  stars: number;
  text: string;
  authorRole: string;
}
```

- [ ] **Step 3: Typecheck (expected to fail until mappers set `voted`)**

Run: `npm run typecheck`
Expected: FAIL — `groupRoadmap` in `mappers.ts` builds `RoadmapCard` objects without `voted`. This is fixed in Task 3. (If you prefer, do Task 2 and Task 3 back-to-back before committing.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/pages/types.ts
git commit -m "feat(pages): SP2 types (voted flag, report + input types)"
```

---

## Task 3: Mappers — voted default, mergeRoadmapVotes, mapReport (TDD)

**Files:**
- Modify: `src/lib/pages/mappers.ts`
- Modify: `src/lib/pages/__tests__/mappers.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `src/lib/pages/__tests__/mappers.test.ts` (and add the new imports `mergeRoadmapVotes, mapReport` to the existing import from `../mappers`, and `ReportRow` to the type import from `../types`):

```typescript
import { mergeRoadmapVotes, mapReport } from '../mappers';
import type { ReportRow, RoadmapView } from '../types';

describe('groupRoadmap voted default', () => {
  it('sets voted=false on freshly mapped cards', () => {
    const rows = [
      { id: '1', col: 'idea', category: 'builder', title: 'A', subtitle: 's', tags: [], beta: false, locked: false, base_votes: 5, shipped_label: null, shipped_link: false, sort: 10 },
    ] as Parameters<typeof groupRoadmap>[0];
    expect(groupRoadmap(rows).idea[0].voted).toBe(false);
  });
});

describe('mergeRoadmapVotes', () => {
  const baseView: RoadmapView = {
    idea: [{ id: 'a', votes: 10, title: 'A', sub: 's', tags: [], cat: 'builder', locked: false, beta: false, voted: false }],
    planned: [],
    dev: [{ id: 'b', votes: 20, title: 'B', sub: 's', tags: [], cat: 'live', locked: true, beta: true, voted: false }],
    shipped: [{ id: 'c', votes: 30, title: 'C', sub: 's', cat: 'builder', link: false }],
  };
  it('adds live counts to base votes and flags my votes', () => {
    const counts = new Map<string, number>([['a', 3], ['b', 7]]);
    const myVotes = new Set<string>(['a']);
    const { view, remaining } = mergeRoadmapVotes(baseView, counts, myVotes);
    expect(view.idea[0].votes).toBe(13);
    expect(view.idea[0].voted).toBe(true);
    expect(view.dev[0].votes).toBe(27);
    expect(view.dev[0].voted).toBe(false);
    expect(remaining).toBe(2);
  });
  it('leaves shipped cards untouched and remaining=3 with no votes', () => {
    const { view, remaining } = mergeRoadmapVotes(baseView, new Map(), new Set());
    expect(view.shipped[0].votes).toBe(30);
    expect(view.idea[0].votes).toBe(10);
    expect(remaining).toBe(3);
  });
});

describe('mapReport', () => {
  it('maps a row to the Mes-tickets shape', () => {
    const row: ReportRow = { id: 'abcd1234-0000-0000-0000-000000000000', type: 'bug', severity: 1, title: 'Boom', body: '', status: 'in_progress', created_at: '2026-07-14T10:00:00Z' };
    const r = mapReport(row);
    expect(r.shortId).toBe('#abcd');
    expect(r.title).toBe('Boom');
    expect(r.statusClass).toBe('tst--prog');
    expect(r.statusLabel).toBe('En cours');
    expect(r.meta.startsWith('Bug · ')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/pages/__tests__/mappers.test.ts`
Expected: FAIL — `mergeRoadmapVotes` and `mapReport` are not exported; `voted` not present.

- [ ] **Step 3: Update `groupRoadmap` and add the new mappers**

In `src/lib/pages/mappers.ts`, add `voted: false` to the non-shipped card built in `groupRoadmap`:

```typescript
      const card: RoadmapCard = {
        id: r.id, votes: r.base_votes, title: r.title, sub: r.subtitle,
        tags: r.tags, cat: r.category, locked: r.locked, beta: r.beta, voted: false,
      };
```

Then append (add `MyReport`, `ReportRow`, and the report-type imports to the existing `import type { ... } from './types';` block):

```typescript
export function mergeRoadmapVotes(
  view: RoadmapView,
  counts: Map<string, number>,
  myVotes: Set<string>,
): { view: RoadmapView; remaining: number } {
  const bump = <T extends { id: string; votes: number }>(card: T) => ({
    ...card,
    votes: card.votes + (counts.get(card.id) ?? 0),
  });
  const merged: RoadmapView = {
    idea: view.idea.map((c) => ({ ...bump(c), voted: myVotes.has(c.id) })),
    planned: view.planned.map((c) => ({ ...bump(c), voted: myVotes.has(c.id) })),
    dev: view.dev.map((c) => ({ ...bump(c), voted: myVotes.has(c.id) })),
    shipped: view.shipped.map((c) => bump(c)),
  };
  return { view: merged, remaining: Math.max(0, 3 - myVotes.size) };
}

const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  bug: 'Bug', question: 'Question', billing: 'Facturation',
};
const REPORT_STATUS: Record<ReportStatus, { cls: string; label: string }> = {
  open: { cls: 'tst--wait', label: 'Ouvert' },
  in_progress: { cls: 'tst--prog', label: 'En cours' },
  waiting: { cls: 'tst--wait', label: 'Attend votre réponse' },
  resolved: { cls: 'tst--done', label: 'Résolu' },
};

export function mapReport(row: ReportRow): MyReport {
  const date = new Date(row.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const st = REPORT_STATUS[row.status];
  return {
    id: row.id,
    shortId: '#' + row.id.slice(0, 4),
    title: row.title,
    meta: `${REPORT_TYPE_LABEL[row.type]} · ${date}`,
    statusClass: st.cls,
    statusLabel: st.label,
  };
}
```

Add the needed type imports at the top: `ReportType`, `ReportStatus`, `ReportRow`, `MyReport`.

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/lib/pages/__tests__/mappers.test.ts && npm run typecheck`
Expected: PASS (all mapper tests green, typecheck clean now that `voted` is set).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pages/mappers.ts src/lib/pages/__tests__/mappers.test.ts
git commit -m "feat(pages): mergeRoadmapVotes + mapReport + voted default (tested)"
```

---

## Task 4: interactionsRepo — Supabase fetch + mutations

**Files:**
- Create: `src/lib/pages/interactionsRepo.ts`

- [ ] **Step 1: Write the repo module**

```typescript
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { mapReport } from './mappers';
import type { NewReport, NewReview, MyReport, ReportRow } from './types';

// ── Roadmap votes ───────────────────────────────────────────────────────────
export async function fetchVoteCounts(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('roadmap_vote_counts').select('item_id,votes');
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.item_id as string, r.votes as number]));
}

export async function fetchMyVotes(): Promise<Set<string>> {
  const uid = getCurrentUser()?.id;
  if (!uid) return new Set();
  const { data, error } = await supabase.from('roadmap_votes').select('item_id').eq('user_id', uid);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.item_id as string));
}

export async function castVote(itemId: string): Promise<void> {
  const uid = getCurrentUser()?.id;
  if (!uid) throw new Error('not authenticated');
  const { error } = await supabase.from('roadmap_votes').insert({ user_id: uid, item_id: itemId });
  if (error) throw error;
}

export async function removeVote(itemId: string): Promise<void> {
  const uid = getCurrentUser()?.id;
  if (!uid) throw new Error('not authenticated');
  const { error } = await supabase.from('roadmap_votes').delete().eq('user_id', uid).eq('item_id', itemId);
  if (error) throw error;
}

// ── Idea ────────────────────────────────────────────────────────────────────
export async function submitIdea(text: string): Promise<void> {
  const uid = getCurrentUser()?.id;
  if (!uid) throw new Error('not authenticated');
  const { error } = await supabase.from('roadmap_ideas').insert({ user_id: uid, text });
  if (error) throw error;
}

// ── Changelog subscription ──────────────────────────────────────────────────
export async function isSubscribed(): Promise<boolean> {
  const uid = getCurrentUser()?.id;
  if (!uid) return false;
  const { data, error } = await supabase.from('changelog_subscribers').select('user_id').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function subscribe(): Promise<void> {
  const uid = getCurrentUser()?.id;
  if (!uid) throw new Error('not authenticated');
  const { error } = await supabase.from('changelog_subscribers').insert({ user_id: uid });
  if (error && error.code !== '23505') throw error; // ignore duplicate
}

export async function unsubscribe(): Promise<void> {
  const uid = getCurrentUser()?.id;
  if (!uid) throw new Error('not authenticated');
  const { error } = await supabase.from('changelog_subscribers').delete().eq('user_id', uid);
  if (error) throw error;
}

// ── Reports ─────────────────────────────────────────────────────────────────
export async function submitReport(input: NewReport): Promise<void> {
  const uid = getCurrentUser()?.id;
  if (!uid) throw new Error('not authenticated');
  const { error } = await supabase.from('reports').insert({ user_id: uid, ...input });
  if (error) throw error;
}

export async function fetchMyReports(): Promise<MyReport[]> {
  const uid = getCurrentUser()?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from('reports')
    .select('id,type,severity,title,body,status,created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as ReportRow[]).map(mapReport);
}

// ── Reviews ─────────────────────────────────────────────────────────────────
export async function submitReview(input: NewReview): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('not authenticated');
  const { error } = await supabase.from('reviews').insert({
    author_user_id: user.id,
    persona: input.persona,
    stars: input.stars,
    text: input.text,
    author_name: user.username,
    author_role: input.authorRole,
    avatar_emoji: '🙂',
    status: 'pending',
  });
  if (error) throw error;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pages/interactionsRepo.ts
git commit -m "feat(pages): interactionsRepo (votes, ideas, reports, subscription, reviews)"
```

---

## Task 5: requireAuth guard + interaction hooks

**Files:**
- Create: `src/lib/pages/requireAuth.ts`
- Create: `src/lib/pages/interactionHooks.ts`
- Modify: `src/lib/pages/repo.ts`
- Modify: `src/lib/pages/hooks.ts`

- [ ] **Step 1: Write the requireAuth guard**

```typescript
// src/lib/pages/requireAuth.ts
import type { NavigateFunction } from 'react-router-dom';
import { getCurrentUser } from '@/lib/auth';

/** Returns true if authenticated; otherwise redirects to /auth and returns false. */
export function requireAuth(navigate: NavigateFunction): boolean {
  if (getCurrentUser()) return true;
  navigate('/auth');
  return false;
}
```

- [ ] **Step 2: Extend the roadmap fetch to include votes**

In `src/lib/pages/repo.ts`, add a combined fetch below `fetchRoadmap` (keep `fetchRoadmap` as-is; add a new one that also merges votes). Add imports for `fetchVoteCounts`, `fetchMyVotes` from `./interactionsRepo` and `mergeRoadmapVotes` from `./mappers`:

```typescript
import { fetchVoteCounts, fetchMyVotes } from './interactionsRepo';
import { mergeRoadmapVotes } from './mappers';

export async function fetchRoadmapWithVotes(): Promise<{ view: RoadmapView; remaining: number }> {
  const [view, counts, myVotes] = await Promise.all([
    fetchRoadmap(),
    fetchVoteCounts(),
    fetchMyVotes(),
  ]);
  return mergeRoadmapVotes(view, counts, myVotes);
}
```

- [ ] **Step 3: Point `useRoadmap` at the vote-aware fetch**

In `src/lib/pages/hooks.ts`, change the roadmap hook to use `fetchRoadmapWithVotes` (import it from `./repo`), so `data` is now `{ view, remaining }`:

```typescript
export const useRoadmap = () =>
  useQuery({ queryKey: ['pages', 'roadmap'], queryFn: fetchRoadmapWithVotes });
```

Remove the now-unused `fetchRoadmap` import from `hooks.ts` if present (keep it exported from `repo.ts`).

- [ ] **Step 4: Write the interaction hooks**

```typescript
// src/lib/pages/interactionHooks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  castVote, removeVote, submitIdea,
  isSubscribed, subscribe, unsubscribe,
  submitReport, fetchMyReports, submitReview,
} from './interactionsRepo';
import type { NewReport, NewReview } from './types';

export function useVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, voted }: { itemId: string; voted: boolean }) =>
      voted ? removeVote(itemId) : castVote(itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pages', 'roadmap'] }),
  });
}

export function useSubmitIdea() {
  return useMutation({ mutationFn: (text: string) => submitIdea(text) });
}

export function useChangelogSubscription() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['pages', 'subscription'], queryFn: isSubscribed });
  const toggle = useMutation({
    mutationFn: (subscribed: boolean) => (subscribed ? unsubscribe() : subscribe()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pages', 'subscription'] }),
  });
  return { isSubscribed: !!query.data, isLoading: query.isLoading, toggle };
}

export function useMyReports() {
  return useQuery({ queryKey: ['pages', 'my-reports'], queryFn: fetchMyReports });
}

export function useSubmitReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewReport) => submitReport(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pages', 'my-reports'] }),
  });
}

export function useSubmitReview() {
  return useMutation({ mutationFn: (input: NewReview) => submitReview(input) });
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: FAIL — `Roadmap.tsx` still reads `data: view` as a `RoadmapView` but the hook now returns `{ view, remaining }`. Fixed in Task 6. (Acceptable intermediate state; commit now, fix the page next.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/pages/requireAuth.ts src/lib/pages/interactionHooks.ts src/lib/pages/repo.ts src/lib/pages/hooks.ts
git commit -m "feat(pages): requireAuth guard + interaction hooks + vote-aware useRoadmap"
```

---

## Task 6: Wire Roadmap — real votes + quota + idea submit

**Files:**
- Modify: `src/pages/Roadmap.tsx`

- [ ] **Step 1: Replace local vote state with the backend**

In `src/pages/Roadmap.tsx`:

1. Add imports: `import { useVote, useSubmitIdea } from "@/lib/pages/interactionHooks";` and `import { requireAuth } from "@/lib/pages/requireAuth";`
2. The hook now returns `{ view, remaining }`. Change destructuring:

```tsx
  const { data: roadmap, isLoading } = useRoadmap();
  const view = roadmap?.view;
  const remaining = roadmap?.remaining ?? 3;
  const vote = useVote();
  const submitIdea = useSubmitIdea();
  const [ideaText, setIdeaText] = useState("");
  const [ideaSent, setIdeaSent] = useState(false);
```

3. Remove the old local vote state: delete `const [voted, setVoted] = useState(...)`, `const [remaining, setRemaining] = useState(1)`, and the old `toggleVote`/`usedDots` logic that mutated them. Recompute `usedDots`:

```tsx
  const usedDots = 3 - remaining;
```

4. New vote handler (uses the card's own `voted` flag; quota is enforced by DB, guard prevents the call when full):

```tsx
  const onVote = (card: { id: string; voted: boolean; locked: boolean }) => {
    if (card.locked) return;
    if (!requireAuth(navigate)) return;
    if (!card.voted && remaining === 0) {
      setShake(card.id);
      setTimeout(() => setShake(null), 240);
      return;
    }
    vote.mutate({ itemId: card.id, voted: card.voted });
  };
```

5. In the card render (from SP1), the vote button now reads `card.voted` for its state and its count directly from `card.votes` (already merged). Replace the button block:

```tsx
                        <button className={`vote${card.locked || card.voted ? " on" : ""}`} disabled={card.locked || vote.isPending}
                          onClick={() => onVote(card)}
                          style={shake === card.id ? { animation: "lq-shake .24s" } : undefined}>
                          <ChevronUp size={13} strokeWidth={3} />
                          <span>{card.votes}</span>
                        </button>
```

Keep the loading guard `isLoading || !view` and the rest of the SP1 markup. Update any `!view` references to use the new `view` variable.

6. Wire the idea submit box (replace the `.submit-idea` block's input + button):

```tsx
          <div className="card submit-idea">
            <div>
              <h3 style={{ fontSize: "16px", marginBottom: "4px" }}>Une idée qui n'est pas dans la liste ?</h3>
              <input value={ideaText} onChange={(e) => setIdeaText(e.target.value)}
                placeholder="Décrivez-la en une phrase… on vérifie qu'elle n'existe pas déjà" />
            </div>
            <button className="btn" disabled={submitIdea.isPending || !ideaText.trim()} onClick={() => {
              if (!requireAuth(navigate)) return;
              submitIdea.mutate(ideaText.trim(), {
                onSuccess: () => { setIdeaText(""); setIdeaSent(true); setTimeout(() => setIdeaSent(false), 3000); },
              });
            }}>{ideaSent ? "Merci !" : "Proposer l'idée"}</button>
          </div>
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. No references to the removed `voted`/`setVoted`/`setRemaining` state.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Roadmap.tsx
git commit -m "feat(pages): real roadmap votes + quota + idea submission"
```

---

## Task 7: Wire Changelog — subscribe toggle

**Files:**
- Modify: `src/pages/Changelog.tsx`

- [ ] **Step 1: Replace the email input with an account subscribe toggle**

In `src/pages/Changelog.tsx`:

1. Add imports: `import { useChangelogSubscription } from "@/lib/pages/interactionHooks";`, `import { requireAuth } from "@/lib/pages/requireAuth";`, and `import { useNavigate } from "react-router-dom";` (add `const navigate = useNavigate();` in the component if not already present).
2. In the component: `const sub = useChangelogSubscription();`
3. Replace the `.subscribe` block:

```tsx
          <div className="subscribe">
            <button className="btn btn--sm" disabled={sub.isLoading || sub.toggle.isPending} onClick={() => {
              if (!requireAuth(navigate)) return;
              sub.toggle.mutate(sub.isSubscribed);
            }}>
              {sub.isSubscribed ? "Abonné ✓ — se désabonner" : "Recevoir les nouveautés"}
            </button>
          </div>
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Changelog.tsx
git commit -m "feat(pages): changelog subscribe toggle (account-based)"
```

---

## Task 8: Wire Report — submit ticket + my tickets

**Files:**
- Modify: `src/pages/Report.tsx`

- [ ] **Step 1: Wire the form and the tickets list**

In `src/pages/Report.tsx`:

1. Remove the `TICKETS` constant (lines 21-26). Keep `TYPES` and `SEVS`.
2. Add imports: `import { useSubmitReport, useMyReports } from "@/lib/pages/interactionHooks";`, `import { requireAuth } from "@/lib/pages/requireAuth";`, and `import type { ReportType, ReportSeverity } from "@/lib/pages/types";`
3. Add state + hooks in the component:

```tsx
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const submit = useSubmitReport();
  const { data: tickets, isLoading: ticketsLoading } = useMyReports();
```

4. Bind the description textarea (line 97): add `value={body} onChange={(e) => setBody(e.target.value)}`.
5. Replace the submit button (line 120) handler:

```tsx
              <button className="btn" style={{ width: "100%" }}
                disabled={submit.isPending || !title.trim()}
                onClick={() => {
                  if (!requireAuth(navigate)) return;
                  submit.mutate(
                    { type: type as ReportType, severity: Number(sev) as ReportSeverity, title: title.trim(), body },
                    { onSuccess: () => { setTitle(""); setBody(""); setSent(true); setTimeout(() => setSent(false), 3000); } },
                  );
                }}>
                {sent ? "Ticket envoyé ✓" : "Envoyer le ticket"}
              </button>
```

6. Replace the `TICKETS.map(...)` block (lines 129-135) with the real tickets, guarding loading and empty:

```tsx
                {ticketsLoading ? (
                  <div className="ticketrow"><small style={{ opacity: 0.6 }}>Chargement…</small></div>
                ) : !tickets || tickets.length === 0 ? (
                  <div className="ticketrow"><small style={{ opacity: 0.6 }}>Aucun ticket pour le moment.</small></div>
                ) : (
                  tickets.map((tk) => (
                    <div className="ticketrow" key={tk.id}>
                      <span className="tid">{tk.shortId}</span>
                      <div className="tt2"><b>{tk.title}</b><small>{tk.meta}</small></div>
                      <span className={`tst ${tk.statusClass}`}>{tk.statusLabel}</span>
                    </div>
                  ))
                )}
```

Leave the "Contexte technique" cosmetic box and the file dropzone as static (out of scope — no upload wiring).

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. No references to `TICKETS`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Report.tsx
git commit -m "feat(pages): report ticket submission + my tickets from Supabase"
```

---

## Task 9: Wire Temoignages — review submission form

**Files:**
- Modify: `src/pages/Temoignages.tsx`

- [ ] **Step 1: Add a review submission form**

In `src/pages/Temoignages.tsx`:

1. Add imports: `import { useSubmitReview } from "@/lib/pages/interactionHooks";`, `import { requireAuth } from "@/lib/pages/requireAuth";`, and `import type { ReviewPersona } from "@/lib/pages/types";`
2. Add state + hook in the component:

```tsx
  const [rvPersona, setRvPersona] = useState<ReviewPersona>("formateur");
  const [rvStars, setRvStars] = useState(5);
  const [rvText, setRvText] = useState("");
  const [rvRole, setRvRole] = useState("");
  const [rvSent, setRvSent] = useState(false);
  const submitReview = useSubmitReview();
```

3. Insert a submission card just before the `.finalcta` block (line 112). Reuse existing card styling:

```tsx
          <div className="card" style={{ padding: "24px 28px", marginBottom: "28px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <h3 style={{ fontSize: "16px" }}>Partagez votre expérience</h3>
            {rvSent ? (
              <p style={{ color: "var(--ap-muted)", fontWeight: 700 }}>Merci ! Votre avis sera publié après modération.</p>
            ) : (
              <>
                <div className="chips">
                  {CHIPS.filter((c) => c.p !== "all").map((c) => (
                    <button key={c.p} className={`chip${rvPersona === c.p ? " on" : ""}`} onClick={() => setRvPersona(c.p as ReviewPersona)}>{c.label}</button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setRvStars(n)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "22px", color: n <= rvStars ? "var(--ap-brand)" : "var(--ap-line-2)" }} aria-label={`${n} étoiles`}>★</button>
                  ))}
                </div>
                <input value={rvRole} onChange={(e) => setRvRole(e.target.value)} placeholder="Votre rôle (ex. Formateur indépendant)" />
                <textarea rows={3} value={rvText} onChange={(e) => setRvText(e.target.value)} placeholder="Qu'est-ce qui vous a plu ?" />
                <button className="btn" style={{ alignSelf: "flex-start" }} disabled={submitReview.isPending || !rvText.trim()} onClick={() => {
                  if (!requireAuth(navigate)) return;
                  submitReview.mutate(
                    { persona: rvPersona, stars: rvStars, text: rvText.trim(), authorRole: rvRole.trim() },
                    { onSuccess: () => setRvSent(true) },
                  );
                }}>Envoyer mon avis</button>
              </>
            )}
          </div>
```

Keep `BARS`, `CHIPS`, the `stars` helper, and the existing review grid unchanged.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Temoignages.tsx
git commit -m "feat(pages): review submission form (pending moderation)"
```

---

## Task 10: Verification + deploy

**Files:** none (verification + deploy)

- [ ] **Step 1: Full test suite + typecheck + lint**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: all PASS (mappers tests include the new `mergeRoadmapVotes`/`mapReport` cases).

- [ ] **Step 2: Deploy the migration to prod**

Apply `supabase/migrations/20260716140000_pages_cms_interactions.sql` to the prod project (`lwwfgdebmggxjuvlazwf`) via the Supabase Management API HTTPS query endpoint (5432 firewalled). Requires a fresh Management API PAT from the human.

- [ ] **Step 3: Verify the schema in prod**

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('roadmap_votes','roadmap_ideas','reports','changelog_subscribers')
order by table_name;
select 1 from information_schema.views where table_schema='public' and table_name='roadmap_vote_counts';
```

Expected: four tables + the view present.

- [ ] **Step 4: Manual smoke test (logged in)**

On the deployed app, logged in: vote on 3 roadmap items (4th blocked), remove one and vote another; submit an idea; toggle changelog subscription; file a report and see it appear in "Mes tickets"; submit a review and see the "pending moderation" confirmation. Verify a logged-out click on any action redirects to `/auth`.

- [ ] **Step 5: Update project memory**

Note in `pages-cms-program` memory that SP2 is built and deployed; SP3 (admin UI) remains.

---

## Self-Review Notes

- **Spec coverage:** votes+quota trigger+view (Task 1,3,4,6) ✓; ideas (Task 4,6) ✓; reports + my tickets (Task 4,8) ✓; changelog subscribe toggle (Task 4,7) ✓; review insert pending+self (Task 1 policy, Task 4,9) ✓; requireAuth redirect (Task 5, all pages) ✓; DB-only/no email ✓; deploy local+prod (Task 10) ✓.
- **Type consistency:** `useRoadmap` now returns `{ view, remaining }` — Roadmap page (Task 6) updated to match; no other consumer of `useRoadmap` exists. `RoadmapCard.voted` added in Task 2, set in Task 3, consumed in Task 6.
- **Vote count** comes from the merged `card.votes` (base + live), not a separate field — single source in the card.
- **`avatar_emoji`** defaults to '🙂' on submitted reviews (SP1 seed used per-persona emojis; admin can adjust in SP3).
- **Out of scope kept out:** file upload on Report, email delivery, admin moderation UI.
```
