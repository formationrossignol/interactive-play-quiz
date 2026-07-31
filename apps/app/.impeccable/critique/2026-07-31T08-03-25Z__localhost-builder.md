---
target: "http://localhost:8080/builder"
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-07-31T08-03-25Z
slug: localhost-builder
---
Method: dual-agent (A: ab5e84bbc390dd611 · B: adbd53237efe7f93d)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Save-state pill falsely reverts to "Modifications non enregistrées" right after a successful Publier/Mettre à jour and never self-corrects |
| 2 | Match System / Real World | 3 | Natural French copy, host-familiar mental models (QCM/Vrai-Faux) |
| 3 | User Control and Freedom | 2 | "Leave without saving" guard exists; zero undo for the far more common single-question delete |
| 4 | Consistency and Standards | 3 | Coherent shape/shadow/pill vocabulary; Points uses ink-black for "active," Time uses brand-purple for the same semantic |
| 5 | Error Prevention | 1 | Instant confirmation-free question delete; correct answer silently pre-selected by default with no host confirmation |
| 6 | Recognition Rather Than Recall | 3 | Type-icon+color coding; hover-preview swaps the right rail to a live example of the hovered type |
| 7 | Flexibility and Efficiency | 2 | Drag reorder + duplicate + question-bank import exist; no bulk select/delete for 20+ question quizzes |
| 8 | Aesthetic and Minimalist Design | 3 | One question in view at a time; sticker-shadow applied to nearly every control dilutes its own "interactive" signal |
| 9 | Error Recovery | 2 | Title-required error is precise and well-targeted; the false "unsaved" state actively misleads |
| 10 | Help and Documentation | 1 | No contextual help/onboarding beyond the type-hover preview |
| **Total** | | **21/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment**: Strongly specific where it counts — the shape+color answer system (triangle/circle/square/diamond) is lifted directly from the real player screen and reused consistently across rail, editor, and phone mirror; the live "miroir en direct" preview that updates on every keystroke is the standout, unmistakably-this-product idea. Large scaffolding sections (Settings dialog, tag management, category picker, question-type dropdown) are fairly generic SaaS-builder patterns any content tool could ship. Net: specific at the core (live-session identity), generic in the surrounding chrome.

