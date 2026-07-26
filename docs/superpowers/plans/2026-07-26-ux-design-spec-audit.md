# UX/Design Spec Compliance Audit — apps/app

**Date:** 2026-07-26
**Scope:** `apps/app` (Vite/React quiz platform). `apps/marketing` and `packages/ui` (orphaned, unused by `apps/app`) are out of scope.
**Input:** two requirement sets — "Exigences fonctionnelles UX" (REQ-UX/DB/TBL/SRC/FRM/AI/PER/UI/ACC/PERF/DS) and "Exigences de design UI" (REQ-DES/LAY/TYP/COL/ICO/BTN/NAV/TAB/FOR/PAN/STA/BDG/DAT/RWD/THM/MOT/VIS/CNT/AID/DS). ~220 requirement IDs total.

**Method:** repo inspection (grep + file reads), no runtime testing. Every claim below is backed by a file reference found during the audit; nothing here is aspirational.

**Read this as:** a gap list + a phased roadmap, not a finished redesign. Nothing has been changed in the codebase yet — this is the artifact you asked for before picking what to build.

**Status (2026-07-26):** P0 and P1 implemented on branch `fix/ux-audit-p0` (commits `8edd8f2`, `361eff7`). P2/P3 not started. See the roadmap section below for what's in each phase; items already shipped are not re-marked inline there, check the commits for the exact diff.

---

## Executive summary

The app has real design-system bones (shadcn/ui + a documented "Arcade Pop" token layer, 5 skinnable themes, dark mode, non-blocking toasts, decent empty states) but almost none of the *interaction-model* requirements this spec cares about: no command palette, no data-table primitive anywhere despite `table.tsx` being installed, no breadcrumbs outside 3 pages (3 different implementations), no real-time form validation, no AI-content labeling, no role-based dashboard, no saved views, no bulk actions. Several installed-but-unused packages (`cmdk`, shadcn `table`/`breadcrumb`/`AlertDialog`) suggest partial starts that were abandoned mid-build.

Two items are flagged as **P0 correctness/security issues**, not just UX gaps, and should be fixed regardless of which roadmap phase gets picked up:
- The dashboard "autosave" indicator (`QuizBuilder.tsx:1188`) is cosmetic — it shows "saved" without persisting anything, which directly contradicts REQ-STA-002/006 (visual feedback must reflect what actually happened) and is a data-loss risk.
- The Anthropic API key is called directly from the browser (`courseGenerator.ts:4`, `CourseGeneratorModal.tsx:39-47`) with a comment acknowledging it's unsafe in production. Not a REQ-* item, but blocks REQ-AI-004/AID-006 (traceable, verifiable AI) from ever being done properly — fix this before building more AI surface on top of it.

---

## Section-by-section gaps

Status legend: ✅ compliant · 🟡 partial · ❌ missing.

### 1. Navigation & architecture (REQ-UX-001–006)
- 🟡 **REQ-UX-001** (≤3 interactions to any feature): mostly true (quiz creation 2 clicks, tools 1 click) **except sharing**, which is 4 clicks and only exists for Courses — no share action for quizzes/polls/flashcards/slides/exams (`CourseContextMenu.tsx:51`, `QuizBuilder.tsx:479`).
- ❌ **REQ-UX-002** (menus organized by business process, not tech architecture): `AppSidebar.tsx` groups by content-type (quiz/poll/flashcard/slide/course/exam), which *is* the technical data model, not a workflow (Prepare → Run → Analyze). Maps directly to REQ-NAV-003.
- ❌ **REQ-UX-003** (breadcrumb everywhere): `Breadcrumb.tsx` used in 3/~40 pages; `ContentExplorer.tsx` reimplements its own inline breadcrumb; shadcn `breadcrumb.tsx` primitive installed, 0 usages. Three parallel implementations, no coverage — this is both a gap and a consistency violation (REQ-DES-005).
- ✅ **REQ-UX-004** (primary actions visible without a secondary menu): "+ Créer" is in the sidebar header, not buried.
- 🟡 **REQ-UX-005** (keyboard shortcuts for frequent ops): only exist inside the presentation editor and wheel tool; nothing app-wide (create, save, search, navigate).
- ❌ **REQ-UX-006** (Ctrl+K command palette): `cmdk` + `command.tsx` installed, never wired up. This is the single highest-leverage gap in the whole audit — it's mostly plumbing, not new UI.

