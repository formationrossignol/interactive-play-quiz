-- Spec 02 — Inscriptions, sessions et gestion des apprenants
-- (docs/product-specs/2026-08-10-lms-program/02-enrollment-roster.md).
--
-- ENR-013 : auto-inscription avec règles (domaine email, code, approbation,
-- prérequis). `course_sessions.enrollment_policy jsonb` existe depuis
-- 20260810150000 mais n'était écrit ni lu nulle part.
--
-- Shape retenue pour `enrollment_policy` (safe à exposer publiquement — lu
-- par `course_sessions_org_read`/`_public_read`, donc rien de secret ici) :
--   { mode: 'open'|'approval'|'closed'|'payment',
--     email_domains?: string[],       -- ex. ["acme.com"], comparaison insensible casse
--     requires_code?: boolean,        -- le code lui-même vit ailleurs (voir plus bas)
--     prerequisite?: { source, ... } }  -- une feuille evaluate_rule_definition() (pas un groupe AND/OR — voir Sessions.tsx)
--
-- 'payment' est un mode valide reconnu mais explicitement refusé par
-- self_enroll_in_session() (`payment_required_not_implemented`) — brancher un
-- vrai paiement ré-utiliserait le pattern quiz_purchases (RPC service-role +
-- webhook Stripe), un chantier à part, pas deviné ici (même posture que
-- `pool_sections_not_supported` en spec 08).
--
-- Le code d'invitation ne peut PAS vivre dans `enrollment_policy` : cette
-- colonne est lisible par n'importe quel visiteur anonyme via
-- `course_sessions_public_read` dès qu'une offre est publique — un code livré
-- en clair dans le même payload que ce que la page annonce publiquement ne
-- protégerait rien. Table dédiée, lecture staff uniquement, jamais renvoyée
-- au client — seule `self_enroll_in_session()` (security definer) la lit
-- pour comparer.
create table public.session_enrollment_codes (
  session_id uuid primary key references public.course_sessions(id) on delete cascade,
  code       text not null check (char_length(trim(code)) between 3 and 64),
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger session_enrollment_codes_touch before update on public.session_enrollment_codes
  for each row execute function public.touch_updated_at();

alter table public.session_enrollment_codes enable row level security;

-- Staff-only in both directions: no learner/public read policy at all, so
-- the value never reaches a client bundle even by accident.
create policy session_enrollment_codes_manage on public.session_enrollment_codes
  for all using (
    exists (select 1 from public.course_sessions s where s.id = session_id and public.has_org_role(s.org_id, array['registrar','pedago','admin']))
  )
  with check (
    exists (select 1 from public.course_sessions s where s.id = session_id and public.has_org_role(s.org_id, array['registrar','pedago','admin']))
  );

-- ── self_enroll_in_session() : the learner-facing gate ──────────────────────
-- Composes every ENR-013 rule in a fixed order, then delegates the actual
-- seat/waitlist arithmetic to the existing enroll_in_session() (same
-- transaction, same session row already locked here — re-acquiring a row
-- lock already held by the current transaction is a no-op in Postgres, not a
-- deadlock) rather than duplicating its capacity logic.
create or replace function public.self_enroll_in_session(
  p_session_id uuid,
  p_invite_code text default null
)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session  public.course_sessions;
  v_policy   jsonb;
  v_mode     text;
  v_email    text;
  v_domain   text;
  v_domains  text[];
  v_code_row public.session_enrollment_codes;
  v_result   public.enrollments;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_session from public.course_sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception 'Session not found';
  end if;
  if v_session.status not in ('published','in_progress') then
    raise exception 'session_not_open';
  end if;
  if not public.has_org_role(v_session.org_id, array['learner','trainer','pedago','registrar','admin']) then
    raise exception 'not_org_member';
  end if;
  if exists (
    select 1 from public.enrollments
    where session_id = p_session_id and learner_id = auth.uid()
      and status in ('active','pending','waitlisted','invited')
  ) then
    raise exception 'already_enrolled';
  end if;

  v_policy := coalesce(v_session.enrollment_policy, '{}'::jsonb);
  v_mode := coalesce(v_policy->>'mode', 'open');

  if v_mode = 'closed' then
    raise exception 'self_enrollment_closed';
  end if;
  if v_mode = 'payment' then
    raise exception 'payment_required_not_implemented';
  end if;

  if jsonb_typeof(v_policy->'email_domains') = 'array' and jsonb_array_length(v_policy->'email_domains') > 0 then
    select email into v_email from auth.users where id = auth.uid();
    v_domain := lower(split_part(coalesce(v_email, ''), '@', 2));
    select array_agg(lower(x)) into v_domains from jsonb_array_elements_text(v_policy->'email_domains') x;
    if v_domain = '' or v_domain is null or not (v_domain = any(v_domains)) then
      raise exception 'email_domain_not_allowed';
    end if;
  end if;

  if coalesce((v_policy->>'requires_code')::boolean, false) then
    select * into v_code_row from public.session_enrollment_codes where session_id = p_session_id;
    if v_code_row.session_id is null or p_invite_code is null or v_code_row.code <> p_invite_code then
      raise exception 'invalid_invite_code';
    end if;
  end if;

  if jsonb_typeof(v_policy->'prerequisite') = 'object' then
    if not public.evaluate_rule_definition(v_policy->'prerequisite', auth.uid()) then
      raise exception 'prerequisite_not_met';
    end if;
  end if;

  if v_mode = 'approval' then
    insert into public.enrollments (org_id, session_id, learner_id, status, source)
    values (v_session.org_id, p_session_id, auth.uid(), 'pending', 'self')
    returning * into v_result;
    insert into public.enrollment_history (enrollment_id, from_status, to_status, actor_id, source, reason)
    values (v_result.id, null, 'pending', auth.uid(), 'self', 'self_enroll_awaiting_approval');
    perform public.emit_learning_event('enrollment.pending_review', v_session.org_id, auth.uid(), 'enrollment', v_result.id, jsonb_build_object('session_id', p_session_id));
    return v_result;
  end if;

  return public.enroll_in_session(p_session_id, auth.uid(), 'self');
end;
$$;

revoke all on function public.self_enroll_in_session(uuid, text) from public;
grant execute on function public.self_enroll_in_session(uuid, text) to authenticated;

-- ── resolve_pending_enrollment() : staff approves/rejects an ENR-013 request ─
-- transition_enrollment() deliberately doesn't accept 'pending' as a target
-- (it's not a status staff should ever manually assign) and never rechecks
-- capacity on 'active' — fine for its existing callers (withdraw/cancel/
-- complete), not fine here where an approval racing a full session must not
-- silently oversubscribe. Mirrors enroll_in_session()'s own active/waitlist
-- branch rather than reusing transition_enrollment() for the approve leg.
create or replace function public.resolve_pending_enrollment(
  p_enrollment_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment public.enrollments;
  v_session public.course_sessions;
  v_active_count integer;
  v_next_position integer;
  v_result public.enrollments;
begin
  select * into v_enrollment from public.enrollments where id = p_enrollment_id for update;
  if v_enrollment.id is null then
    raise exception 'Enrollment not found';
  end if;
  if not public.has_org_role(v_enrollment.org_id, array['registrar','pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  if v_enrollment.status <> 'pending' then
    raise exception 'not_pending';
  end if;

  if not p_approve then
    update public.enrollments set status = 'cancelled' where id = p_enrollment_id returning * into v_result;
    insert into public.enrollment_history (enrollment_id, from_status, to_status, actor_id, source, reason)
    values (p_enrollment_id, 'pending', 'cancelled', auth.uid(), 'manual', coalesce(p_reason, 'approval_rejected'));
    return v_result;
  end if;

  select * into v_session from public.course_sessions where id = v_enrollment.session_id for update;
  select count(*) into v_active_count from public.enrollments where session_id = v_enrollment.session_id and status = 'active';

  if v_session.capacity is null or v_active_count < v_session.capacity then
    update public.enrollments set status = 'active' where id = p_enrollment_id returning * into v_result;
    insert into public.enrollment_history (enrollment_id, from_status, to_status, actor_id, source, reason)
    values (p_enrollment_id, 'pending', 'active', auth.uid(), 'manual', coalesce(p_reason, 'approved'));
    perform public.emit_learning_event('enrollment.started', v_session.org_id, v_enrollment.learner_id, 'enrollment', p_enrollment_id, jsonb_build_object('session_id', v_enrollment.session_id, 'source', 'self'));
  else
    update public.enrollments set status = 'waitlisted' where id = p_enrollment_id returning * into v_result;
    insert into public.enrollment_history (enrollment_id, from_status, to_status, actor_id, source, reason)
    values (p_enrollment_id, 'pending', 'waitlisted', auth.uid(), 'manual', coalesce(p_reason, 'approved_capacity_full'));
    select coalesce(max(position), 0) + 1 into v_next_position from public.waitlist_entries where session_id = v_enrollment.session_id;
    insert into public.waitlist_entries (session_id, learner_id, position, status)
    values (v_enrollment.session_id, v_enrollment.learner_id, v_next_position, 'waiting');
    perform public.emit_learning_event('enrollment.waitlisted', v_session.org_id, v_enrollment.learner_id, 'enrollment', p_enrollment_id, jsonb_build_object('session_id', v_enrollment.session_id, 'position', v_next_position));
  end if;

  return v_result;
end;
$$;

revoke all on function public.resolve_pending_enrollment(uuid, boolean, text) from public;
grant execute on function public.resolve_pending_enrollment(uuid, boolean, text) to authenticated;

-- ── set_session_invite_code() : staff sets/clears the code, never reads it back
-- to a learner. No RPC needed to *read* it (session_enrollment_codes has no
-- learner-facing select policy at all); a plain upsert would also work given
-- session_enrollment_codes_manage already allows direct staff writes, but a
-- thin RPC keeps "clear the code" (mode switched back to no-code) a single
-- call instead of a client-side delete-or-upsert branch.
create or replace function public.set_session_invite_code(
  p_session_id uuid,
  p_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from public.course_sessions where id = p_session_id;
  if v_org_id is null then
    raise exception 'Session not found';
  end if;
  if not public.has_org_role(v_org_id, array['registrar','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  if p_code is null or trim(p_code) = '' then
    delete from public.session_enrollment_codes where session_id = p_session_id;
    return;
  end if;

  insert into public.session_enrollment_codes (session_id, code, created_by)
  values (p_session_id, trim(p_code), auth.uid())
  on conflict (session_id) do update set code = excluded.code, updated_at = now();
end;
$$;

revoke all on function public.set_session_invite_code(uuid, text) from public;
grant execute on function public.set_session_invite_code(uuid, text) to authenticated;
