-- Spec 09 — Sondage live, Q&A, modération et coanimation
-- (docs/product-specs/2026-08-10-lms-program/09-live-engagement.md).
--
-- Follow-up to 20260810230000_live_engagement.sql, which left three gaps
-- from VALIDATION-STATUS.md §09:
--   - no writer ever creates a `live_participants` row — LIVE-004 (lobby,
--     capacité, verrouillage, expulsion, reconnexion) had the table but
--     nothing populated it.
--   - the four audience-facing RPCs never looked at `live_events.access_policy`
--     — an event configured 'authenticated' could still be answered by an
--     anon caller, and no RPC was ever granted to `anon` in the first place,
--     so LIVE-002 "accès anonyme" was schema-only, never wired.
--   - `learning_events`-style push was never enabled for the live tables —
--     "Temps réel effectif" (VALIDATION-STATUS) was pure fetch-on-demand.
--
-- Still not covered: `allowlist` access_policy has no backing membership
-- table anywhere in the indicative model, so it's treated as requiring
-- authentication (same bucket as 'authenticated') rather than inventing an
-- allowlist schema no spec section asked for. PowerPoint/Teams/Zoom, the
-- public/presenter/moderator screen split and the participant UI itself are
-- still out of scope here — this migration is the DB/RLS/RPC layer only,
-- same split every other spec in this program used.

alter table public.live_runs add column capacity integer check (capacity is null or capacity > 0);
alter table public.live_runs add column locked boolean not null default false;
alter table public.live_participants add column status text not null default 'active' check (status in ('active', 'kicked'));

