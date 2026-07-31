---
target: Dashboard / app shell
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
timestamp: 2026-07-30T22-34-35Z
slug: src-pages-dashboard-tsx
---
Method: dual-agent (A: aca10f7f929eab08b · B: a224cff6239849eb8)

Re-critique after the chart-color / search-icon / onboarding-CTA fix pass (commit `6f9fd70`, branch `feat/dashboard-critique-fixes`). Both assessments ran independently, no memory of any prior critique.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Zero-activity tiles indistinguishable from a stuck-loading state once resolved |
| 2 | Match System / Real World | 4 | Correct domain vocabulary throughout |
| 3 | User Control and Freedom | 3 | Create-menu has explicit close; notification per-item controls exist but are unreachable (see P0) |
| 4 | Consistency and Standards | 3 | Two search entries both captioned "Rechercher..." |
| 5 | Error Prevention | 3 | `DashboardSectionError` isolates failures per-section |
| 6 | Recognition Rather Than Recall | 2 | Bolt icon has no inherent "search/command" association; the ⌘K chip carries all the meaning |
| 7 | Flexibility and Efficiency | 2 | **New**: notification panel overflows the viewport at 1470px, hiding tabs and per-item actions entirely |
| 8 | Aesthetic and Minimalist Design | 3 | Clean KPI row, restrained iconography |
| 9 | Error Recovery | 3 | Clear retry action, if generic message |
| 10 | Help and Documentation | 3 | Support group reachable |
| **Total** | | **29/40** | **Good** (crossed the band for the first time) |

**Trend for `src-pages-dashboard-tsx`: 25.5 → 26 → 27 → 29 (out of 40)**

## Design Specificity Verdict

Reads as authored, not template filler: real French B2B-training copy, a genuine changelog with version-numbered entries, a content taxonomy specific to the domain, and — confirmed via in-code comments — the Évaluer/Former and Collaboration/Correction splits were deliberate reactions to a stated ≤4-item working-memory rule, not decoration.

**Deterministic scan**: 0 CLI findings on target files (detector verified functional elsewhere). **Both prior fixes independently reconfirmed**: chart bars now `rgb(122,89,0)` (quiz) vs `rgb(73,69,79)` (other) — visually and numerically distinct; search UI shows the bolt+⌘K chip, visually differentiated from the input. Live overlay: 18 raw findings, ~8 real DOM matches (sidebar transitions ×5 — pre-existing, perf-only; line-length ×2; nested-cards ×1), 2 borderline (text-overflow and cramped-padding, both confirmed **false positives** on visual inspection — same as prior rounds), ~7 confirmed false positives (inactive-theme/route global CSS). Console: the same pre-existing `[content-migration] failed` (`auth.ts:66`) noted in round 1, unrelated to this scope, still unaddressed — flagging again since it's now been seen twice.

## Overall Impression

First round to cross into the "Good" band. The prior two fixes held under independent re-verification. This pass's fresh reviewer found a genuine P0: the notification panel overflows the viewport at a standard laptop width, making its tabs and per-item actions (mark-read, delete) literally unreachable without resizing the window.

## Priority Issues

**[P0] Notification panel overflows the viewport, hiding controls.** At 1470px width, `NotificationCenter`'s dropdown renders past the right edge. Confirmed via accessibility tree: "Non lues"/"Préférences" tabs and "Marquer comme lue"/"Supprimer" buttons exist in the DOM but are visually cut off; body text truncates mid-word with no ellipsis. Fix: anchor the panel's right edge to the trigger button instead of a fixed offset that can exceed viewport width; add a max-width fallback.

**[P1] Two adjacent, near-identically-captioned search entries.** `GlobalSearch` ("Rechercher dans vos contenus...") sits next to the bolt+⌘K trigger, but `CommandPalette` itself opens with "Rechercher une page, une action ou un contenu..." — same verb, overlapping scope, still confusing despite the icon fix from last round. Fix: differentiate wording (e.g., palette placeholder → "Actions rapides") or fold content search into the palette entirely.

**[P2] "Score moyen (quiz)" empty state is a bare dash with no explanation.** Sits next to 3 real numbers; a first-time user can misread it as broken. Fix: "Pas encore de score" or a tooltip on hover.

**[P3] Bolt icon lacks a recognition cue for "command palette."** No established association the way a magnifying glass has; the ⌘K chip is doing all the work. Fix: consider a search/terminal icon instead, or drop the icon and rely on the chip.

## Persona Red Flags

**Jordan (first-timer)**: sees a bare "-" for Score moyen with zero explanation; the Créer mega-menu's explicit × close button is a nonstandard pattern Jordan may not expect on a click-outside-dismissible dropdown.
**Riley (stress-tester)**: rapidly opening the Créer menu and clicking through can navigate mid-transition (agent mis-clicked into `/exam-builder` during the review) — fast double-click risks unintended navigation. The notification overflow (P0) is exactly the kind of thing a real-laptop user hits immediately.

## Minor Observations

- Footer shows "© 2026 Brivia · v0.0.0" — a literal `v0.0.0` version string in production-facing copy looks unfinished.
- `DashboardSectionError`'s retry button uses inline styles rather than the shared `Button` component — inconsistent with the rest of the button system.
- Recurring: `[content-migration] failed` console error (`auth.ts:66`), seen in round 1 and again here — unrelated to this scope but flagging its persistence.

## Questions to Consider

1. If the command palette already searches pages/actions/content, does the separate `GlobalSearch` header input still earn its pixel budget?
2. `--ap-danger` was deliberately separated from `--ap-quiz` to avoid confusing "destructive" with "quiz-branded" — why does `DashboardSectionError` reuse it for a benign "data failed to load" state rather than a neutral tone?
3. The "Lancer une session" empty-state CTA pattern works well on `ActivityChart` — why not mirror it on "Score moyen," which is in the identical zero-data state?
