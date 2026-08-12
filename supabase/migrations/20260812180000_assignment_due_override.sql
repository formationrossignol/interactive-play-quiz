-- Spec 01 — Devoirs, remises et carnet de notes
-- (docs/product-specs/2026-08-10-lms-program/01-assignments-gradebook.md).
--
-- RESTE-A-FAIRE.md §01: "UI : échéance/aménagement dérogatoire par apprenant
-- (due_override) — colonne existe, aucun écran." The column
-- (assignment_targets.due_override, 20260810160000) and its consumer
-- (effective_assignment_due_at(), 20260811040000 — composes it with
-- accommodations, already correctly wired into submit_assignment()'s
-- lateness check and generate_risk_signals()'s overdue rule) have existed
-- since spec 06/accommodation work landed. Only the screen was missing.
--
-- What's needed to build that screen safely: assignment_targets has no
-- uniqueness constraint today, so a naive client-side "insert a
-- target_type='learner' row to set an override" can't safely be re-run
-- (re-opening the screen and resubmitting would duplicate the target row
-- rather than update it — assignment_visible_to_learner() and
-- effective_assignment_due_at() would still work correctly by accident
-- since both use exists()/limit 1, but the duplication itself is a latent
-- data-integrity gap worth closing before building the first UI that
-- writes these rows repeatedly). Only one row is ever expected per
-- (assignment, target) — addAssignmentTarget() already assumes this
-- (called once per session-target in the existing "target and publish"
-- flow) even though nothing enforced it until now.
--
-- No new RPC: assignment_targets_manage (20260810160000) already lets the
-- assignment's owner (trainer) or org pedago/admin insert/update/delete
-- rows directly — same posture addAssignmentTarget() already relies on.
-- The UI upserts on this constraint (onConflict:
-- 'assignment_id,target_type,target_id') and deletes the row to clear an
-- override, exactly like a plain RLS-gated table write everywhere else in
-- this file's migration history that didn't need an audit trail.

-- De-dup any pre-existing duplicate (assignment_id, target_type, target_id)
-- rows before the constraint can be added — keeps the most recent row
-- (highest id) per group. In practice only ever populated by
-- addAssignmentTarget()'s single "target by session" call site so far, but
-- cheap insurance regardless.
delete from public.assignment_targets a using public.assignment_targets b
where a.id < b.id
  and a.assignment_id = b.assignment_id
  and a.target_type = b.target_type
  and a.target_id = b.target_id;

alter table public.assignment_targets
  add constraint assignment_targets_assignment_target_uniq unique (assignment_id, target_type, target_id);
