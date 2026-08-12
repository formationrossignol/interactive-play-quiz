-- Spec 02 — Inscriptions, sessions et gestion des apprenants
-- (docs/product-specs/2026-08-10-lms-program/02-enrollment-roster.md).
--
-- RESTE-A-FAIRE.md §02: "ENR-014 — UI import CSV/XLSX avec prévisualisation/
-- mapping/doublons." Spec text: "mapping email/identifiant, détection des
-- doublons et rapport téléchargeable."
--
-- enroll_in_session(p_session_id, p_learner_id, p_source) already exists
-- (20260810150000_enrollment_roster.sql), already lets staff enroll someone
-- else (checked against registrar/pedago/admin), is already idempotent
-- (an existing active enrollment is returned as-is, never duplicated) and
-- already handles capacity/waitlist atomically — so importing N rows is just
-- N calls to it from the client, no new bulk-enroll RPC needed here.
--
-- What was actually missing: a way to turn "a column of emails or usernames
-- in a spreadsheet" into learner_ids at all. `enrollments.learner_id`
-- references auth.users directly with no "pending" placeholder (unlike
-- share_group_members.pending_email) — inventing one here would mean
-- designing an invite-on-import flow that's really ENR-013's territory
-- (auto-enrollment/provisioning), not this ticket. So: only identifiers that
-- already resolve to an existing member of the org are matched; anything
-- else is reported as an error row, never silently skipped or invented.
--
-- Scoped to identifiers already belonging to the target org (join through
-- user_org_roles) rather than any platform user — same reasoning as
-- resolve_group_member() before it, but that one only required *any*
-- existing user since group sharing isn't org-scoped; enrollment is.
create or replace function public.resolve_org_members_by_identifier(
  p_org_id uuid,
  p_kind text,
  p_identifiers text[]
)
returns table(identifier text, learner_id uuid, username text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_org_role(p_org_id, array['registrar','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  if p_kind = 'email' then
    return query
      select raw.val, u.id, p.username
      from unnest(p_identifiers) as raw(val)
      join auth.users u on lower(u.email) = lower(trim(raw.val))
      left join public.profiles p on p.id = u.id
      where exists (select 1 from public.user_org_roles r where r.user_id = u.id and r.org_id = p_org_id);
  elsif p_kind = 'username' then
    return query
      select raw.val, p.id, p.username
      from unnest(p_identifiers) as raw(val)
      join public.profiles p on lower(p.username) = lower(trim(leading '@' from trim(raw.val)))
      where exists (select 1 from public.user_org_roles r where r.user_id = p.id and r.org_id = p_org_id);
  else
    raise exception 'invalid_kind: %', p_kind;
  end if;
end;
$$;

revoke all on function public.resolve_org_members_by_identifier(uuid, text, text[]) from public;
grant execute on function public.resolve_org_members_by_identifier(uuid, text, text[]) to authenticated;