-- ── live_run_requires_auth() : LIVE-002 policy check shared by every writer ─
create or replace function public.live_run_requires_auth(p_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select e.access_policy in ('authenticated', 'allowlist')
  from public.live_runs r
  join public.live_events e on e.id = r.event_id
  where r.id = p_run_id;
$$;

-- ── join_live_run() : lobby entry, capacity, lock, reconnection, expulsion ──
-- Idempotent by (run_id, client_id): a reconnect calls this again and gets
-- the same participant row back with last_seen_at refreshed, never a
-- duplicate seat. pg_advisory_xact_lock serializes concurrent joins on the
-- same run so the capacity check-then-insert can't race two participants
-- into the last seat.
create or replace function public.join_live_run(p_run_id uuid, p_client_id text, p_display_name text default null)
returns public.live_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.live_runs;
  v_event public.live_events;
  v_existing public.live_participants;
  v_seat_count integer;
  v_result public.live_participants;
begin
  perform pg_advisory_xact_lock(hashtext(p_run_id::text));

  select * into v_run from public.live_runs where id = p_run_id;
  if v_run.id is null then
    raise exception 'Run not found';
  end if;
  select * into v_event from public.live_events where id = v_run.event_id;

  if v_event.status <> 'active' or v_run.status <> 'open' then
    raise exception 'Run is not open';
  end if;
  if public.live_run_requires_auth(p_run_id) and auth.uid() is null then
    raise exception 'Authentication required for this event';
  end if;

  select * into v_existing from public.live_participants where run_id = p_run_id and client_id = p_client_id;
  if v_existing.id is not null and v_existing.status = 'kicked' then
    raise exception 'You have been removed from this run';
  end if;

  if v_existing.id is null then
    if v_run.locked then
      raise exception 'Run is locked';
    end if;
    if v_run.capacity is not null then
      select count(*) into v_seat_count from public.live_participants where run_id = p_run_id and status = 'active';
      if v_seat_count >= v_run.capacity then
        raise exception 'Run is at capacity';
      end if;
    end if;
  end if;

  insert into public.live_participants (run_id, user_id, client_id, display_name)
  values (p_run_id, auth.uid(), p_client_id, p_display_name)
  on conflict (run_id, client_id) do update
    set last_seen_at = now(),
        display_name = coalesce(excluded.display_name, public.live_participants.display_name)
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.join_live_run(uuid, text, text) from public;
grant execute on function public.join_live_run(uuid, text, text) to anon, authenticated;

-- ── kick_participant() / lock_live_run() : staff-only lobby control ────────
create or replace function public.kick_participant(p_participant_id uuid)
returns public.live_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_result public.live_participants;
begin
  select run_id into v_run_id from public.live_participants where id = p_participant_id;
  if v_run_id is null then
    raise exception 'Participant not found';
  end if;
  if not exists (select 1 from public.live_runs r where r.id = v_run_id and public.is_live_event_staff(r.event_id)) then
    raise exception 'Not authorized';
  end if;

  update public.live_participants set status = 'kicked' where id = p_participant_id
  returning * into v_result;
  return v_result;
end;
$$;

revoke all on function public.kick_participant(uuid) from public;
grant execute on function public.kick_participant(uuid) to authenticated;

create or replace function public.lock_live_run(p_run_id uuid, p_locked boolean)
returns public.live_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.live_runs;
begin
  if not exists (select 1 from public.live_runs r where r.id = p_run_id and public.is_live_event_staff(r.event_id)) then
    raise exception 'Not authorized';
  end if;
  update public.live_runs set locked = p_locked where id = p_run_id returning * into v_result;
  return v_result;
end;
$$;

revoke all on function public.lock_live_run(uuid, boolean) from public;
grant execute on function public.lock_live_run(uuid, boolean) to authenticated;

-- ── get_my_live_response() : reconnection restores the client's own answer ─
-- live_responses has no participant-facing SELECT policy (only staff read
-- it directly) because client_id isn't an auth identity RLS can key on —
-- same trust model as cast_vote/submit_live_response already use (whoever
-- holds the client_id is the participant). This is the read-side equivalent.
create or replace function public.get_my_live_response(p_interaction_id uuid, p_client_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select payload from public.live_responses
  where interaction_id = p_interaction_id and client_id = p_client_id;
$$;

revoke all on function public.get_my_live_response(uuid, text) from public;
grant execute on function public.get_my_live_response(uuid, text) to anon, authenticated;

-- ── LIVE-002: audience-facing writers now enforce access_policy ────────────
create or replace function public.submit_audience_question(p_run_id uuid, p_client_id text, p_display_name text, p_body text)
returns public.audience_questions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.audience_questions;
begin
  if public.live_run_requires_auth(p_run_id) and auth.uid() is null then
    raise exception 'Authentication required for this event';
  end if;

  insert into public.audience_questions (run_id, author_client_id, author_display_name, body)
  values (p_run_id, p_client_id, p_display_name, p_body)
  returning * into v_result;
  return v_result;
end;
$$;

revoke all on function public.submit_audience_question(uuid, text, text, text) from public;
grant execute on function public.submit_audience_question(uuid, text, text, text) to anon, authenticated;

create or replace function public.cast_vote(p_question_id uuid, p_client_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_inserted integer;
begin
  select run_id into v_run_id from public.audience_questions where id = p_question_id;
  if v_run_id is null then
    raise exception 'Question not found';
  end if;
  if public.live_run_requires_auth(v_run_id) and auth.uid() is null then
    raise exception 'Authentication required for this event';
  end if;

  insert into public.audience_question_votes (question_id, client_id)
  values (p_question_id, p_client_id)
  on conflict (question_id, client_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    update public.audience_questions set votes_count = votes_count + 1 where id = p_question_id;
  end if;

  return (select votes_count from public.audience_questions where id = p_question_id);
end;
$$;

revoke all on function public.cast_vote(uuid, text) from public;
grant execute on function public.cast_vote(uuid, text) to anon, authenticated;

create or replace function public.submit_live_response(p_interaction_id uuid, p_client_id text, p_payload jsonb)
returns public.live_responses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_result public.live_responses;
begin
  select run_id into v_run_id from public.live_interactions where id = p_interaction_id;
  if v_run_id is null then
    raise exception 'Interaction not found';
  end if;
  if public.live_run_requires_auth(v_run_id) and auth.uid() is null then
    raise exception 'Authentication required for this event';
  end if;

  insert into public.live_responses (interaction_id, client_id, payload)
  values (p_interaction_id, p_client_id, p_payload)
  on conflict (interaction_id, client_id) do update set payload = excluded.payload
  returning * into v_result;
  return v_result;
end;
$$;

revoke all on function public.submit_live_response(uuid, text, jsonb) from public;
grant execute on function public.submit_live_response(uuid, text, jsonb) to anon, authenticated;

-- ── Temps réel effectif : push instead of fetch-on-demand ──────────────────
alter publication supabase_realtime add table public.audience_questions;
alter publication supabase_realtime add table public.live_interactions;
alter publication supabase_realtime add table public.live_runs;
alter publication supabase_realtime add table public.live_responses;
