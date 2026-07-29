# Manual Grading Progress

## Status: Complete

## Quick Reference

- Research: `docs/manual-grading/RESEARCH.md`
- Implementation: `docs/manual-grading/IMPLEMENTATION.md`

## Phase Progress

### Phase 1: Data model and audit

**Status:** Completed

#### Tasks Completed

- Architecture and authorization boundaries defined.
- Supabase schema, RLS, write RPCs, optimistic versioning and audit trigger added.
- Numeric validation, attendance semantics, statistics, weighting and CSV tests added.

#### Decisions Made

- Reuse `groups` and `group_members`; do not create a parallel roster.
- Assessment ownership is the teacher/corrector boundary for V1.
- Database RPCs enforce validation, version checks, and published-revision reasons.
- Dynamic group membership is intentional in V1.

#### Blockers

- None.

### Phase 2: Assessment creation

**Status:** Completed

- Creation dialog supports numeric/validation scales, barème, precision,
  threshold, coefficient, dates, linked content/context and reusable groups.
- Groups and members can be created/expanded without leaving the workflow.

### Phase 3: Gradebook entry

**Status:** Completed

- Keyboard-friendly table, multi-line paste, blur autosave, filters and sorting.
- Explicit attendance statuses separate absence from zero.
- Individual/bulk publication and reasoned published revisions.
- Teacher-visible audit history.

### Phase 4: Results and export

**Status:** Completed

- Activity statistics and coefficient-weighted learner average.
- Formula-safe UTF-8 CSV export.
- Learner page restricted to published own grades.
- Internal notification trigger, routes, sidebar and translations.

### Phase 5: Verification

**Status:** Completed

- Typecheck passes.
- Focused calculation tests pass (9 tests).
- ESLint passes.
- Full suite passes: 44 files, 265 tests.
- Production build passes.
- Feature branch is based directly on `origin/main` and contains no signature-module commit.

## Session Log

### 2026-07-29

- Created an independent branch from `origin/main`.
- Audited group, profile, content, exam, notification and table patterns.
- Defined the MVP boundary from the supplied V1/V2/V3 specification.
- Implemented phases 1–4.
- Verified TypeScript, focused tests and lint.
- Verified the full test suite and production build.

## Files Changed

- `docs/manual-grading/*`
- `supabase/migrations/20260729120000_manual_grading.sql`
- `apps/app/src/lib/grading/*`
- `apps/app/src/components/grading/*`
- `apps/app/src/pages/ManualGrading.tsx`
- `apps/app/src/pages/MyGrades.tsx`
- Application routing, sidebar and translations.

## Architectural Decisions

- Normalized grade rows are required for per-learner RLS and concurrency.
- Attendance and score are separate fields; an absence is never a numeric zero.
- Published grades remain revisable through an audited RPC, not direct updates.

## Lessons Learned

- The existing profile role model is not yet an organization/teaching-role model;
  the MVP must not pretend otherwise.
