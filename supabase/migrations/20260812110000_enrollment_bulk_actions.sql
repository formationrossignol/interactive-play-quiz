-- Spec 02 — Inscriptions, sessions et gestion des apprenants
-- (docs/product-specs/2026-08-10-lms-program/02-enrollment-roster.md).
--
-- RESTE-A-FAIRE.md §02: "ENR-015 — UI : actions en masse (inscrire,
-- déplacer, annuler, prolonger — la spec ajoute aussi affecter un formateur,
-- envoyer une relance)."
--
-- Scope, stated explicitly:
--   - "Inscrire" isn't duplicated here — ENR-014 (CSV import, previous
--     migration) already covers adding many learners at once; this pass is
--     about acting on an *existing* roster.
--   - "Annuler" and "déplacer de session" reuse transition_enrollment()/
--     enroll_in_session() as-is (staff-authorized, audited, idempotent
--     already) — no new RPC. A move is withdraw-then-enroll orchestrated
--     client-side, two existing calls, not a new atomic primitive; if the
--     second call fails the learner ends up enrolled nowhere rather than
--     silently duplicated, and that failure is surfaced per-row like
--     ENR-014's import report, not hidden.
--   - "Prolonger" needed a new writer: nothing before this touched
--     enrollments.effective_due_at after creation. extend_enrollment_due_date()
--     below is the first.
--   - "Affecter un formateur" is session-level (session_trainers), not
--     per-enrollment, and already has a direct-insert RLS policy
--     (session_trainers_manage, `for all`) — not really a "bulk action over
--     selected learners" the way the other four are, so not built as part
--     of this roster multi-select UI. Still reste-à-faire as its own
--     small screen.
--   - "Envoyer une relance" needs a decision about what a reminder actually
--     contains (which is really 01/07's scheduled-notifications work, per
--     RESTE-A-FAIRE's own cross-cutting dependency note) — not guessed here.

-- ── extend_enrollment_due_date() : first writer of effective_due_at ────────
-- Audited through the same enrollment_history table as status transitions
-- (ENR-007) rather than a new table just for this — from_status/to_status
-- stay equal (nothing about the *status* changed) and the old/new date is
-- readable in `reason`, one unified audit trail per enrollment instead of two.
create or replace function public.extend_enrollment_due_date(
  p_enrollment_id uuid,
  p_new_due_at timestamptz,
  p_reason text default null
)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment public.enrollments;
  v_result public.enrollments;
  v_note text;
begin
  select * into v_enrollment from public.enrollments where id = p_enrollment_id for update;
  if v_enrollment.id is null then
    raise exception 'Enrollment not found';
  end if;
  if not public.has_org_role(v_enrollment.org_id, array['registrar','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  update public.enrollments set effective_due_at = p_new_due_at where id = p_enrollment_id returning * into v_result;

  v_note := 'Échéance modifiée : ' || coalesce(v_enrollment.effective_due_at::text, '—') || ' -> ' || coalesce(p_new_due_at::text, '—');
  if p_reason is not null and char_length(trim(p_reason)) > 0 then
    v_note := v_note || ' — ' || p_reason;
  end if;

  insert into public.enrollment_history (enrollment_id, from_status, to_status, actor_id, source, reason)
  values (p_enrollment_id, v_enrollment.status, v_enrollment.status, auth.uid(), 'manual', v_note);

  return v_result;
end;
$$;

revoke all on function public.extend_enrollment_due_date(uuid, timestamptz, text) from public;
grant execute on function public.extend_enrollment_due_date(uuid, timestamptz, text) to authenticated;
