---
target: Dashboard / app shell
total_score: 25.5
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-07-30T20-58-27Z
slug: src-pages-dashboard-tsx
---
Method: dual-agent (A: a0e3c3d2c26b8f51c · B: af67922d854e8f11a)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeletons + trend badges present; "Pas de comparaison disponible" repeats 4× as noise |
| 2 | Match System / Real World | 3 | Accurate French-first domain terms |
| 3 | User Control and Freedom | 3 | Sidebar collapse + KPI→chart jump; no date-range control on the hardcoded 14-day window |
| 4 | Consistency and Standards | 2 | Dashboard hardcodes `lucide-react` icons even under the canonical Material 3 skin, which everywhere else runs on `MaterialSymbol` |
| 5 | Error Prevention | 3 | No destructive dashboard actions to guard |
| 6 | Recognition Rather Than Recall | 3 | Consistent icon+label pairing |
| 7 | Flexibility and Efficiency | 2 | Cmd+K palette exists; zero dashboard personalization/filtering |
| 8 | Aesthetic and Minimalist Design | 2.5 | Material 3 render calm; Arcade Pop default busier for a daily-checked surface |
| 9 | Error Recovery | 1 | `Dashboard.tsx` has no `.catch` on stats/chart fetches — confirmed live: console showed repeated `[content-migration] failed` errors with no user-visible failure state |
| 10 | Help and Documentation | 3 | Support group (Centre d'aide, Roadmap, Signaler un problème) reachable from sidebar |
| **Total** | | **25.5/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment**: Structurally this is a boilerplate SaaS admin dashboard — 4 KPI tiles, two charts, a recent-items grid, a changelog feed — the same shape as any admin template. What's authored-for-this-product is the copy and the deliberate KPI→chart cross-linking (`scrollToChart`). But the platform's actual stakes — exam grading queues, certificates, pass/fail — are entirely absent from the dashboard despite dedicated nav items (`/grading`, `/certificates`, `/my-grades`). It reads as a content-creation dashboard bolted onto an assessment product.

**Deterministic scan**: Direct `detect.mjs` scan of `AppLayout.tsx`, `AppSidebar.tsx`, `Dashboard.tsx`, and its 5 direct children (`ActivityChart`, `CreationsByTypeChart`, `KpiRow`, `NewsModule`, `RecentWorks`) — **0 findings**. The live-injected overlay on the rendered `/dashboard` page reported 11 pattern hits across 8 categories, but DOM verification showed most don't apply to this route: `nested-cards`, `side-tab`, `bounce-easing` (loader), `pulsing-dot`, and `marquee` selectors are **not present in the rendered DOM** — they're global rules in the shared `components.css` matched by the scanner but not rendered on `/dashboard` (false positives for this page, though the CSS patterns themselves are real elsewhere in the app). Two hits were DOM-confirmed real: a `cramped-padding` hit on `a.ap-btn.ap-btn--ghost.ap-btn--sm`, and — more significant — a **confirmed skipped heading level**: H1 "Tableau de bord" → H3 "Activité (14 derniers jours)" with no intervening H2, a real WCAG 1.3.1 violation the LLM review didn't independently catch but which corroborates Assessment A's accessibility concerns for Sam. (The overlay's own console header claimed "3 anti-patterns found" while listing 11 — a detector-tooling inconsistency, not an app issue.)

**Visual overlays**: Overlay was injected and read via console, not left open in a persistent human-visible tab (session was closed after evidence collection).

## Overall Impression

Functionally solid, visually calm (especially under Material 3), but generic: the dashboard could belong to almost any content-creation SaaS. The single biggest opportunity is surfacing the product's actual stakes — pending grading, upcoming/expiring certificates, exam pass-rate alerts — instead of only content-authoring stats. A close second: the dashboard silently fails when its data fetch errors, which is both a UX gap and, per the live console evidence, an actively-occurring condition, not a hypothetical.

## What's Working

- **Trend badges pair icon + text + color deliberately** (`KpiRow.tsx`, comment marks this as intentional: "never color-only") — real accessibility intent, not accidental.
- **KPI tiles are functional navigation**, not dead stats — clicking one scrolls to and highlights the matching chart (`scrollToChart`).
- **Graceful empty-state suppression**: `RecentWorks.tsx` returns `null` rather than showing an awkward blank card when there's nothing to show.

## Priority Issues

**[P1] Dashboard fetches fail silently, and this is already happening in practice**
Why it matters: `Dashboard.tsx` calls `computeDashboardStats(userId)` / `computeDashboardCharts(userId)` with no `.catch`. A rejected promise leaves state null forever — the skeleton spins with no failure message. Live browser evidence confirms `[content-migration] failed` errors are actually firing repeatedly (`src/lib/auth.ts:66`) while the dashboard is loaded, meaning users can be looking at a silently-stuck dashboard right now.
Fix: Add `.catch` mirroring `RecentWorks.tsx`'s pattern; render an explicit retry/failure state instead of an infinite skeleton.
Suggested command: `/impeccable harden`

**[P1] Icon system fractures under the canonical design system**
Why it matters: `KpiRow.tsx` and `RecentWorks.tsx` import `lucide-react` icons directly, while `AppLayout.tsx`/`AppSidebar.tsx` and the rest of the shell route through the app's own `MaterialSymbol` wrapper — the component built specifically to render correctly under Material 3 (rounded symbols) as well as the other 4 skins. Under the confirmed-canonical Material 3 theme, dashboard icons stay sharp/outlined instead of rounded, breaking the one skin the user has designated as design authority.
Fix: Route dashboard icons through `MaterialSymbol`.
Suggested command: `/impeccable polish` (scoped to `src/components/dashboard/`)

**[P1] Skipped heading level (confirmed, WCAG 1.3.1)**
Why it matters: DOM-verified heading order on `/dashboard` is H1 → H3 → H3 → H2 → H2 — no H2 between the page H1 and the first section heading. Screen-reader users navigating by heading level (Sam persona) hit a structural gap.
Fix: Insert an H2 section heading before the first H3-level chart/module, or promote the first section heading to H2.
Suggested command: `/impeccable audit` (accessibility pass)

**[P2] Dashboard omits the product's actual high-stakes surfaces**
Why it matters: `/grading`, `/my-grades`, `/certificates` all exist in the sidebar, but nothing on the dashboard surfaces pending grading, expiring certificates, or exam pass/fail alerts — the moments that matter most on a training platform, and the product's stated differentiator (exams + certificates depth) per PRODUCT.md.
Fix: Add a "needs attention" module surfacing grading queue count / recent certificate events.
Suggested command: `/impeccable shape` (define the module's content/data needs first)

**[P2] "+ Créer" menu presents 7 flat, ungrouped choices**
Why it matters: Quiz/poll/flashcard/slide/course/learning-path/exam builders are listed with no grouping, exceeding the ~4-item working-memory guideline at a decision point a first-timer hits immediately.
Fix: Cluster into two groups, e.g. "Évaluer" (quiz/exam/poll) vs. "Former" (course/learning-path/flashcard/slide).
Suggested command: `/impeccable layout`

**[P3] Repeated placeholder copy dilutes the KPI row**
Why it matters: "Pas de comparaison disponible" appears 4× identically across KPI tiles, reading as unfinished for low-activity accounts and diluting the row's numeric emphasis.
Fix: Either suppress the comparison line entirely when there's no baseline, or write one shared explanatory line instead of 4 repeats.
Suggested command: `/impeccable clarify`

## Persona Red Flags

**Jordan (First-Timer)**: Lands on an all-zero KPI row with no onboarding CTA. The "+ Créer" menu dumps 7 undifferentiated builder types before Jordan knows what a "sondage" vs. "flashcard" builder even is. `ACCOUNT_ITEMS`/`SUPPORT_ITEMS` in `AppSidebar.tsx` use raw French strings instead of `t()` — unlike the rest of the nav — which breaks for an English-locale first session.

**Sam (Accessibility)**: Confirmed skipped heading level (H1→H3, see Priority Issues) breaks screen-reader heading navigation. `TrendBadge`'s green/red colors are hardcoded hex (`#15c08a`/`#ff5a4d`) rather than routed through the token system that adapts per-skin elsewhere, so contrast against Arcade Pop's cream card background is unverified. Material's skin explicitly styles `:focus-visible`; no equivalent was found for Arcade Pop's default focus ring, risking inconsistent keyboard-focus visibility depending on which of the 5 skins is active.

## Minor Observations

- Header has both a `GlobalSearch` input and a separate search-icon button opening `CommandPalette` — near-duplicate search entry points.
- Notification bell badge ("3") is disconnected from any dashboard summary of what those notifications actually are.
- `cramped-padding` DOM-confirmed on `a.ap-btn.ap-btn--ghost.ap-btn--sm` (detector: needs ≥4.2px vertical padding for 14px text) — low-impact but a quick fix.
- Detector overlay's own count-mismatch (header says "3 anti-patterns," body lists 11) is a tooling quirk worth being aware of when reading future live-mode overlay output, not an app defect.
- Two benign React Router v7 future-flag console warnings — framework notices, not app bugs.

## Questions to Consider

1. If exams/certificates/grading are the platform's actual stakes, why does the dashboard's information architecture look identical to a generic content-creation SaaS?
2. Is "+ Créer" a menu or a decision test? Seven flat options serve the power user who already knows what they want, not the first-timer choosing blind.
3. What would this dashboard look like if it opened with "what needs you today" instead of "what you've made so far"?
