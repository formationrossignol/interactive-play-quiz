-- Spec 01 — Devoirs, remises et carnet de notes
-- (docs/product-specs/2026-08-10-lms-program/01-assignments-gradebook.md).
--
-- RESTE-A-FAIRE.md §01: "Connecteur antiplagiat (interface only —
-- non-objectif V1 explicite, mais l'interface elle-même n'existe pas)."
-- The spec itself scopes this: an automated vendor connector (Turnitin/
-- Compilatio/etc.) is explicitly not a V1 goal — only the interface staff
-- would use around a check is missing. So this adds no vendor integration
-- (nothing to call, no API key, no marketplace provider): staff record the
-- outcome of a check they ran through whatever external tool they already
-- use outside this system, same posture as a manual grade override.
--
-- No direct staff write policy exists on submissions at all today (only
-- submissions_owner/submissions_staff_read select policies — every mutation
-- goes through a security-definer RPC: submit_assignment(),
-- publish_submission_grade(), etc.). set_plagiarism_check() follows that
-- same convention rather than opening a new direct-write policy.

alter table public.submissions
  add column plagiarism_check_status text not null default 'not_requested'
    check (plagiarism_check_status in ('not_requested', 'pending', 'reviewed')),
  add column plagiarism_check_note text,
  add column plagiarism_checked_by uuid references auth.users(id),
  add column plagiarism_checked_at timestamptz;

create or replace function public.set_plagiarism_check(
  p_submission_id uuid,
  p_status text,
  p_note text default null
)
returns public.submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.submissions;
begin
  if p_status not in ('not_requested', 'pending', 'reviewed') then
    raise exception 'invalid_status: %', p_status;
  end if;

  if not exists (
    select 1 from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    where s.id = p_submission_id and public.has_org_role(a.org_id, array['trainer','pedago','admin'])
  ) then
    raise exception 'Not authorized';
  end if;

  update public.submissions
  set plagiarism_check_status = p_status,
      plagiarism_check_note = p_note,
      plagiarism_checked_by = auth.uid(),
      plagiarism_checked_at = now()
  where id = p_submission_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.set_plagiarism_check(uuid, text, text) from public;
grant execute on function public.set_plagiarism_check(uuid, text, text) to authenticated;
