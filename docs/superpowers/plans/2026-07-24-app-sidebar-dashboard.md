# App Sidebar Restructure + Dashboard Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give "Dashboard" real content (KPI stats + product news) instead of aliasing `/my-quizzes`, move content-type switching from an in-page tab strip into a sidebar submenu ("Mes créations"), and stop repeating the content-type name four times on each "Mes …" page.

**Architecture:** Two new pure-logic modules (`dashboardStats.ts`, `changelog.ts`) power two new presentational components (`KpiRow`, `NewsModule`) rendered by a new `Dashboard` page. `AppSidebar.tsx` gains a collapsible submenu (shadcn `Collapsible` + `SidebarMenuSub`, both already in the codebase, unused until now). `ContentExplorer.tsx` loses its `TYPE_TABS` strip and shortens its breadcrumb root label.

**Tech Stack:** React 18, react-router-dom, Vitest, existing shadcn/ui primitives (`Collapsible`, `Sidebar*`), Supabase JS client (already configured in `apps/app/src/lib/supabase.ts`).

Spec: `docs/superpowers/specs/2026-07-24-app-sidebar-dashboard-design.md`

---

### Task 1: `dashboardStats.ts` — aggregated KPI computation

**Files:**
- Create: `apps/app/src/lib/dashboardStats.ts`
- Test: `apps/app/src/lib/__tests__/dashboardStats.test.ts`

Aggregates across the user's content: total creations spans all 6 kinds (quiz/poll/flashcard/slide via `getUserQuizzes`, course via `getUserCourses`, exam via `getHostExams`). Sessions/participants/avg-score are computed only from quiz + poll, the only two kinds with session history in this codebase (`readSessionHistory` for quiz, `getPollResults` for poll — flashcards/slides/courses/exams have no equivalent session log).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/app/src/lib/__tests__/dashboardStats.test.ts
import { describe, it, expect, vi } from 'vitest';
import { computeDashboardStats } from '../dashboardStats';
import { getUserQuizzes } from '../quizStorage';
import { getUserCourses } from '../courseStorage';
import { getHostExams } from '../examStorage';
import { readSessionHistory } from '../sessionState';
import { getPollResults } from '../pollResults';

vi.mock('../quizStorage', () => ({ getUserQuizzes: vi.fn() }));
vi.mock('../courseStorage', () => ({ getUserCourses: vi.fn() }));
vi.mock('../examStorage', () => ({ getHostExams: vi.fn() }));
vi.mock('../sessionState', () => ({ readSessionHistory: vi.fn() }));
vi.mock('../pollResults', () => ({ getPollResults: vi.fn() }));

