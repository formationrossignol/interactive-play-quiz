# Remaining work — UX audit + live visual bugs

**Date:** 2026-07-26
**Context:** follow-up to `2026-07-26-ux-design-spec-audit.md` (P0–P3 shipped on `fix/ux-audit-p0`, pushed). This doc tracks what's still open: roadmap leftovers + real bugs the user found by actually using the deployed app (first real visual feedback this session — no browser access was available while building P0–P3, so these are exactly the kind of thing that slipped through build-only verification).

---

## 1. Roadmap leftovers (skipped by choice, not oversight)

| Item | Why skipped | Effort to pick up |
|---|---|---|
| AppSidebar nav re-grouping by workflow (Create/Run/Review/Library instead of content-type) | User deferred when asked — most disruptive IA change in the whole roadmap | Medium-large; needs its own design pass, not a quick edit |
| Storybook / component docs | Separate tooling initiative (new deps, config, stories per component), not "polish" | Large; own project |
| 169 `eslint-plugin-jsx-a11y` warnings across the app | Plugin added in P3 as warnings-only so violations get visibility; fixing all of them was explicitly out of scope for that pass | Small-per-item, large in aggregate — mostly `label-has-associated-control` (plain `<label>` + sibling input, no `htmlFor`/`id`) and `click-events-have-key-events`/`no-static-element-interactions` (divs with `onClick` acting as buttons) |

Run `cd apps/app && npx eslint .` to see the current list.

---

## 2. Visual bugs found via live testing (2026-07-26)

None of these were visible from code alone — found by the user actually clicking through the deployed app. Each entry has the exact file/line and a concrete fix, not just a description.

### 2.1 Icon library inconsistency — exams (3 screenshots)

Three different exam-related screens use three different icon styles for what should be the same visual language (REQ-ICO-001: one icon library, consistently).

- **`ExamAdmin.tsx` is entirely emoji-based**, unlike the rest of the app (lucide-react). No `lucide-react` import in the file at all.
  - `StatCard` calls: lines 265, 266, 268, 274, 279 — `icon="👤"`, `"✅"`, `"🏆"`, `"📊"`, `"⏱️"`.
  - Meta row: lines 292–296 — `📅`, `⏱️`, `🔄`, `🏆`, `❓` inline in JSX text.
  - Also: line 380 `📊 Analyse par question`, line 653 `💾 {…} sauvegardes auto`.
  - **Fix:** replace every emoji with the matching lucide icon (`Users`/`User`, `CheckCircle2`, `Trophy`, `BarChart2`, `Timer`/`Clock`, `RotateCcw`, `HelpCircle`, `Save`), sized/colored like the rest of the app's meta rows (e.g. `ExamAdmin.tsx`'s own `renderMeta` pattern already used elsewhere, or `GenericItem.tsx`'s icon treatment). `StatCard`'s `icon` prop type changes from `string` to a lucide component.

- **`FolderExplorer.tsx:444`** — the root "Tous les X" row renders a raw `📁` emoji (`<span aria-hidden>📁</span>`), while every other row in the exact same component (lines 299/301) uses the lucide `Folder`/`FolderOpen` icon with proper sizing/color (`isCurrent ? 'var(--ap-brand)' : 'var(--ap-muted)'`).
  - **Fix:** one-line swap — replace the emoji span with `<FolderOpen style={{ width: 15, height: 15, flexShrink: 0, color: isCurrent ? 'var(--ap-brand)' : 'var(--ap-muted)' }} />` (or plain `Folder`, matching the closed-state icon used for non-current sub-folders). `FolderOpen`/`Folder` are already imported in this file.

- The exam **card** itself (`MyExams.tsx`'s `ExamCard`, `ClipboardCheck` in a colored header block) already matches the lucide-icon convention used by `GenericItem.tsx`'s other content-type cards — not a bug, kept as the reference for what "right" looks like.

### 2.2 Border-radius inconsistency — question editor Points/Time segmented controls

`QuizBuilder.tsx` lines 1004–1053: the "Points" (Standard/Double/Sans pts) and "Temps de réponse" (10 s/20 s/30 s/60 s) segmented controls use **identical** CSS (`borderRadius: "var(--ap-r-md)"` outer, `9px` inner button radius, same padding) — the radius *values* aren't actually different in code.

What's likely happening: the two option sets have different label lengths ("Sans pts" vs "10 s"), so the buttons end up with different aspect ratios. A fixed `9px` corner radius reads as a near-full pill on the narrower "10 s"-style buttons and as a subtler rounded-rect on the wider "Sans pts"-style buttons — same radius, different perceived roundedness. This needs a live browser pass to confirm and tune (not a blind code fix): options are (a) a proportional radius (`border-radius: 50%` won't work for rectangles, but something like `min(9px, 50%)` or a slightly smaller fixed value), or (b) force both button sets to a shared min-width so aspect ratios — and therefore perceived roundedness — match.

### 2.3 Tools library cards have no header image

`ToolsLibrary.tsx` (`TOOLS` array + card render, lines 17–73): cards currently show only a small 44×44 icon-in-a-square (`ap-tile__icon`), no header banner — unlike every content-type card (`GenericItem.tsx`'s `GenericCard`), which has a full-width `h-40` header block (either a real cover image, or — when there's no image, which is the common case — a colored gradient background with a large centered icon).

**Fix:** give each `ToolCard` the same no-cover-image header pattern already used by `GenericCard` (`relative h-40 w-full` block, `background: color-mix(in srgb, var(${accent}) 14%, var(--ap-paper-2))`, large centered icon) instead of the current small icon chip. No new image assets needed — this reuses an existing, already-consistent pattern rather than requiring real illustrations per tool.

### 2.4 Excessive rounding in GlobalSearch dropdown results

`GlobalSearch.tsx` — the results panel (`role="listbox"`) uses `borderRadius: "var(--ap-r-lg)"` (the same large radius used for full cards/modals) **and** `overflow: "hidden"`. Individual result rows have no radius of their own, but because the panel clips its children to its own (generous) corner radius, whichever row's highlighted background touches the panel edge — typically the last row — visually "inherits" that large rounding at its corners. Same mechanism as 2.2: not a wrong value being set on the row, but a container radius that's too generous for a dense list, made visible by the highlight background getting clipped.

**Fix:** drop the panel's radius from `var(--ap-r-lg)` to something sized for a compact list (`var(--ap-r-md)` or smaller) — same file, the `role="listbox"` div's inline `style`.

---

## Suggested next step

Items 2.1 and 2.3 are precise, low-risk, ready to implement as-is. 2.2 and 2.4 need a real browser open (this session still has none) to confirm the diagnosis before touching values — tune-by-eye, not blind.