### 2. Dashboard (REQ-DB-001–005)
- ❌ **REQ-DB-001** (role-adapted dashboard): one static layout for every user.
- ❌ **REQ-DB-002** (priority tasks needing action): not present.
- ❌ **REQ-DB-003** (KPIs with time comparison J-1/week/month/year): `KpiRow.tsx` shows raw current totals only, no deltas/trend.
- ❌ **REQ-DB-004** (KPI → detail drill-down): tiles are plain `<div>`s, not links.
- 🟡 **REQ-DB-005** (alerts visually distinct from info): only one dynamic module (`NewsModule.tsx`), no severity levels at all — nothing to distinguish, which is itself the gap.

### 3. Data tables (REQ-TBL-001–010)
Spec says tables are typically >60% of a business app; here there are **no data tables at all** — only card/row lists (`ContentExplorer.tsx`) and one raw unstyled `<table>` (`SubscribersTab.tsx`). No `@tanstack/react-table` dependency exists.
- ❌ REQ-TBL-001 (column drag-reorder), 002 (show/hide columns), 005 (frozen columns), 006 (bulk row actions), 009 (10k-row perf/virtualization) — all not applicable because there is no table component to have these features.
- 🟡 REQ-TBL-003 (filters auto-saved): view-mode (grid/list) persists per type in localStorage, but filter/search state does not.
- ❌ REQ-TBL-004 (multi-column sort): single-column sort only.
- 🟡 REQ-TBL-007 (export respects active filters): exports exist (Question Bank, Quiz results, Exam CSV, Presentation JSON) but are isolated per-feature, not filter-aware library exports.
- ✅ REQ-TBL-008 (reload without full page reload): `ContentExplorer.tsx` refetches via Supabase client-side already.
- ❌ REQ-TBL-010 (per-user saved views): no named/persisted filter+sort combos.

### 4. Search (REQ-SRC-001–005)
- ✅ REQ-SRC-001 (global search from every page): `GlobalSearch.tsx`, header-mounted.
- ❌ REQ-SRC-002 (natural language): plain `ilike` substring match on title only.
- ❌ REQ-SRC-003 (results grouped by object type): flat list with inline type chips.
- ❌ REQ-SRC-004 (recent search history): none persisted.
- ❌ REQ-SRC-005 (typo tolerance): none — exact substring only.

### 5. Forms (REQ-FRM-001–007)
- ❌ REQ-FRM-001 (required fields marked at open): no asterisks/markers anywhere sampled.
- ❌ REQ-FRM-002 (real-time error detection): submit-time only, everywhere (`AuthPage.tsx`, `QuizBuilder.tsx`, `ProfilePage.tsx`).
- 🟡 REQ-FRM-003 (errors explain cause + fix): cause is usually stated (toast text), fix/remediation rarely is; one case (`invalidCredentials`) is deliberately vague for security, which is correct there but shows there's no differentiated pattern for the general case.
- ❌ REQ-FRM-004 (long forms split into steps): `MultiStepProgress.tsx` exists but is only used in *player-facing gameplay*, never in content-creation builders (`ExamBuilder.tsx` is one long flat page).
- ❌ **REQ-FRM-005** (drafts autosaved): the one "autosave" UI (`QuizBuilder.tsx:516-522`) is fake — see P0 note above.
- 🟡 REQ-FRM-006 (known data prefilled): works within a single form's edit-mode, no cross-form prefill.
- N/A REQ-FRM-007 (search in 20+ item dropdowns): no dropdown currently has ≥20 items, so nothing to fix yet, but no `Combobox` component exists if/when one is needed.