describe('computeDashboardStats', () => {
  it('aggregates sessions/participants/score across quiz + poll, counts creations across all kinds', async () => {
    vi.mocked(getUserQuizzes).mockReturnValue([
      { id: 'q1', type: 'quiz' },
      { id: 'p1', type: 'poll' },
      { id: 'f1', type: 'flashcard' },
    ] as ReturnType<typeof getUserQuizzes>);
    vi.mocked(getUserCourses).mockReturnValue([{ id: 'c1' }] as ReturnType<typeof getUserCourses>);
    vi.mocked(getHostExams).mockResolvedValue([{ id: 'e1' }] as Awaited<ReturnType<typeof getHostExams>>);
    vi.mocked(readSessionHistory).mockImplementation((id) =>
      id === 'q1'
        ? [{
            id: 'r1', date: '2026-01-01', questionCount: 5,
            players: [
              { id: 'pl1', name: 'A', avatar: '', score: 100, correctAnswers: 4 },
              { id: 'pl2', name: 'B', avatar: '', score: 80, correctAnswers: 3 },
            ],
          }]
        : [],
    );
    vi.mocked(getPollResults).mockImplementation((id) =>
      id === 'p1'
        ? { pollId: 'p1', pollTitle: 'Poll', sessions: [{ sessionId: 's1', date: '2026-01-01', totalParticipants: 12, questions: [] }] }
        : null,
    );

    const stats = await computeDashboardStats('user-1');

    expect(stats.totalCreations).toBe(5); // q1 + p1 + f1 + c1 + e1
    expect(stats.totalSessions).toBe(2); // 1 quiz run + 1 poll session
    expect(stats.totalParticipants).toBe(14); // 2 quiz players + 12 poll participants
    expect(stats.avgScore).toBe(90); // (100 + 80) / 2
  });

  it('returns avgScore null and zeroed totals for a fresh account', async () => {
    vi.mocked(getUserQuizzes).mockReturnValue([]);
    vi.mocked(getUserCourses).mockReturnValue([]);
    vi.mocked(getHostExams).mockResolvedValue([]);

    const stats = await computeDashboardStats('user-1');

    expect(stats).toEqual({ totalCreations: 0, totalSessions: 0, totalParticipants: 0, avgScore: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && npx vitest run src/lib/__tests__/dashboardStats.test.ts`
Expected: FAIL — `Failed to resolve import "../dashboardStats"`

- [ ] **Step 3: Write the implementation**

```typescript
// apps/app/src/lib/dashboardStats.ts
import { getUserQuizzes } from "./quizStorage";
import { getUserCourses } from "./courseStorage";
import { getHostExams } from "./examStorage";
import { readSessionHistory } from "./sessionState";
import { getPollResults } from "./pollResults";

export interface DashboardStats {
  totalCreations: number;
  totalSessions: number;
  totalParticipants: number;
  /** null when no quiz session has ever run — polls have no per-player score. */
  avgScore: number | null;
}

/** Aggregates KPIs for the Dashboard page. Total creations spans all 6
 *  content kinds; sessions/participants/avg-score are quiz+poll only —
 *  the only two kinds with session history in this codebase. */
export async function computeDashboardStats(userId: string): Promise<DashboardStats> {
  const items = getUserQuizzes(userId);
  const quizItems = items.filter((item) => item.type === "quiz");
  const pollItems = items.filter((item) => item.type === "poll");

  let totalSessions = 0;
  let totalParticipants = 0;
  let scoreSum = 0;
  let scoreCount = 0;

  for (const quiz of quizItems) {
    const runs = readSessionHistory(quiz.id);
    totalSessions += runs.length;
    for (const run of runs) {
      totalParticipants += run.players.length;
      for (const player of run.players) {
        scoreSum += player.score;
        scoreCount += 1;
      }
    }
  }

  for (const poll of pollItems) {
    const store = getPollResults(poll.id);
    if (!store) continue;
    totalSessions += store.sessions.length;
    totalParticipants += store.sessions.reduce((sum, session) => sum + session.totalParticipants, 0);
  }

  const [courses, exams] = await Promise.all([
    Promise.resolve(getUserCourses(userId)),
    getHostExams(userId),
  ]);

  return {
    totalCreations: items.length + courses.length + exams.length,
    totalSessions,
    totalParticipants,
    avgScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && npx vitest run src/lib/__tests__/dashboardStats.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/lib/dashboardStats.ts apps/app/src/lib/__tests__/dashboardStats.test.ts
git commit -m "feat(app): add computeDashboardStats aggregation helper"
```

---

### Task 2: `changelog.ts` — public changelog reader

**Files:**
- Create: `apps/app/src/lib/changelog.ts`

The `changelog_releases` table has no `status` column (confirmed via `apps/app/src/lib/pages/types.ts:53-61`'s `ReleaseRow` shape and `apps/marketing/src/lib/repo.ts`'s `fetchChangelog`, which selects `id,version,title,date_label,intro,media,sort` with no status filter) — releases are public as soon as they exist, same table apps/marketing already reads publicly. This mirrors that exact pattern using the app's own `supabase` client (`apps/app/src/lib/supabase.ts`, already used throughout the app for public reads).

- [ ] **Step 1: Write the implementation**

```typescript
// apps/app/src/lib/changelog.ts
import { supabase } from "./supabase";

export interface ChangelogRelease {
  id: string;
  version: string;
  title: string;
  dateLabel: string;
  intro: string | null;
}

/** Public read, no auth required — same changelog_releases table
 *  apps/marketing's /changelog page reads (see apps/marketing/src/lib/repo.ts
 *  #fetchChangelog). Degrades to [] on any failure, same pattern as every
 *  other public-read helper in this codebase. */
export const fetchLatestChangelog = async (limit = 5): Promise<ChangelogRelease[]> => {
  try {
    const { data, error } = await supabase
      .from("changelog_releases")
      .select("id,version,title,date_label,intro,sort")
      .order("sort", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((row) => ({
      id: row.id as string,
      version: row.version as string,
      title: row.title as string,
      dateLabel: row.date_label as string,
      intro: (row.intro as string | null) ?? null,
    }));
  } catch {
    return [];
  }
};
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/app/src/lib/changelog.ts
git commit -m "feat(app): add public changelog reader for the dashboard news module"
```

---

### Task 3: `KpiRow` component

**Files:**
- Create: `apps/app/src/components/dashboard/KpiRow.tsx`

Reuses the exact stat-tile markup already used by `QuizResults.tsx` (`apps/app/src/pages/QuizResults.tsx:145-157`) for visual consistency — same `.ap-card`/`.ap-tile__icon` classes.

- [ ] **Step 1: Write the implementation**

```tsx
// apps/app/src/components/dashboard/KpiRow.tsx
import type { ReactNode } from "react";
import { BarChart2, Sparkles, Target, Users } from "lucide-react";
import type { DashboardStats } from "@/lib/dashboardStats";

interface Tile {
  icon: ReactNode;
  label: string;
  value: string | number;
}

export function KpiRow({ stats }: { stats: DashboardStats | null }) {
  const s = stats ?? { totalCreations: 0, totalSessions: 0, totalParticipants: 0, avgScore: null };

  const tiles: Tile[] = [
    { icon: <Sparkles style={{ width: 20, height: 20, color: "var(--ap-brand)" }} />, label: "Créations", value: s.totalCreations },
    { icon: <BarChart2 style={{ width: 20, height: 20, color: "var(--ap-quiz)" }} />, label: "Sessions totales", value: s.totalSessions },
    { icon: <Users style={{ width: 20, height: 20, color: "var(--ap-poll)" }} />, label: "Participants totaux", value: s.totalParticipants },
    { icon: <Target style={{ width: 20, height: 20, color: "#f59e0b" }} />, label: "Score moyen (quiz)", value: s.avgScore != null ? `${s.avgScore} pts` : "-" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px" }}>
      {tiles.map(({ icon, label, value }) => (
        <div key={label} className="ap-card" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "14px" }}>
          <div className="ap-tile__icon" style={{ background: "var(--ap-paper-2)", boxShadow: "0 3px 0 var(--ap-line)", marginBottom: 0, width: 40, height: 40 }}>
            {icon}
          </div>
          <div>
            <div style={{ fontSize: "22px", fontWeight: 800, fontFamily: "var(--ap-font-display)", color: "var(--ap-ink)" }}>{value}</div>
            <div className="ap-muted" style={{ fontSize: "12px" }}>{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/app/src/components/dashboard/KpiRow.tsx
git commit -m "feat(app): add Dashboard KpiRow component"
```

---

### Task 4: `NewsModule` component

**Files:**
- Create: `apps/app/src/components/dashboard/NewsModule.tsx`

- [ ] **Step 1: Write the implementation**

```tsx
// apps/app/src/components/dashboard/NewsModule.tsx
import { useEffect, useState } from "react";
import { Rocket } from "lucide-react";
import { fetchLatestChangelog, type ChangelogRelease } from "@/lib/changelog";

export function NewsModule() {
  const [releases, setReleases] = useState<ChangelogRelease[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLatestChangelog(5).then((r) => { if (!cancelled) setReleases(r); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="ap-card" style={{ padding: "20px" }}>
      <h2 className="ap-h3" style={{ fontSize: "16px", marginBottom: "16px" }}>Nouveautés</h2>
      {releases === null ? (
        <p className="ap-muted" style={{ fontSize: "13px" }}>Chargement…</p>
      ) : releases.length === 0 ? (
        <p className="ap-muted" style={{ fontSize: "13px" }}>Pas de nouveautés pour l'instant.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {releases.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <div className="ap-tile__icon" style={{ background: "var(--ap-paper-2)", boxShadow: "0 3px 0 var(--ap-line)", marginBottom: 0, width: 32, height: 32, flexShrink: 0 }}>
                <Rocket style={{ width: 16, height: 16, color: "var(--ap-brand)" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--ap-ink)" }}>
                  {r.title} <span className="ap-muted" style={{ fontWeight: 600 }}>· {r.version}</span>
                </div>
                <div className="ap-muted" style={{ fontSize: "12px" }}>{r.dateLabel}</div>
                {r.intro && <p style={{ fontSize: "12px", color: "var(--ap-muted)", marginTop: "4px" }}>{r.intro}</p>}
              </div>
            </div>
          ))}
          {/* /changelog lives in apps/marketing — full navigation, not react-router Link. */}
          <a href="/changelog" className="ap-btn ap-btn--ghost ap-btn--sm" style={{ alignSelf: "flex-start", marginTop: "4px" }}>
            Voir tout le changelog
          </a>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/app/src/components/dashboard/NewsModule.tsx
git commit -m "feat(app): add Dashboard NewsModule component"
```

---

### Task 5: `Dashboard` page + route

**Files:**
- Create: `apps/app/src/pages/Dashboard.tsx`
- Modify: `apps/app/src/App.tsx:37` (lazy import), `apps/app/src/App.tsx:85` (route)

- [ ] **Step 1: Write the page**

```tsx
// apps/app/src/pages/Dashboard.tsx
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { KpiRow } from "@/components/dashboard/KpiRow";
import { NewsModule } from "@/components/dashboard/NewsModule";
import { getCurrentUser } from "@/lib/auth";
import { computeDashboardStats, type DashboardStats } from "@/lib/dashboardStats";

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) return;
    let cancelled = false;
    computeDashboardStats(user.id).then((s) => { if (!cancelled) setStats(s); });
    return () => { cancelled = true; };
  }, []);

  return (
    <AppLayout subtitle="Tableau de bord">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div style={{ marginBottom: "32px" }}>
          <h1 className="ap-h2" style={{ fontSize: "26px", marginBottom: "4px" }}>Tableau de bord</h1>
          <p className="ap-muted" style={{ fontSize: "14px" }}>Vue d'ensemble de vos créations et de l'actualité du produit.</p>
        </div>

        <div style={{ marginBottom: "32px" }}>
          <KpiRow stats={stats} />
        </div>

        <NewsModule />
      </div>
    </AppLayout>
  );
};

export default Dashboard;
```

- [ ] **Step 2: Register the lazy import**

In `apps/app/src/App.tsx`, in the "Authenticated / builder pages" group (right before `const MyQuizzes = lazy(...)` at line 33):

```typescript
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MyQuizzes = lazy(() => import("./pages/MyQuizzes"));
```

- [ ] **Step 3: Register the route**

In `apps/app/src/App.tsx`, right before `<Route path="/my-quizzes" element={<MyQuizzes />} />` (line 85):

```tsx
<Route path="/dashboard" element={<Dashboard />} />
<Route path="/my-quizzes" element={<MyQuizzes />} />
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/pages/Dashboard.tsx apps/app/src/App.tsx
git commit -m "feat(app): add /dashboard route"
```

---

### Task 6: `AppSidebar.tsx` — Dashboard + "Mes créations" submenu

**Files:**
- Modify: `apps/app/src/components/AppSidebar.tsx` (full file, current content below)

Current relevant content (before this task's edits):

```tsx
// imports (top of file)
import { type ReactNode, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, BookOpen, ChevronDown, ClipboardList, Compass, GraduationCap,
  LayoutDashboard, Layers, Library, Plus, Presentation, Settings, Users, X,
} from "lucide-react";
import { t } from "@/lib/i18n";
import type { User as AuthUser } from "@/lib/auth";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { label: t("dashboard"), icon: LayoutDashboard, path: "/my-quizzes", requiresAuth: true },
  { label: t("questionBank"), icon: Library, path: "/question-bank", requiresAuth: true },
  { label: t("discoverPublic"), icon: Compass, path: "/discover", requiresAuth: false },
  { label: t("footerCommunity"), icon: Users, path: "/community", requiresAuth: false },
  { label: t("settings"), icon: Settings, path: "/profile", requiresAuth: true },
];
```

- [ ] **Step 1: Add the new imports**

In `apps/app/src/components/AppSidebar.tsx`, replace the lucide-react import block:

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
  Users,
  X,
} from "lucide-react";
```

and add, right after the `dropdown-menu` import block:

```typescript
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
```

and replace the `components/ui/sidebar` import block:

```typescript
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
```

- [ ] **Step 2: Replace `NAV_ITEMS` — drop dashboard from the list, add `CREATIONS_ITEMS`**

Replace:

```typescript
const NAV_ITEMS = [
  { label: t("dashboard"), icon: LayoutDashboard, path: "/my-quizzes", requiresAuth: true },
  { label: t("questionBank"), icon: Library, path: "/question-bank", requiresAuth: true },
  { label: t("discoverPublic"), icon: Compass, path: "/discover", requiresAuth: false },
  { label: t("footerCommunity"), icon: Users, path: "/community", requiresAuth: false },
  { label: t("settings"), icon: Settings, path: "/profile", requiresAuth: true },
];
```

with:

```typescript
// Same 6 routes ContentExplorer.tsx's (now-removed) TYPE_TABS used to link to
// — content-type switching moved from an in-page tab strip into this submenu.
const CREATIONS_ITEMS = [
  { label: "Quiz", path: "/my-quizzes" },
  { label: "Sondages", path: "/my-polls" },
  { label: "Flashcards", path: "/my-flashcards" },
  { label: "Slides", path: "/my-slides" },
  { label: "Cours", path: "/my-courses" },
  { label: "Examens", path: "/my-exams" },
];

const NAV_ITEMS = [
  { label: t("questionBank"), icon: Library, path: "/question-bank", requiresAuth: true },
  { label: t("discoverPublic"), icon: Compass, path: "/discover", requiresAuth: false },
  { label: t("footerCommunity"), icon: Users, path: "/community", requiresAuth: false },
  { label: t("settings"), icon: Settings, path: "/profile", requiresAuth: true },
];
```

- [ ] **Step 3: Add `creationsOpen` state**

Replace:

```typescript
export const AppSidebar = ({ user, extraSection }: AppSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
```

with:

```typescript
export const AppSidebar = ({ user, extraSection }: AppSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [creationsOpen, setCreationsOpen] = useState(
    () => CREATIONS_ITEMS.some((item) => item.path === location.pathname),
  );
```

- [ ] **Step 4: Render Dashboard + the "Mes créations" collapsible before the `NAV_ITEMS` map**

Replace:

```tsx
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV_ITEMS.filter((item) => (item.requiresAuth ? Boolean(user) : true)).map((item) => {
              const Icon = item.icon;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                  >
                    <Icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
        {extraSection}
      </SidebarContent>
```

with:

```tsx
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {user && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location.pathname === "/dashboard"}
                  onClick={() => navigate("/dashboard")}
                >
                  <LayoutDashboard />
                  <span>{t("dashboard")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {user && (
              <Collapsible open={creationsOpen} onOpenChange={setCreationsOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <FolderOpen />
                      <span>{t("myCreations")}</span>
                      <ChevronDown
                        className="chevron-icon ml-auto h-3.5 w-3.5"
                        style={{ transform: creationsOpen ? "rotate(180deg)" : undefined }}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {CREATIONS_ITEMS.map((item) => (
                        <SidebarMenuSubItem key={item.path}>
                          <SidebarMenuSubButton
                            isActive={location.pathname === item.path}
                            onClick={() => navigate(item.path)}
                          >
                            <span>{item.label}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )}

            {NAV_ITEMS.filter((item) => (item.requiresAuth ? Boolean(user) : true)).map((item) => {
              const Icon = item.icon;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                  >
                    <Icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
        {extraSection}
      </SidebarContent>
```

- [ ] **Step 5: Typecheck**

Run: `cd apps/app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors

- [ ] **Step 6: Lint**

Run: `cd apps/app && npx eslint src/components/AppSidebar.tsx`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add apps/app/src/components/AppSidebar.tsx
git commit -m "feat(app): sidebar Dashboard + Mes créations submenu"
```

---

### Task 7: `ContentExplorer.tsx` — remove `TYPE_TABS`, shorten breadcrumb root

**Files:**
- Modify: `apps/app/src/components/content/ContentExplorer.tsx`

- [ ] **Step 1: Drop the now-unused `Link` import**

Replace:

```typescript
import { Link, useNavigate } from "react-router-dom";
```

with:

```typescript
import { useNavigate } from "react-router-dom";
```

- [ ] **Step 2: Remove the `TypeTab` interface and `TYPE_TABS` constant**

Delete this block entirely (it's no longer referenced anywhere in the file after Step 3):

```typescript
interface TypeTab {
  type: ContentType;
  label: string;
  route: string;
  dot: string; // css var
}

const TYPE_TABS: TypeTab[] = [
  { type: "quiz", label: "Quiz", route: "/my-quizzes", dot: "--ap-quiz" },
  { type: "poll", label: "Sondages", route: "/my-polls", dot: "--ap-poll" },
  { type: "flashcard", label: "Flashcards", route: "/my-flashcards", dot: "--ap-flash" },
  { type: "slide", label: "Slides", route: "/my-slides", dot: "--ap-pres" },
  { type: "course", label: "Cours", route: "/my-courses", dot: "--ap-pres" },
];
```

- [ ] **Step 3: Remove the tab-strip `<nav>` block**

Delete (the type-switching UI now lives in `AppSidebar.tsx`'s "Mes créations" submenu, see Task 6):

```tsx
        {/* Type tabs — proof of the shared explorer, anchored to the content rule */}
        <nav
          aria-label="Type de contenu"
          style={{ display: "flex", gap: 6, alignItems: "flex-end", margin: "2px 0 24px", borderBottom: "3px solid var(--ap-line)", overflowX: "auto" }}
        >
          {TYPE_TABS.map((tab) => {
            const on = tab.type === type;
            return (
              <Link
                key={tab.type}
                to={tab.route}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: `2px solid ${on ? `var(${tab.dot})` : "var(--ap-line)"}`,
                  borderBottom: "none",
                  background: on ? `var(${tab.dot})` : "var(--ap-paper-2)",
                  color: on ? "#fff" : "var(--ap-muted)",
                  borderRadius: "15px 15px 0 0",
                  padding: on ? "10px 19px 15px" : "10px 19px 13px",
                  marginBottom: "-3px",
                  fontFamily: "var(--ap-font-display)",
                  fontWeight: 600,
                  fontSize: 14,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: on ? "#fff" : `var(${tab.dot})` }} />
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {c.error && (
```

replacing it with just:

```tsx
        {c.error && (
```

(i.e. delete the `<nav>...</nav>` block and the blank line above `{c.error &&`, keep `{c.error && (` itself.)

- [ ] **Step 4: Shorten the breadcrumb root label**

Replace (inside the `view === "all"` breadcrumb branch):

```tsx
                    <button
                      className="ap-btn ap-btn--ghost ap-btn--sm"
                      style={{ padding: "2px 8px", fontWeight: 700 }}
                      onClick={() => goFolder(null)}
                    >
                      {rootLabel}
                    </button>
```

with:

```tsx
                    <button
                      className="ap-btn ap-btn--ghost ap-btn--sm"
                      style={{ padding: "2px 8px", fontWeight: 700 }}
                      onClick={() => goFolder(null)}
                    >
                      Racine
                    </button>
```

(`rootLabel` stays used elsewhere in this file — the "Dossiers" section header at `{rootLabel} — {libraryItems.length}` and `FolderExplorer`'s `rootLabel` prop — only this breadcrumb occurrence changes.)

- [ ] **Step 5: Typecheck**

Run: `cd apps/app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors — confirms `ContentType` import (still used by `ContentExplorerProps`/`TrashView` etc.) and no other file references the deleted `TypeTab`/`TYPE_TABS`.

- [ ] **Step 6: Confirm nothing else imports the deleted symbols**

Run: `cd apps/app && grep -rn "TYPE_TABS\|TypeTab" src`
Expected: no matches

- [ ] **Step 7: Lint**

Run: `cd apps/app && npx eslint src/components/content/ContentExplorer.tsx`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add apps/app/src/components/content/ContentExplorer.tsx
git commit -m "refactor(app): drop ContentExplorer's TYPE_TABS strip, shorten breadcrumb root"
```

---

### Task 8: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `cd apps/app && npm run typecheck`
Expected: no errors

- [ ] **Step 2: Full test suite**

Run: `cd apps/app && npx vitest run`
Expected: all tests pass, including the two new `dashboardStats.test.ts` cases

- [ ] **Step 3: Full lint**

Run: `cd apps/app && npx eslint src`
Expected: no new errors (pre-existing warnings, e.g. `components/ui/sidebar.tsx`'s react-refresh warning, are unrelated and unchanged)

- [ ] **Step 4: Manual click-through** (requires `npm run dev` + a logged-in test account with at least one quiz that has a recorded session)

- `/dashboard` loads, shows non-zero KPIs for an account with quiz history, shows "-" avg score and zeroed counts for a fresh account, shows either real changelog entries or the "Pas de nouveautés" empty state.
- Sidebar: "Mes créations" auto-expands when landing directly on `/my-quizzes` (or any of the 6 routes), collapses/expands on click, all 6 submenu routes navigate correctly and highlight when active.
- `/my-quizzes` (and the other 5 "Mes …" pages): no more tab strip, breadcrumb root reads "Racine" instead of repeating the content-type name, topbar subtitle and H1 unchanged.
- `/question-bank`, `/discover`, `/community`, `/profile` nav items still work exactly as before.

- [ ] **Step 5: Commit if Step 4 surfaced any fixes**

```bash
git add -A
git commit -m "fix(app): address manual QA findings from dashboard/sidebar rollout"
```
