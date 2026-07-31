---
target: Dashboard / app shell
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
timestamp: 2026-07-30T21-32-26Z
slug: src-pages-dashboard-tsx
---
Method: dual-agent (A: a27d0f087cc91395a · B: ac71bc7354c1c0286)

Re-critique after the harden/icon/audit/layout/clarify fix pass (commit `cd66b65`, branch `feat/dashboard-critique-fixes`). Both assessments ran independently with no memory of the prior critique.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeletons + badges; no confirmation toast after "Tout marquer comme lu" |
| 2 | Match System / Real World | 3 | Domain-correct FR vocabulary throughout |
| 3 | User Control and Freedom | 3 | Escape/click-outside closes menus; every widget has an exit |
| 4 | Consistency and Standards | 2 | Two near-identical search entry points in the header (GlobalSearch + CommandPalette icon) |
| 5 | Error Prevention | 2 | KPI tiles are clickable buttons with no visual affordance beyond cursor |
| 6 | Recognition Rather Than Recall | 3 | Icon+label everywhere except the collapsed icon rail (tooltip-only) |
| 7 | Flexibility and Efficiency | 3 | ⌘K palette, KPI-click-to-scroll, org switcher |
| 8 | Aesthetic and Minimalist Design | 3 | Clean grid, generous whitespace; diluted by RecentWorks thumbnails reading as warning-red |
| 9 | Error Recovery | 2 | `DashboardSectionError` gives real per-section retry now, but message is generic, no diagnostic detail |
| 10 | Help and Documentation | 2 | Support group exists in sidebar; nothing contextual to the dashboard itself |
| **Total** | | **26/40** | **Acceptable** |

**Trend for `src-pages-dashboard-tsx` (last 2 runs): 25.5 → 26 (out of 40)**

