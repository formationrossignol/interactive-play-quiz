-- Spec 04 — Interoperability & identity: admin linking for unrecognized LTI
-- subjects (LTI-005 completion) + diagnostic read access.
--
-- RESTE-A-FAIRE.md §04: "/lti/unlinked est un cul-de-sac réel" because
-- nothing lets an admin actually create the missing external_mappings row.
-- external_mappings has a select-only RLS policy for admins
-- (external_mappings_admin, 20260810180000_interoperability_identity.sql) —
-- no insert/update policy exists at all, by design (the same file gives
-- every other admin-sensitive write in spec 04 its own security-definer
-- RPC: create_integration_secret(), record_lti_launch()). This migration
-- follows that same pattern rather than opening a blanket RLS insert
-- policy, so the mapping write stays auditable (who linked what, when) and
-- constrained (target must already be an org member — an admin can't mint
-- access for an arbitrary uuid outside their own organization's roster).
--
-- lti_registrations/lti_deployments/lti_launches already have adequate
-- admin RLS (`for all` on registrations/deployments, `for select` on
-- launches) — the existing UI just never read/wrote them. No RLS change
-- needed for those three; only the client code (Integrations.tsx) was
-- missing.

create or replace function public.link_lti_subject(
  p_registration_id uuid,
  p_subject text,
  p_internal_user_id uuid
)
returns public.external_mappings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_external_id text;
  v_result public.external_mappings;
begin
  select org_id into v_org_id from public.lti_registrations where id = p_registration_id;
  if v_org_id is null then
    raise exception 'Unknown registration';
  end if;
  if not public.has_org_role(v_org_id, array['admin']) then
    raise exception 'Not an admin of this organization';
  end if;
  if p_subject is null or length(trim(p_subject)) = 0 then
    raise exception 'Subject required';
  end if;
  if not exists (
    select 1 from public.user_org_roles where org_id = v_org_id and user_id = p_internal_user_id
  ) then
    raise exception 'Target user is not a member of this organization';
  end if;

  v_external_id := p_registration_id::text || ':' || p_subject;

  insert into public.external_mappings (org_id, system, object_type, external_id, internal_id, provenance)
  values (
    v_org_id, 'lti', 'user', v_external_id, p_internal_user_id,
    jsonb_build_object('linked_by', auth.uid(), 'linked_at', now())
  )
  on conflict (system, object_type, external_id)
  do update set internal_id = excluded.internal_id, provenance = excluded.provenance, synced_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.link_lti_subject(uuid, text, uuid) from public;
grant execute on function public.link_lti_subject(uuid, text, uuid) to authenticated;
