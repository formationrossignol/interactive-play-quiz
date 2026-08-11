-- Spec 02 — Inscriptions, sessions et gestion des apprenants
-- (docs/product-specs/2026-08-10-lms-program/02-enrollment-roster.md).
--
-- ENR-011/012: "Promotion automatique de la liste d'attente + expiration
-- d'offre" — waitlist_entries had a `status` enum already shaped for this
-- (waiting/offered/expired/accepted/declined) but nothing ever moved a row
-- through it. No scheduler exists anywhere in this repo (same constraint
-- noted across specs 04/05/07 this session), so promotion is event-driven —
-- fired from transition_enrollment() the instant an active seat frees up —
-- and offer expiry is swept lazily at the top of promote_waitlist() rather
-- than by a cron. A promoted learner gets an *offer*, not an automatic
-- enrollment: they still have to accept_waitlist_offer() themselves, same
-- as a human reading "a seat opened up, you have 48h" would expect.

-- ── promote_waitlist() : offer the next waiting learner a freed seat ───────
create or replace function public.promote_waitlist(p_session_id uuid)
returns public.waitlist_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.course_sessions;
  v_active_count integer;
  v_entry public.waitlist_entries;
  v_enrollment public.enrollments;
  v_result public.waitlist_entries;
begin
  select * into v_session from public.course_sessions where id = p_session_id for update;
  if v_session.id is null or v_session.capacity is null then
    return null;
  end if;

  update public.waitlist_entries
  set status = 'expired'
  where session_id = p_session_id and status = 'offered' and expires_at < now();

  select count(*) into v_active_count from public.enrollments where session_id = p_session_id and status = 'active';
  if v_active_count >= v_session.capacity then
    return null;
  end if;

  if exists (select 1 from public.waitlist_entries where session_id = p_session_id and status = 'offered' and expires_at >= now()) then
    return null;
  end if;

  select * into v_entry from public.waitlist_entries
  where session_id = p_session_id and status = 'waiting'
  order by position
  limit 1;
  if v_entry.id is null then
    return null;
  end if;

  update public.waitlist_entries
  set status = 'offered', offered_at = now(), expires_at = now() + interval '48 hours'
  where id = v_entry.id
  returning * into v_result;

  select * into v_enrollment from public.enrollments
  where session_id = p_session_id and learner_id = v_entry.learner_id and status = 'waitlisted'
  order by created_at desc limit 1;
  if v_enrollment.id is not null then
    perform public.emit_learning_event('enrollment.waitlist_offered', v_session.org_id, v_entry.learner_id, 'enrollment', v_enrollment.id, jsonb_build_object('session_id', p_session_id, 'expires_at', v_result.expires_at));
  end if;

  return v_result;
end;
$$;

revoke all on function public.promote_waitlist(uuid) from public;
grant execute on function public.promote_waitlist(uuid) to authenticated;

-- ── accept_waitlist_offer() / decline_waitlist_offer() : the learner's side ─
create or replace function public.accept_waitlist_offer(p_waitlist_entry_id uuid)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.waitlist_entries;
  v_session public.course_sessions;
  v_enrollment public.enrollments;
  v_active_count integer;
begin
  select * into v_entry from public.waitlist_entries where id = p_waitlist_entry_id for update;
  if v_entry.id is null then
    raise exception 'Waitlist entry not found';
  end if;
  if v_entry.learner_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;
  if v_entry.status <> 'offered' or v_entry.expires_at < now() then
    raise exception 'offer_not_active';
  end if;

  -- Locks the session so a concurrent staff enroll_in_session() call for
  -- someone else can't race this into oversubscribing the last seat.
  select * into v_session from public.course_sessions where id = v_entry.session_id for update;

  select * into v_enrollment from public.enrollments
  where session_id = v_entry.session_id and learner_id = v_entry.learner_id and status = 'waitlisted'
  order by created_at desc limit 1;
  if v_enrollment.id is null then
    raise exception 'Enrollment not found';
  end if;

  select count(*) into v_active_count from public.enrollments where session_id = v_entry.session_id and status = 'active';
  if v_session.capacity is not null and v_active_count >= v_session.capacity then
    raise exception 'session_full';
  end if;

  update public.waitlist_entries set status = 'accepted' where id = p_waitlist_entry_id;
  update public.enrollments set status = 'active' where id = v_enrollment.id returning * into v_enrollment;
  insert into public.enrollment_history (enrollment_id, from_status, to_status, actor_id, source, reason)
  values (v_enrollment.id, 'waitlisted', 'active', auth.uid(), 'waitlist', 'accepted_offer');
  perform public.emit_learning_event('enrollment.started', v_session.org_id, auth.uid(), 'enrollment', v_enrollment.id, jsonb_build_object('session_id', v_entry.session_id, 'source', 'waitlist'));

  return v_enrollment;
end;
$$;

revoke all on function public.accept_waitlist_offer(uuid) from public;
grant execute on function public.accept_waitlist_offer(uuid) to authenticated;

create or replace function public.decline_waitlist_offer(p_waitlist_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.waitlist_entries;
begin
  select * into v_entry from public.waitlist_entries where id = p_waitlist_entry_id for update;
  if v_entry.id is null then
    raise exception 'Waitlist entry not found';
  end if;
  if v_entry.learner_id <> auth.uid() and not exists (
    select 1 from public.course_sessions s where s.id = v_entry.session_id and public.has_org_role(s.org_id, array['registrar','pedago','admin'])
  ) then
    raise exception 'Not authorized';
  end if;

  update public.waitlist_entries set status = 'declined' where id = p_waitlist_entry_id;
  update public.enrollments set status = 'withdrawn'
  where session_id = v_entry.session_id and learner_id = v_entry.learner_id and status = 'waitlisted';

  perform public.promote_waitlist(v_entry.session_id);
end;
$$;

revoke all on function public.decline_waitlist_offer(uuid) from public;
grant execute on function public.decline_waitlist_offer(uuid) to authenticated;

-- ── transition_enrollment() : now triggers promotion on a freed seat ───────
create or replace function public.transition_enrollment(
  p_enrollment_id uuid,
  p_to_status text,
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
begin
  if p_to_status not in ('completed','failed','withdrawn','cancelled','expired','active') then
    raise exception 'invalid_status';
  end if;

  select * into v_enrollment from public.enrollments where id = p_enrollment_id for update;
  if v_enrollment.id is null then
    raise exception 'Enrollment not found';
  end if;

  if v_enrollment.learner_id <> auth.uid() and not public.has_org_role(v_enrollment.org_id, array['registrar','pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  if v_enrollment.learner_id = auth.uid() and not public.has_org_role(v_enrollment.org_id, array['registrar','pedago','admin']) and p_to_status <> 'withdrawn' then
    raise exception 'Not authorized';
  end if;

  update public.enrollments set status = p_to_status where id = p_enrollment_id returning * into v_result;
  insert into public.enrollment_history (enrollment_id, from_status, to_status, actor_id, source, reason)
  values (p_enrollment_id, v_enrollment.status, p_to_status, auth.uid(), 'manual', p_reason);

  -- 'completed' deliberately doesn't free a promotable seat here — a
  -- session nearing its own end isn't a meaningful moment to backfill a
  -- waitlisted learner into it.
  if v_enrollment.status = 'active' and p_to_status in ('withdrawn','cancelled','expired','failed') then
    perform public.promote_waitlist(v_enrollment.session_id);
  end if;

  return v_result;
end;
$$;

revoke all on function public.transition_enrollment(uuid, text, text) from public;
grant execute on function public.transition_enrollment(uuid, text, text) to authenticated;
