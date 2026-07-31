---
target: Dashboard / app shell
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
timestamp: 2026-07-30T22-50-18Z
slug: src-pages-dashboard-tsx
---
Method: dual-agent (A: a6a57328c31085718 · B: a4212fedb7a5468fe)

Re-critique after the palette-wording / empty-score-hint / terminal-icon fix pass (commit `6eae587`, branch `feat/dashboard-critique-fixes`). Both assessments ran independently, no memory of any prior critique.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Notification bell's open/close state signal could be stronger for non-visual users |
| 2 | Match System / Real World | 3 | Plain-language labels throughout |
| 3 | User Control and Freedom | 3 | No undo/confirm on notification delete (instant) |
| 4 | Consistency and Standards | 2 | **New**: 3 of 4 KPI tiles scroll-to-chart on click, "Score moyen" silently navigates away instead — same styling, different contract |
| 5 | Error Prevention | 3 | Retry pattern solid |
| 6 | Recognition Rather Than Recall | 2 | **New**: every notification shares an identical accessible name regardless of differentiating content |
| 7 | Flexibility and Efficiency | 3 | Cmd+K, sidebar collapse, KPI-as-shortcut all present |
| 8 | Aesthetic and Minimalist Design | 3 | Calm, legible |
| 9 | Error Recovery | 3 | Clear retry CTA |
| 10 | Help and Documentation | 3 | Reachable support group |
| **Total** | | **28/40** | **Good** |

**Trend for `src-pages-dashboard-tsx`: 25.5 → 26 → 27 → 29 → 28 (out of 40)**

The dip from 29 to 28 is normal inter-rater variance, not a regression — B independently re-confirmed both round-4 fixes hold with zero DOM issues (see below); the score moved because this round's fresh reviewer weighted two newly-found real issues (aria-label collision, KPI interaction inconsistency) into heuristics 4 and 6, not because anything broke.

## Design Specificity Verdict

Reads as authored — the Évaluer/Former split, exam-vs-quiz distinction, and French-first copy are product-specific. The KPI-tiles-plus-two-charts shape is still fairly template-common at first glance, but the underlying content model (correction workflow, question bank, learning paths) differentiates it one level in.

**Deterministic scan**: 0 CLI findings on target files (now including `notifications/`). **Round-4's disputed P0 definitively closed**: B measured every notification-panel element's `getBoundingClientRect().right` against `window.innerWidth` (1470px) — max right was 1458, a full 12px inside the edge, zero elements overflow. Confirmed not a bug, full stop. **Command palette wording reconfirmed correct**: "Aller à une page ou une action…". Live overlay: same recurring pattern — ~6 real findings (sidebar transitions, line-length, cramped-padding, nested-cards — all previously seen, none new), ~5 false positives (inactive-theme/route global CSS). Console: `[content-migration] failed` (`auth.ts:66`) persists — now flagged in 3+ rounds, unrelated to this scope, still unaddressed upstream.

## Overall Impression

The disputed notification-overflow question is now closed for good with exact measurements. Both round-4 fixes (palette wording, terminal icon) hold. This round's value: a fresh reviewer found two genuine, previously-unflagged issues — a real accessibility bug (identical notification labels) and a real consistency gap (one KPI tile that navigates away while its three siblings stay on-page).

## Priority Issues

**[P2] Notification items are accessibility-indistinguishable.** `NotificationItem.tsx:68`'s `aria-label` is built from the generic event title ("Nouvelle copie remise"), not the differentiating fields. Live DOM check on 4 real notifications: all 4 shared the exact same aria-label string, while their visible body text differs (student name + exam title). A screen-reader user tabbing the list hears the identical label four times. Fix: build the label from the differentiating fields, e.g. `` `Ouvrir : ${studentName} a terminé « ${examTitle} »` ``.

**[P2] "Score moyen" KPI tile has a different interaction contract than its siblings.** Créations/Sessions/Participants tiles call `scrollToChart(...)` (stay on page); Score moyen calls `navigate("/my-quizzes")` (leaves the page) — identical button styling, no affordance difference signaling "this one is different." Fix: add a small external-navigation glyph to that tile, or point it at an on-page breakdown if one exists.

**[P3] Unnecessary collapse on a 2-item sidebar group.** `CORRECTION_ITEMS` has exactly 2 entries but renders as a `Collapsible`, closed by default — progressive disclosure applied where the group is too small to need hiding, costing graders an extra click to reach items they likely use often.

## Persona Red Flags

**Sam (accessibility)**: the notification aria-label collision is a real, measured hit — screen-reader users can't efficiently triage exam submissions by ear.
**Alex (power-user)**: the KPI-tile inconsistency breaks a learned "click tile → jump to detail on this page" pattern, forcing an unwanted context switch.

## Minor Observations

- Command palette's empty-query list shows 6 flat destinations with no sub-grouping — borderline against the ≤4 guideline applied elsewhere in this same codebase, though arguably fine as a scannable list rather than a decision point.
- Material 3 skin verified healthy and coherent when active (`--ap-brand` → `#65558f`, tonal surfaces, pill CTA) — the token system itself isn't the gap; Arcade Pop being the permanent default despite Material 3 being design authority is a standing, unresolved product question (raised again this round).
- `[content-migration] failed` console error persists across 3+ rounds now (`auth.ts:66`) — still out of this scope, still unaddressed.

## Questions to Consider

1. If Material 3 is design authority but Arcade Pop is what 100% of users actually see, is there a plan to reconcile, or is Arcade Pop the permanent product face regardless?
2. Is "Score moyen" navigating away (vs. the other 3 tiles scrolling in-page) a deliberate signal that scores deserve their own surface, or an unexamined side effect of no scores chart existing yet?
