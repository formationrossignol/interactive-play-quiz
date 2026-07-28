# Manual Grading Implementation Plan

## Overview

Build the V1 manual gradebook on the existing Supabase/group architecture.
The database owns authorization, validation, concurrency and audit; the React
module owns fast entry, filtering, publication, summaries and export.

## Prerequisites

- Existing `groups`, `group_members`, `profiles`, `content`, and `is_admin()`.
- Existing Supabase client, app shell, skeletons and table primitives.

## Phase Summary

1. Secure grading data model and pure calculation helpers.
2. Assessment creation and reusable-group targeting.
3. Editable group gradebook, autosave, paste and publication.
4. Learner view, averages, CSV export and navigation.
5. Automated validation and production build.

---

## Phase 1: Data model and audit

### Objective

Create normalized tables, RLS, atomic RPCs, optimistic concurrency and history.

### Tasks

- [x] Add assessment, assignment, grade and history tables.
- [x] Enforce score, attendance and workflow constraints.
- [x] Add owner/admin and learner RLS.
- [x] Add atomic create/save/publish functions.
- [x] Add calculation/validation tests.

### Success Criteria

Invalid scores are rejected, learner reads are publication-scoped, and published
revisions require a reason and generate history.

---

## Phase 2: Assessment creation

### Objective

Let a teacher configure and target a manual assessment.

### Tasks

- [x] Create assessment list/detail page.
- [x] Support numeric and simple-validation scales.
- [x] Configure barème, decimals, coefficient, threshold and dates.
- [x] Select and manage reusable groups.

### Success Criteria

An owner can create an assessment assigned to at least one owned group.

---

## Phase 3: Gradebook entry

### Objective

Provide fast, safe entry for every resolved group member.

### Tasks

- [x] Build keyboard-friendly editable rows.
- [x] Support spreadsheet paste into consecutive grade rows.
- [x] Save on blur with optimistic concurrency.
- [x] Support attendance and appreciation.
- [x] Bulk-publish drafts and revise published grades with a reason.

### Success Criteria

The acceptance criteria for valid scores, zero vs absence, drafts, publication,
locking and history all pass.

---

## Phase 4: Results and export

### Objective

Expose useful summaries to teachers and published results to learners.

### Tasks

- [x] Calculate activity statistics and weighted learner averages.
- [x] Export assessment results as UTF-8 CSV.
- [x] Add a learner-only published-grade view.
- [x] Add routes, sidebar links and translations.

### Success Criteria

Teachers can export results and learners can only see their own published rows.

---

## Phase 5: Verification

### Tasks

- [x] Typecheck.
- [x] Run focused and complete tests.
- [x] Lint.
- [x] Build production assets.
- [x] Confirm the branch diff is isolated from prior feature work.

## Post-Implementation

- V2: rubrics, CSV/XLSX import preview, group marks, attachments, validation workflow.
- V3: disputes, compensation, minutes, external API and advanced analytics.
