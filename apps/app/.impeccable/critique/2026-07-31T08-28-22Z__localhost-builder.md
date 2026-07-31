---
target: "http://localhost:8080/builder"
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-07-31T08-28-22Z
slug: localhost-builder
---
Method: dual-agent (A: a5c7f965f92e3cb87 · B: a81fee801ddc28d65)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Save pill still lies after the first Publier on a brand-new quiz; delete gives zero feedback |
| 2 | Match System / Real World | 3 | French-first, sensible domain language throughout |
| 3 | User Control and Freedom | 1 | No undo for delete; no confirm gate before an irreversible action |
| 4 | Consistency and Standards | 2 | Nav-away is confirm-gated (reversible action); question delete isn't (irreversible action) |
| 5 | Error Prevention | 1 | New questions ship with a correct answer already selected, no forcing function to review |
| 6 | Recognition Rather Than Recall | 4 | Live phone mirror — nothing to remember, always in view |
| 7 | Flexibility and Efficiency | 3 | Keyboard drag sensor, duplicate, import, question bank all present |
| 8 | Aesthetic and Minimalist Design | 3 | Coherent Arcade Pop register, well-controlled editor hierarchy |
| 9 | Error Recovery | 2 | Title-validation is a good pattern; delete has no equivalent recovery path |
| 10 | Help and Documentation | 2 | Good contextual microcopy; no formal help layer (acceptable for this surface) |
| **Total** | | **22/40** | **Acceptable** |

## Design Specificity Verdict

**LLM read**: Arcade Pop applied with real intentionality — the colored-shape answer system (triangle/circle/square/diamond) is the exact vocabulary players see live, so a host builds with what they'll recognize on stage. The three-pane layout (rail/editor/live mirror) is a genuine "what you type is what they see" pattern. Register consistently maintained, no Material 3 bleed-through — correct for this route.

**Detector**: `QuizBuilder.tsx` dropped from 6 findings to **2** (confirmed) — both are the deliberately-consolidated scrim literal, the accepted trade-off from the last pass. `PollSession.tsx` shows 7, but only 2 belong to the same scrim trade-off; the other 5 (`rgba(47,123,255,...)` x3, a `layout-transition`, one off-ramp `font-size`) are pre-existing, unrelated to this work, part of the app-wide backlog.

**Live overlay**: page-wide scan shows the size-spread ratio improved (1.7:1 → 1.5:1) since the last run — a real, measurable effect of the typography fix. New in this scan: `tiny-text` (11.5px, x2) and a first-seen `nested-cards` finding — neither confirmed as a regression from this work; noted for follow-up. Shell-level findings (bounce-easing, side-tab, pulsing-dot, marquee, dark-glow) remain correctly exempted — intentional Arcade Pop vocabulary on this route.

## Overall Impression

Nothing regressed, and the token-drift cleanup measurably worked (6→2 findings, ratio improved, notch/typography fixes hold live under a real re-test with an actual uploaded image on the background-media layout — no crash, no console errors from that path). But the three trust-critical bugs from the last critique are still exactly where they were: save lies, delete has no safety net, correct answers are pre-armed. This pass mostly validated cleanup work, and — as intended — did not touch behavior.

## What's Working

1. **Live phone mirror** — instant, no crash on a real uploaded image with the "Plein écran" background layout, verified this run.
2. **Rail auto-scroll-into-view** — reconfirmed working on 2 consecutive new-question adds.
3. **Prior layout/token fixes hold under a second, harder test**: notch radius via token, 11px typography floor, empty-state bezel, row-action touch targets — all re-verified live and unregressed.

## Priority Issues

**[P0] Save-state pill still lies after the first Publier — unresolved, unchanged from last critique.** Reproduced live: publishing a brand-new quiz correctly saves (URL gets `?quizId=`, toast fires) but the pill still shows "Modifications non enregistrées" with zero further edits. Confirmed the bug is specific to the *first* save (the reload-triggering navigate branch) — a *second* save on an existing quiz correctly settles to "Enregistré." Root cause unchanged in code.
Fix: guard the dirty-tracking effect against a same-tick reload triggered by `applyLoadedQuiz`.
→ `/impeccable harden`

**[P1] Question delete still has no confirmation or undo — unresolved.** Reproduced live: trash icon removes a question instantly, no dialog, no toast, no undo. The app already has an `AlertDialog` for the lower-stakes, reversible "leave page" case, just not for this higher-stakes, irreversible one.
→ `/impeccable harden`

**[P1] Correct answer still silently pre-selected by default — unresolved.** Reproduced live: new QCM shows "Réponse 1" pre-checked green, new Vrai/Faux shows "Vrai" pre-selected, both before any host input.
→ `/impeccable harden`

**[P2] Drag handle still has no accessible name — unresolved.** Live accessibility tree confirms the control still announces as literal `button "⋮⋮"` to assistive tech, despite the keyboard sensor being wired and its row-neighbors (Dupliquer/Supprimer) correctly exposing names via `title`.
→ `/impeccable audit`

**[P3] Scrim consolidation was incomplete — now fixed during this critique.** The prior pass's code comment claimed the scrim gradient matched across `QuizBuilder.tsx`, `PollSession.tsx`, and `QuizSession.tsx`, but `QuizSession.tsx` — the actual live-session question view, the one surface where legibility matters most — was never touched and still ran a 0.02-opacity-drifted start stop (`.08` vs `.1`). Fixed on the spot: `QuizSession.tsx:144` now matches the other two exactly. `tsc` clean, 324/324 tests pass.

## Persona Red Flags

**Jordan (first-timer)**: would plausibly delete the wrong question while cleaning up a draft with no way back, and separately would publish a quiz where "Réponse 1" is silently the graded-correct answer because the pre-checked green circle went unnoticed before real answer text was typed in.

**Sam (accessibility)**: the keyboard drag sensor is a genuine accessibility investment already made — but a screen-reader user hits a wall at the control itself, which announces as "⋮⋮" with no indication it's draggable or what it does.

## Minor Observations

- 3 console errors on every page load: `[content-migration] failed` from `src/lib/auth.ts:66` — unrelated to this surface's own code, not caused by this session's work, worth a separate look.
- Live overlay scan flagged a `nested-cards` finding not seen in the prior run — likely just a different test scenario (background-media layout this time) rather than a regression; not confirmed either way.
- `tiny-text` (11.5px) still appears elsewhere on the page outside the specific instances already fixed — the broader `flat-type-hierarchy` cleanup (routed to `/impeccable typeset` last time) remains a real, larger task.

## Questions to Consider

- What if the dirty-tracking effect tracked "last persisted snapshot" instead of "any change since mount," so a post-save reload of identical data couldn't retrigger it regardless of which code path caused the reload?
- What if a new question's correct-answer indicator started genuinely unset until the host actively picked one — turning the silent default into a visible, cheap-to-clear checklist item?
- What if delete used the same lightweight toast-with-undo pattern common elsewhere in the product, keeping the one-click speed power users want while removing the irreversibility risk?
