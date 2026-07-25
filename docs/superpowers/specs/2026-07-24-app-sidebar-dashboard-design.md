# App sidebar restructure + real Dashboard page

## Context

`feat/app-header-redesign` replaced the app's top pill nav with a topbar + persistent left sidebar (`AppSidebar`/`AppLayout`). With that shell in place, the current "Dashboard" nav item is just an alias for `/my-quizzes`, and each content-type page (`/my-quizzes`, `/my-polls`, `/my-flashcards`, `/my-slides`, `/my-courses`) still renders its own in-page tab-strip (`TYPE_TABS` in `ContentExplorer.tsx`) to switch between types — a second, redundant type-switcher now that the sidebar exists. It also produces stacked repetition of the content-type name (topbar subtitle "Mes Quiz" + H1 "Mes Quiz" + tab "Quiz" + breadcrumb "Tous les quiz").

Goal: give "Dashboard" real content (stats/news/KPIs, not just an alias), move type-switching into the sidebar as a submenu, and remove the now-redundant in-page tab strip.

## Sidebar structure

`AppSidebar.tsx`'s main nav changes from:

```
Dashboard → /my-quizzes
Banque de questions → /question-bank
Découvrir → /discover
Communauté → /community
Paramètres → /profile
```

to:

```
Dashboard → /dashboard (new page)
Mes créations → expandable submenu:
  Quiz → /my-quizzes
  Sondages → /my-polls
  Flashcards → /my-flashcards
  Slides → /my-slides
  Cours → /my-courses
  Examens → /my-exams
Banque de questions → /question-bank
Découvrir → /discover
Communauté → /community
Paramètres → /profile
```

The submenu reuses the shadcn `SidebarMenuSub`/`SidebarMenuSubButton` primitives already present in `components/ui/sidebar.tsx` (unused until now, same situation the top-level `Sidebar` was in before this session). The 6 submenu entries carry the same `{ type, label, route }` shape as today's `TYPE_TABS` in `ContentExplorer.tsx` — that array's data moves to `AppSidebar.tsx` (or a shared constant both import), `ContentExplorer.tsx` stops rendering it as a tab strip.

Active-state: the submenu item highlights when `location.pathname` matches its route (same pattern as the existing main nav items); "Mes créations" itself expands automatically when the current route is one of the 6.

`requiresAuth` gating: the whole "Mes créations" entry (and its submenu) only renders when `user` is set, matching how "Dashboard"/"Banque de questions"/"Paramètres" are already gated in `AppSidebar.tsx`.

## ContentExplorer changes

- Remove the `TYPE_TABS` `<nav>` block (folder-tab strip) entirely.
- Keep the topbar subtitle (e.g. "Mes Quiz") — user confirmed keep it for orientation.
- Keep the page H1 ("Mes Quiz") as-is.
- Shorten the breadcrumb: drop the "Tous les quiz" root crumb wording (currently repeats the type name a 4th time) in favor of a plain home-icon → current folder name, no type-name text in the breadcrumb root.
- Everything else (shortcuts sidebar-within-page for Favoris/Publics/Corbeille, drag-and-drop folders, grid/list toggle, sort) is unchanged.

## Dashboard page (`/dashboard`)

New route + page, rendered inside `AppLayout` (gets the same topbar/sidebar/footer shell as every other app page). Two modules, nothing more:

**KPI row** (`components/dashboard/KpiRow.tsx`)
3-4 stat tiles, aggregated across *all* the user's content (not per-quiz like `QuizResults`/`PollResults` today):
- Total créations (count across quiz/poll/flashcard/slide/course — `getUserQuizzes(userId).length`)
- Sessions totales (sum of per-quiz session counts)
- Participants totaux (sum of per-quiz participant counts)
- Score moyen (weighted average across sessions, or "-" if no sessions yet)

New helper `lib/dashboardStats.ts` computes this by summing the same per-quiz session/participant data `QuizResults.tsx`/`PollResults.tsx` already read per-item, across every item `getUserQuizzes(userId)` returns. Degrades to zeros/"-" for a fresh account with no content — no error state, just an empty/zero KPI row.

**News module** (`components/dashboard/NewsModule.tsx`)
Latest 3-5 published changelog entries, read from the same `changelog_releases` table the admin console and marketing's `/changelog` page already use (public read, filtered to `status === "published"`, not the admin-gated hook). Each row links through to the full changelog on the marketing site (`${APP_ORIGIN...}` cross-domain pattern doesn't apply here since this is app→marketing; real `<a href="/changelog">`-via-full-navigation like the rest of the app's marketing-owned links). Empty state: "Pas de nouveautés pour l'instant" instead of an empty module, no error thrown if the fetch fails (same `.catch(() => [])` degrade pattern used elsewhere).

## Files touched

- New: `src/pages/Dashboard.tsx`, `src/components/dashboard/KpiRow.tsx`, `src/components/dashboard/NewsModule.tsx`, `src/lib/dashboardStats.ts`.
- Modified: `src/components/AppSidebar.tsx` (nav restructure + submenu), `src/components/content/ContentExplorer.tsx` (remove `TYPE_TABS` strip, shorten breadcrumb), `src/App.tsx` (new `/dashboard` route).

## Testing

Manual click-through: dashboard loads with real numbers for a user with content, zero/empty state for a fresh account, submenu expands/collapses and auto-expands when landing directly on one of the 6 routes, all 6 routes still reachable and unchanged otherwise, breadcrumb no longer repeats "quiz" wording, topbar subtitle still present on content-type pages.