Small move, same band. The fix pass targeted specific confirmed defects (silent failures, icon system, one heading skip, one menu's item count, repeated copy) rather than the score itself — worth knowing going in that a 6-item punch list rarely moves a 40-point holistic score much, especially when fresh eyes immediately surface a *new* P1 elsewhere (see below).

## Design Specificity Verdict

**LLM assessment**: Reads as authored, not generic — the "+Créer" menu's Évaluer/Former split, French pedagogical copy ("Reprenez là où vous vous êtes arrêté"), 14-day trend cadence, and a genuinely complete Material 3 skin (real role-based color/elevation/shape tokens in `theme-material.css`) show real intent. What undercuts it: the dashboard's visual grammar (icon-tile + KPI card + line/bar chart) is still Stripe/Linear-generic, and — newly surfaced this pass — the content-type color for "quiz" doubles as the app's error color, a collision that wouldn't exist if the palette had been built error-first.

**Deterministic scan**: 0 CLI findings on `AppLayout.tsx`, `AppSidebar.tsx`, `Dashboard.tsx`, and all `src/components/dashboard/*` — confirmed the detector itself works (verified against a known-flawed file elsewhere in the repo, which correctly flagged). Live overlay reported 10 hits across 8 rule categories; **DOM-verified every one as a false positive for this specific route** — global CSS rules matched by static scan, none actually rendered/active in the live `/dashboard` DOM (`nested-cards`, `side-tab`, `bounce-easing` ×2, `layout-transition`, `pulsing-dot`, `marquee` ×2, `dark-glow`, plus `cramped-padding` reassessed as likely-false given the element's fixed 40px height + flex-centering). **Heading order independently re-verified**: `H1 → H2 → H2 → H2 → H2` — the skipped-heading-level fix holds.

**Console**: clean of app errors this run. The `[content-migration] failed` error from `auth.ts:66` that appeared in the pre-fix critique did **not** recur here — likely intermittent/non-deterministic (a timing-dependent path), not something this fix pass specifically addressed, so don't read it as fixed.

## Overall Impression

The fix pass held: no regressions, the accessibility and icon-system fixes are confirmed live, and the grouped Créer menu reads as genuine intentional IA to a fresh reviewer ("verified live... genuine cognitive-load-driven IA"). But a fresh pass immediately found a P1 the first critique missed: `COLLAB_ITEMS` in the sidebar has 6 flat items in one group, violating the exact ≤4 rule the codebase's own comments say motivated the `CREATE_GROUPS` split. Same defect class, different location, not caught last time because the first critique's target framing centered on the KPI/dashboard content, not the sidebar's other collapsible group.

## What's Working

- `TrendBadge` never encodes meaning by color alone (arrow direction + "vs 14j préc." text) — a deliberate, in-code-documented accessibility call.
- `CREATE_GROUPS`'s Évaluer/Former split verified live in the "+Créer" menu — reads as real IA, not decoration.
- `DashboardSectionError` gives independent retry for stats vs. charts instead of one blanket failure state — confirmed working as designed.

## Priority Issues

**[P1] `COLLAB_ITEMS` breaks the app's own ≤4-item rule.** `AppSidebar.tsx`'s collaboration group has 6 flat items (Partagés, Groupes, Signatures, Notation manuelle, Mes notes, Banque de questions) — the in-code comment says it was split out of a 9-item group specifically to fix this, but landed at 6, still over the threshold `CREATE_GROUPS` now demonstrably respects two items away. Fix: sub-cluster into e.g. "Correction" (grading/notes) and "Collaboration" (groups/shared/signatures/bank), ≤3 each. → `/impeccable layout`

**[P2] Quiz brand color doubles as the error color.** `--ap-quiz` (`#ff5a4d`) is both the "quiz" content-type hue and the base for `--ap-quiz-deep`, which `DashboardSectionError` uses for its error text/icon color. Since quizzes are most users' most common content type, 3 of 4 `RecentWorks` thumbnails render in the same pale-coral family as the error state — the "recent work" gallery can read like a row of warnings. Fix: introduce a dedicated `--ap-danger` token independent of any content-type hue. → `/impeccable colorize` or a token-scoped `/impeccable harden` follow-up

**[P2] Duplicate search entry points, still present.** `AppLayout.tsx` shows an inline `GlobalSearch` bar and a separate circular search-icon button opening `CommandPalette`, ~40px apart, same icon. (Flagged as a minor note in the pre-fix critique too — recurring, unaddressed, and a fresh reviewer independently re-found it, which is a stronger signal than either single mention.) Fix: merge into one entry point, or visually differentiate their scope. → `/impeccable clarify`

**[P3] Empty Activity state has no next action.** "Pas encore de session sur les 14 derniers jours" is purely descriptive, right after the KPI row's "8 Créations" peak — a flat landing with no CTA. Fix: add "Lancez votre première session" linking to `/my-quizzes`. → `/impeccable onboard`

## Persona Red Flags

**Jordan (first-timer)**: a zero-creation account would see 4 zeroed KPI tiles, two empty charts, and `RecentWorks` silently disappearing entirely (`if (!loading && rows.length === 0) return null`) — nothing on the page tells them what to do first. The duplicate search icons add friction on day one.

**Sam (accessibility)**: the collapsed icon-rail sidebar relies on hover-only `Tooltip` for labels — a real risk if tooltip content isn't also wired to `aria-label` on the underlying button (flagged as unverified risk, not confirmed broken — worth a direct check). Several dashboard captions use hardcoded px inline font sizes (11–13px) rather than a rem scale, which may not reflow cleanly under browser text-size overrides.

## Minor Observations

- "Score moyen (quiz)" KPI tile navigates away (`/my-quizzes`) while the other 3 scroll in-page — same button styling, different behavior, no visual cue distinguishing the two interaction types.
- The "+Créer" mega-menu's explicit close (×) button is redundant next to native click-outside/Escape dismissal.
- Live-overlay cleanup left cosmetic outline/badge residue in the DOM after `live-server.mjs stop` — tooling artifact, not an app defect.
- One console exception this run came from a Chrome extension (`chrome-extension://.../vendor.js`), not app code.

## Questions to Consider

1. If "8 Créations" is the page's emotional peak, why does everything below it actively undercut that with "no activity yet" — should a training platform lead with engagement instead of authoring volume?
2. `CREATE_GROUPS` got the ≤4-item treatment explicitly (it's in the code comments) — why didn't `COLLAB_ITEMS`, sitting right below it in the same file, get the same pass?
3. Were `GlobalSearch` and `CommandPalette` ever meant to coexist, or did they evolve from separate initiatives that never got reconciled into one entry point?