### 6. AI (REQ-AI-001–006)
One AI feature exists (AI course generation from uploaded files, Anthropic API called client-side).
- ✅ REQ-AI-001 (no auto-execution): generation produces a draft, doesn't auto-publish.
- ❌ REQ-AI-002 (AI content visibly labeled): the generated course opens in `CourseBuilder` with zero "AI-generated" badge.
- 🟡 REQ-AI-003 (accept/modify/reject): user *can* edit in the builder afterward, but there's no explicit review/diff step before it becomes a normal course.
- ❌ REQ-AI-004 (inputs used are inspectable): no way to see what was extracted from the uploaded file vs. generated.
- ❌ REQ-AI-005 (AI actions traceable in history): no activity log exists at all in the app.
- ❌ REQ-AI-006 (contextual suggestions): the only AI surface is this one standalone generator, not embedded in task flows.

### 7. Personalization (REQ-PER-001–005)
- ❌ REQ-PER-001 (customizable dashboard): fixed layout.
- ✅ REQ-PER-002 (display prefs remembered): theme + site-skin persisted server-side via Supabase (`auth.ts:228-236`).
- 🟡 REQ-PER-003 (favorites synced across devices): a "Favoris" view exists per content type but only as a filter, not confirmed to be device-synced the same way theme is (needs verification — likely stored per-item flag in Supabase, so probably fine, but not confirmed during this audit).
- ✅ REQ-PER-004 (light/dark theme): present, though implemented as a manual DOM class toggle rather than a `ThemeProvider` (works, but `next-themes` is installed and only used for the toaster — an odd half-adoption).
- ❌ REQ-PER-005 (density: compact/standard/comfortable): does not exist.

### 8. UI states (REQ-UI-001–005)
- 🟡 REQ-UI-001 (loading indicator >500ms): present but low quality — mostly literal "Chargement…" text, `Skeleton` component installed but used in only 3 places.
- ✅ REQ-UI-002 (empty states with action/explanation): well done in `ContentExplorer.tsx` (icon + title + body + CTA); inconsistent elsewhere (admin tables just show one emoji line).
- ❌ REQ-UI-003 (errors distinguish user/business/system): everything funnels through `toast.error()` uniformly; only a weak two-tier split (toast vs. persistent banner) exists, not a real taxonomy.
- ✅ REQ-UI-004 (non-blocking notifications): Sonner toasts are non-blocking. Note: two toast systems are mounted simultaneously (Radix `Toaster` + Sonner) — dead code, not a functional problem, but should be cleaned up (REQ-DS-004-adjacent).
- ❌ REQ-UI-005 (confirm only irreversible actions): three different confirmation patterns coexist for the same category of destructive action (`Dialog`, `AlertDialog`, native `window.confirm()`), which is a consistency violation (REQ-BTN-005/PAN-006) more than an over-confirming problem.

### 9. Accessibility (REQ-ACC-001–005)
- 🟡 REQ-ACC-001/002 (full keyboard access + visible focus): focus-visible is themed consistently across all 5 skins (good), but keyboard operability hasn't been verified for interactive components beyond nav/search.
- 🟡 REQ-ACC-003 (WCAG 2.2 AA contrast): at least one token has a documented contrast ratio in a comment; no systematic/automated check exists.
- 🟡 REQ-ACC-004 (icon-only elements have accessible labels): `aria-label` used in 34/191 `.tsx` files, concentrated in nav/search — not systematic.
- ❌ REQ-ACC-005 (errors announced to assistive tech): only 3 hits app-wide for `aria-invalid`/`aria-describedby`/`role="alert"` combined — form errors are functionally invisible to screen readers.

### 10. Perceived performance (REQ-PERF-001–004)
- Not directly measured (needs runtime profiling, out of scope for a static audit). Structural risk: `ContentExplorer.tsx` uses client-side pagination with no virtualization, so REQ-PERF-003 will start failing once a user's library grows large. No virtualization library installed anywhere.

