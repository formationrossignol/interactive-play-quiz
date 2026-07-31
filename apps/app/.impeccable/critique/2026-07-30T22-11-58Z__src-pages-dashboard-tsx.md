---
target: Dashboard / app shell
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
timestamp: 2026-07-30T22-11-58Z
slug: src-pages-dashboard-tsx
---
Method: dual-agent (A: a73873c3d8a14bc49 · B: aa1dfac8244ddb9d4)

Re-critique after the sidebar-grouping + danger/quiz color-token fix pass (commit `5d48f21`, branch `feat/dashboard-critique-fixes`). Both assessments ran independently, no memory of any prior critique.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Brief no-shimmer beat before chart bars draw in |
| 2 | Match System / Real World | 3 | French B2B training vocabulary throughout |
| 3 | User Control and Freedom | 3 | Mega-menu has explicit close; collapsed rail degrades reasonably |
| 4 | Consistency and Standards | 2 | Two adjacent search affordances, same glyph, unclear which does what |
| 5 | Error Prevention | 3 | `DashboardSectionError` retry pattern solid and reusable |
| 6 | Recognition Rather Than Recall | 2 | **New**: `CreationsByTypeChart` bars render identical dark gray instead of per-type brand colors — color-coded scanning is broken |
| 7 | Flexibility and Efficiency | 3 | KPI tiles are clickable shortcuts that scroll to the matching chart |
| 8 | Aesthetic and Minimalist Design | 3 | Clean, but ~7 sidebar group headers visible when fully open |
| 9 | Error Recovery | 3 | Independent retry for stats vs. charts confirmed working |
| 10 | Help and Documentation | 2 | Nothing contextual on the dashboard for a zero-data first session |
| **Total** | | **27/40** | **Acceptable** (1 point off Good) |

**Trend for `src-pages-dashboard-tsx`: 25.5 → 26 → 27 (out of 40)**

## Design Specificity Verdict

No longer generic — sticker-shadow cards, per-content-type color coding, the Évaluer/Former split, French-native copy, and a genuinely good `/shared-with-me` empty state (icon + heading + 3 explainer tiles + CTA) show real authored craft. Undercut by: the KPI-row + 2-chart layout is still a conventional SaaS-dashboard skeleton, and Arcade Pop's playful thick-border aesthetic sits oddly against the B2B "responsable pédagogique" persona who does certificate/grading work elsewhere in the same app.

**Deterministic scan**: 0 CLI findings on the 4 target-area files (AppLayout, AppSidebar, Dashboard, dashboard/*). **Sidebar grouping fix independently reconfirmed**: Collaboration = 4 items, Correction = 2 items, both ≤4. Heading order reconfirmed clean: H1→H2→H2→H2→H2. Live overlay reported 11 categories; DOM-verified breakdown: **4 real** (layout-transition on sidebar width/margin/height — perf-unfriendly but legitimate elements; a confirmed **text-overflow bug**: the "Modèle : 03. Identity & Access Management" recent-work title overflows its `truncate`-classed container by 51px; line-length on body copy; cramped-padding on one ghost button, same one flagged two rounds ago, still unaddressed), **1 ambiguous** (nested-cards, couldn't confirm actual nesting via DOM), **5-6 false positives** (global CSS for inactive themes/routes — side-tab for a different theme, bounce-easing/pulsing-dot/marquee elements not present on this route). Console clean of app errors (one Chrome-extension-internal exception, not app code).

## Overall Impression

The fixes held — sidebar grouping and heading order both independently reconfirmed by a reviewer with no memory of the prior work. But this pass surfaced a genuine functional bug neither prior round caught: `CreationsByTypeChart`'s bars have lost their per-content-type colors and render as flat dark gray, breaking the exact "recognition over recall" pattern the rest of the dashboard (RecentWorks badges) gets right. Plus one confirmed text-overflow bug on a specific recent-work title.

## Priority Issues

**[P1] `CreationsByTypeChart` lost its per-type bar colors.** Bars render identical dark gray instead of `--ap-quiz`/`--ap-poll`/`--ap-flash`/`--ap-pres` per type — confirmed via zoomed screenshot. Likely a `ChartStyle`'s `[data-chart=id]` CSS-var injection not reaching `Cell fill="var(--color-${row.type})"` (stacking/specificity/theme-scope issue), since the same tokens render correctly in `RecentWorks` badges on the same page. → needs a source-level fix, not a design call

**[P2] Confirmed text-overflow on a RecentWorks title.** "Modèle : 03. Identity & Access Management" overflows its `truncate`-classed span by 51px (scrollWidth 298 vs clientWidth 247) — the ellipsis isn't clipping for this specific string length, likely a flex/grid ancestor missing `min-width: 0`. Other titles on the page truncate correctly (0 overflow), so this is a real, reproducible edge case, not a false positive. → `/impeccable harden`

**[P2] Redundant search UI, still present.** `GlobalSearch` input + separate Cmd+K icon, same glyph, unclear purpose split — raised in round 1's critique as a minor note, independently re-found by two more fresh reviewers since. Three independent findings across three rounds is a strong signal this is real, not noise.

**[P2] No onboarding nudge for zero-activity accounts.** KPI row shows flat zeros, `ActivityChart` says "no sessions yet" with no CTA — even though the account has 8 pieces of content ready to use. → `/impeccable onboard`

**[P3] Chart draw-in has a brief no-shimmer beat** before bars render — a small, low-severity violation of the project's own skeleton-loading rule.

## Persona Red Flags

**Jordan (first-timer)**: 8 creations but zero sessions/participants, no explicit "next step" CTA — has to self-discover they should launch a session. Also faces ~7 sidebar group headers on first login.
**Sam (accessibility)**: `CreationsByTypeChart`'s broken color-coding removes a redundant visual channel (color + label) that would otherwise help — degraded, not blocking, since labels stay readable.

## Minor Observations

- `ACCOUNT_ITEMS`/`SUPPORT_ITEMS` labels are hardcoded French strings, not run through `t()` — flagged in round 1 too, still unaddressed, will break EN localization.
- Layout-transition findings (sidebar width/margin/height transitions) are real DOM elements but perf-unfriendly (should prefer `transform`) — pre-existing shadcn sidebar behavior, not introduced by recent fixes.
- Curly vs. straight apostrophe inconsistency in `SUPPORT_ITEMS` copy ("Centre d'aide").

## Questions to Consider

1. If Material 3 is the stated design authority, why does the shipped default (Arcade Pop) use thick sticker-shadows that Material 3's own tokens explicitly flatten (`--ap-shadow-soft: none`)? Is Arcade Pop the wrong default for the B2B-serious personas who live in Correction/Collaboration?
2. Why does a near-empty account (0 sessions on 8 pieces of content) get treated identically to a thriving one, with no "activate your content" moment?
3. Is the search-input-plus-search-icon redundancy a merge artifact from `GlobalSearch` and `CommandPalette` evolving independently — should one absorb the other?
