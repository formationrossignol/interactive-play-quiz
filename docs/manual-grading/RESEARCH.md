# Manual Grading Research

## Overview

Brivia needs a manual gradebook for activities that are not automatically
scored: assignments, projects, oral exams, practical work, attendance-based
activities, external assessments, and manual corrections.

The MVP covers numeric grades and simple validation, individual and group
grade entry, attendance statuses, drafts, publication, weighted averages, CSV
export, and an immutable change history.

## Problem Statement

Automatic quiz and exam scores do not cover the full assessment workflow.
Teachers need one place to create an assessment, target reusable Brivia
groups, enter results quickly, and decide when learners can see them.

## User Stories / Use Cases

- A teacher creates a `/20` assessment with a coefficient and assigns groups.
- A teacher pastes a column of scores from a spreadsheet into the gradebook.
- An absence is stored separately from a numeric zero.
- A teacher saves drafts, then publishes all completed grades together.
- A published grade can be revised only with a reason and the change is audited.
- A learner sees only their own published grades and weighted average.
- A teacher exports the current assessment as CSV.

## Technical Research

### Existing Integration Points

- `public.groups` and `public.group_members` already model reusable rosters.
- `usernames_by_ids(uuid[])` safely resolves display names without exposing
  `auth.users`.
- `public.content` can optionally link an assessment to an owned Brivia item.
- `public.profiles` currently supports only `user` and `admin`; ownership is
  therefore the MVP teacher/corrector boundary.
- The app already ships TanStack Table, XLSX, reusable table primitives,
  skeletons, dialogs, buttons, notifications, and CSV-compatible browser APIs.

### Approach Options

1. Store gradebook data in local storage.
   - Fast, but breaks multi-device access, RLS, audit, and learner visibility.
2. Store one JSON gradebook document per assessment.
   - Fewer rows, but poor concurrency and unsafe learner-level RLS.
3. Normalize assessments, group assignments, grades, and grade history.
   - Best fit for RLS, optimistic concurrency, reporting, and future APIs.

### Recommended Approach

Use normalized Supabase tables with database-enforced validation and RLS.
All grade writes go through one RPC that:

- verifies assessment ownership/admin rights;
- verifies that the learner belongs to an assigned group;
- validates the scale and attendance state;
- checks an expected row version;
- requires a reason when revising a published grade;
- increments the version and lets an audit trigger record the change.

The React gradebook keeps draft edits locally, saves on blur, supports natural
Tab navigation and multi-line spreadsheet paste, and exposes explicit bulk
publication.

### Data Requirements

- `manual_evaluations`: scale, dates, coefficient, threshold, context, owner.
- `manual_evaluation_groups`: reusable group assignments.
- `manual_grades`: learner result, attendance, comment, workflow state,
  publication timestamp, version, last editor.
- `manual_grade_history`: old/new snapshots, author, timestamp, reason.

## UI/UX Considerations

- A list/detail layout keeps assessment selection and entry in one module.
- Numeric inputs show the denominator beside every row.
- Published rows are visually locked; revision asks for a reason.
- Attendance is explicit and never inferred from an empty score.
- Loading uses the shared skeleton system.
- Native inputs retain reliable keyboard navigation; paste fills consecutive rows.

## Risks and Challenges

- Dynamic groups mean new members appear in an existing gradebook. This is
  intentional for the MVP and avoids duplicating rosters.
- A learner removed from all assigned groups keeps their historical grade, but
  RLS learner access is based on the grade owner id, not current membership.
- Pending email invitations cannot receive a grade until they resolve to a user.
- Full teacher/corrector/responsible roles require a future organization model.
- XLSX import, rubrics, group-shared marks, attachments, disputes, compensation,
  and competency mapping remain V2/V3.

## References

- Supabase Row Level Security documentation.
- TanStack Table editable-data and controlled-state documentation.
- Existing Brivia course-sharing, content, profile, and notification migrations.