**Deterministic scan**: `detect.mjs` found 6 findings scoped to `QuizBuilder.tsx` — `design-system-radius` (2, the phone-mockup notch's 13px corner), `design-system-color` (3, two gradient-overlay rgba stops + one image-delete-button overlay), `design-system-font-size` (1, a 0.65rem palette-chip label). Small in count but the same untokenized-value pattern already tracked as a P2 backlog item app-wide (routed to `/impeccable extract`).

**Browser overlay**: injected on both an empty quiz and one populated with 3 real questions — the two scans diverge meaningfully. Empty state: 1 rule group (shell-level, see below). Populated state: 7 rule groups, adding `undersized-ui-text` (10.5px on the "QCM" rail badge and the player-preview "brivia" watermark — both under the 11px floor) and `flat-type-hierarchy` (the type-size spread widens from a 1.4:1 to a 1.7:1 ratio as real content fills in) — a genuine typography-scale issue the static scan alone wouldn't have caught, since it only appears once real content is present. The shell-level findings present on both scans (`bounce-easing`, `side-tab`, `pulsing-dot`, `marquee`, `dark-glow`) are **not counted as defects here**: `/builder` intentionally renders the app's default Arcade Pop theme (this session's earlier decision force-applies Material 3 to correction/admin/dashboard routes only, explicitly excluding the builder), so elastic easing and playful accents are the correct register on this route, not drift.

## Overall Impression

The builder's best idea — a live, pixel-accurate phone mirror of what players will see — genuinely earns the "impeccable" bar and clearly informed how the answer-shape system was built. But two trust-critical moments are broken or unguarded: the save confirmation lies right when a host most needs to trust it (about to run a live session), and a wrong answer key can silently go live because "correct" is pre-checked by default. A prior session's layout fixes (topbar overlap, spacing rhythm, rail scroll, empty-state phone bezel, touch targets) all verified live and hold up — genuinely resolved, not just claimed.

## What's Working

1. **Live phone mirror ("Vue joueur — miroir en direct")** — instant, pixel-accurate, verified live across a plain QCM, a True/False, and a 300+-character stress-test question with clean auto-grow and reflow.
2. **Question-type hover preview** — hovering a type in the dropdown swaps the right-rail mirror to a live example of that type, turning an abstract picker into a try-before-you-commit moment.
3. **The 5 fixes from the prior layout pass all hold live**: topbar overlap (clean 1000-1100px, title truncates gracefully), spacing rhythm (8/20/32px verified across sections), rail auto-scroll on new question, empty-state phone bezel/notch persisting, and row-action touch targets with visible focus-visible rings on Tab.

## Priority Issues

**[P0] Save indicator lies after a successful publish**
Why: After Publier/Mettre à jour, the URL correctly updates to `?quizId=...` (save succeeded) but the topbar pill reverts to and stays on "Modifications non enregistrées" — verified live, persisted 2+ seconds, never self-corrected. Root cause: `handleSaveQuiz` navigates to `/builder?quizId=X`, re-triggering the "load existing quiz" effect → `applyLoadedQuiz` → `setQuestions()` with a fresh array reference → which re-triggers the separate dirty-tracking effect that unconditionally flips `saveState` to "unsaved" on any `questions` change, including the reload of the data it just saved. This is the exact moment (about to run a live session with real players) the product most needs to be trustworthy.
Fix: guard the dirty-tracking effect against changes originating from `applyLoadedQuiz` (a ref flag), or avoid re-running the load effect from the save-triggered navigate.
Suggested command: `/impeccable harden`

**[P1] Question delete has zero confirmation or undo**
Why: The rail row's trash icon deletes a question instantly — no dialog, no undo toast — verified live. The codebase already has an `AlertDialog` pattern for the lower-stakes "leave page" warning but not for this actually-destructive, actually-common action. The prior fix pass correctly enlarged this exact hit target for touch accessibility, which — paired with no safety net — makes the irreversible action easier to trigger by accident.
Fix: add an undo toast (existing `sonner` pattern used elsewhere in the file) or route non-trivial deletes through the existing `AlertDialog`.
Suggested command: `/impeccable harden`

**[P1] Correct answer silently pre-selected by default**
Why: New QCM questions default `correctAnswer: 0` ("Réponse 1" pre-checked); new True/False questions default to "Vrai" pre-selected — both verified live, both showing the "correct" affordance before the host has made any real choice. A host filling in answer text without noticing the pre-existing checkmark can publish a quiz with a wrong scoring key, surfacing live in front of players — directly against PRODUCT.md's "verifiable result" positioning.
Fix: no default correct answer; require an explicit host action before a question counts as complete (a subtle warning state on the rail item otherwise).
Suggested command: `/impeccable harden`

**[P2] Typography scale drifts as real content fills in**
Why: Detector found `undersized-ui-text` (10.5px on the "QCM" rail badge and the "brivia" player-preview watermark, both under the 11px floor) and `flat-type-hierarchy` (size spread widens from 1.4:1 to 1.7:1 once 3 real questions are added) — only visible on the populated-state scan, not the empty one.
Fix: raise the two 10.5px instances to the 11px floor; audit the full size list for consolidation opportunities.
Suggested command: `/impeccable typeset`

**[P2] Drag handle has no accessible name**
Why: The rail item's reorder handle's only accessible content is the literal glyph "⋮⋮" — no `aria-label` — so a screen reader announces raw punctuation instead of "Réorganiser," even though dnd-kit's `KeyboardSensor`/`sortableKeyboardCoordinates` is genuinely wired up in code. A keyboard/screen-reader user has no way to discover that keyboard reordering exists.
Fix: add `aria-label="Réorganiser la question"` to the drag-handle button.
Suggested command: `/impeccable audit`

## Persona Red Flags

**Riley (stress tester)**: building a real 3-question quiz surfaced three failures firsthand — (1) the trash icon deleted a fully-authored question in one click with no confirmation, fully reproducing the classic accidental-rapid-click scenario; (2) both new-question defaults left a wrong-looking-right answer pre-armed, easy to miss moving fast; (3) after Publier, zero reliable confirmation — the save pill says the opposite of what happened, so a fast host would plausibly re-click Publish repeatedly or distrust a properly-saved quiz. The long-question stress test itself held up fine — clean auto-grow, no truncation, mirror reflows correctly.

**Sam (accessibility-dependent)**: "Dupliquer" and "Supprimer" have real accessible names via `title`, and Tab-focus lands on them with a visible ring — the claimed touch-target fix genuinely holds. But the drag handle's screen-reader announcement is raw punctuation (see P2 above), and because delete has no confirmation, a Sam who tabs to "Supprimer" and presses Enter gets the exact same unrecoverable deletion as a mouse click — accessible parity for a bad interaction is still a bad interaction.

## Minor Observations

- Rail row actions (duplicate/delete) stay opacity-0 until hover/focus — fine for discoverability via hover, but a first scan of the rail gives no visual cue those controls exist at all.
- Points segment (active = ink-black fill) and Time segment (active = brand-purple fill) use different accent colors for the identical "selected" semantic on two adjacent, identically-shaped controls.
- "Aperçu" button, when disabled (0 questions), has no visibly-disabled styling beyond the tooltip explaining why.
- Settings dialog is one long undifferentiated scroll (category → description → image → tags → 4 toggles → transition time → theme → ambiance → font) — could reuse the uppercase section-label pattern already used in the question editor.
- Two unbounded decisions front-load a new question before any content exists: the type dropdown lists 7-8 flat, ungrouped options, and the layout picker directly below offers 5 more — worth default-collapsing the layout picker or grouping types by family for first-timers.
- Shell-level detector findings (bounce-easing, side-tab stripe, pulsing dot, marquee, dark-glow) confirmed present but correctly exempted — `/builder` intentionally keeps the Arcade Pop register per the current theme-enforcement architecture; not a defect on this route.

## Questions to Consider

- What if the save-state pill were removed entirely in favor of disabling "Publier" itself the instant there's nothing new to persist — rather than running a second, independent "is it dirty" state machine that can (and did) drift out of sync with what's actually saved?
- What if a question simply couldn't leave "in progress" (a small dot/badge on its rail item) until a host explicitly tapped a correct answer — turning a silent scoring trap into a visible, cheap-to-clear checklist item?
- What if the phone mirror — clearly this builder's best idea — also mirrored destructive actions (a quick "this question is now gone from what players see" flash on delete), making the mirror itself the confirmation UI instead of a bolted-on generic dialog?