### 11. Design System consistency (REQ-DS-001–004 / REQ-DS-001–010 design set)
- ✅ Single component source (shadcn), consistent color/spacing/typography *within* what's built.
- ❌ **`packages/ui` is orphaned** — `apps/app` doesn't depend on it; `BrandMonogram`/`BrandWordmark` are byte-identical duplicates maintained in two places. Direct violation of REQ-DS-001 (single Design System source) and REQ-DES-005.
- ❌ No Storybook / component documentation anywhere (REQ-DS-003/DS-010 design set).
- 🟡 Tokens are real CSS custom properties (good, REQ-DS-005/REQ-COL-012) but naming is brand-flavored (`--ap-ink`, `--ap-brand`) rather than fully semantic (`text-primary`, `surface-error` per REQ-DS-006's own example) — workable but worth a naming pass if the token layer gets formalized.

### 12. Buttons, tables, forms, panels, states, badges (design spec §§6–12)
Consistency problems more than absence problems:
- ❌ REQ-BTN-005/PAN-006 pattern above (three confirmation UX patterns for one action category).
- 🟡 REQ-BTN-008/009 (button states incl. loading, no double-submit): not verified per-component during this audit — flag for follow-up spot check before claiming compliance.
- N/A REQ-TAB-* (table design rules): no data table exists yet to apply them to; capture these requirements in the table-implementation task when it happens rather than auditing an empty set now.
- 🟡 REQ-FOR-001/002/009/010 (persistent labels, no placeholder-as-label, multi-signal errors): labels look fine structurally (shadcn `Form`/`Label` primitives are used), but error signaling is toast-only, not the field-level icon+text+border combo the spec requires.
- 🟡 REQ-PAN-005 (warn on closing panel with unsaved changes): exists for quiz builder navigation (`beforeunload` + in-app confirm) but not verified for other panels/sheets.

### 13. Responsive (REQ-RWD-001–010)
- ✅ Sidebar has a real mobile pattern (slide-over `Sheet` below 768px via `use-mobile.tsx`).
- 🟡 Everything else relies on default Tailwind breakpoints applied ad hoc per page; no evidence of a deliberate mobile-task-priority pass (REQ-RWD-003) or a small-screen alternative for dense views (REQ-RWD-005) — there are no data tables yet, so this is mostly moot until §3 is addressed.

### 14. Content & microcopy (REQ-CNT-*)
Not deeply audited (would require reading all copy). Spot-observation: error copy is short and mostly business-vocabulary (French, in `i18n.ts`), consistent with REQ-CNT-001/005; not verified against REQ-CNT-003 (same object/action always named the same way) across the whole app.

---

## Roadmap

Ordered by leverage (impact × how much of the spec it unblocks) rather than by REQ section number. Each phase is independently shippable; later phases depend on earlier ones only where noted.

### P0 — Fix before building anything else
1. **Make the autosave indicator honest** (`QuizBuilder.tsx:516-522`, `1188`) — either wire it to a real periodic save, or remove the "saved" state and keep only the existing `beforeunload` guard. Closes the REQ-STA-002/006 violation and the data-loss risk.
2. **Stop calling Anthropic directly from the browser** (`courseGenerator.ts:4`) — proxy through a Supabase Edge Function (the repo already has an Edge Functions pattern — `supabase/functions/*`). Blocks REQ-AI-004/005/AID-006 until fixed, and is a real key-exposure issue independent of this spec.
3. **Collapse the three destructive-confirmation patterns into one** (`Dialog` vs `AlertDialog` vs `window.confirm()`) — standardize on the shadcn `AlertDialog` primitive that's already installed. Closes REQ-BTN-005/DES-005/PAN-006.
4. **Delete the orphaned `packages/ui` duplicate** or actually adopt it as the single Design System source (pick one — right now it's dead weight that violates REQ-DS-001).

### P1 — Highest leverage per unit of work (mostly wiring already-installed packages)
1. **Ctrl+K command palette** — `cmdk` + `command.tsx` are already installed and unused; wire a launcher that indexes nav routes, "+ Créer" actions, and content search. Closes REQ-UX-006, materially helps REQ-UX-001/005.
2. **One breadcrumb, everywhere** — delete the two ad-hoc reimplementations (`ContentExplorer.tsx` inline version, and reconcile `Breadcrumb.tsx` vs. the unused shadcn `breadcrumb.tsx`), standardize on one, roll out past the current 3 pages. Closes REQ-UX-003/NAV-009.
3. **Real-time form validation on the 3–4 core forms** (Auth, QuizBuilder, ProfilePage) — field-level `aria-invalid` + inline message + focus-first-error-on-submit. Closes REQ-FRM-002/003, REQ-FOR-009/010/011, REQ-ACC-005 in one pass since they're the same underlying pattern.
4. **AI-generated content labeling** — add a visible badge/banner when a course originated from `CourseGeneratorModal`, plus a simple "sources used" panel. Closes REQ-AI-002/004, REQ-AID-001.
5. **KPI trend deltas + drill-down links** — extend `computeDashboardStats` with a prior-period comparison and make `KpiRow` tiles into links. Closes REQ-DB-003/004.

### P2 — Structural additions (bigger builds, higher payoff)
1. **Data table primitive** — adopt `@tanstack/react-table` on top of the already-installed shadcn `table.tsx`, starting with the admin `SubscribersTab.tsx` (smallest surface) then the content-library views if/when they need true tabular data (sort/filter/bulk actions/column config). This unlocks the entire REQ-TBL-* and REQ-TAB-* sections at once — currently 0% addressable because no table exists.
2. **Unify sharing across content types** — generalize `ShareCourseModal`/`CourseContextMenu` sharing to quizzes/polls/flashcards/slides/exams, and surface it from the item list, not just a submenu. Fixes the REQ-UX-001 outlier (4-click sharing).
3. **Navigation re-grouping by workflow, not content-type** — restructure `AppSidebar.tsx` sections around business tasks (e.g. Create / Run & Present / Review & Share / Library) instead of the 6-way content-type split. This is a bigger, more disruptive change — validate with the user before executing (REQ-UX-002/NAV-003).
4. **Density setting** (compact/standard/comfortable) — add as a third axis alongside the existing theme/site-skin persistence in `ProfilePage.tsx`/`auth.ts`. Closes REQ-PER-005/THM-006.
5. **Search upgrade** — group results by type, add recent-search history (localStorage is enough), and fuzzy/typo-tolerant matching (e.g. Postgres `pg_trgm` or a client-side fuzzy lib over the existing `searchContent.ts` results). Closes REQ-SRC-002/003/004/005.

### P3 — Polish / hardening (do alongside or after P1–P2, not blocking)
- Multi-step wizard for long creation forms (`ExamBuilder.tsx` and similar) reusing `MultiStepProgress.tsx`.
- Error taxonomy (validation vs business vs system) instead of uniform `toast.error()`.
- Remove the dead Radix `Toaster` (Sonner is the de facto standard already).
- Accessibility pass: systematic `aria-label` coverage on icon-only controls, automated contrast checking (add `axe-core`/`jest-axe` to the test setup), `eslint-plugin-jsx-a11y`.
- Storybook (or equivalent) for the design system once `packages/ui` question (P0-4) is resolved.
- Virtualization for `ContentExplorer.tsx` lists ahead of REQ-PERF-003/TBL-009 becoming a real problem.

---

## What this document does not do
- No code was changed.
- Design-spec sections not directly tied to app behavior (icon library choice details, exact spacing scale values, chart-type selection rules) were spot-checked, not exhaustively verified against every REQ-* id — treat §12–14 above as directional, and re-check specific IDs before marking them "done" in a future pass.
- `apps/marketing` (Next.js site) was not audited — if it needs to meet this spec too, that's a separate pass.

**Next step:** pick a phase (or specific items) from the roadmap above and I'll turn it into an execution plan.
