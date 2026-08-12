-- Spec 09 — Sondage live, Q&A, modération et coanimation
-- (docs/product-specs/2026-08-10-lms-program/09-live-engagement.md).
--
-- RESTE-A-FAIRE.md §09: "Vraie table/mécanisme d'allowlist pour
-- access_policy = 'allowlist' (actuellement traité comme 'authenticated')."
-- live_run_requires_auth() (20260811020000) already returns true for both
-- 'authenticated' and 'allowlist' — that half (must be logged in) was
-- correct and stays untouched. What was missing: nothing ever checked the
-- caller's email against an actual list. This adds the table and a second,
-- independent check layered on top of the four existing entry points
-- (join_live_run/submit_audience_question/cast_vote/submit_live_response),
-- each of which already had its own `live_run_requires_auth` gate — the new
-- `live_run_allowlist_ok` check is additive, a no-op for every
-- access_policy other than 'allowlist'.

create table public.live_event_allowlist (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.live_events(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);
-- Case-insensitive uniqueness: "Foo@x.com" and "foo@x.com" are the same
-- entry, not two near-duplicates a staff member has to notice and merge.
create unique index live_event_allowlist_event_email_idx on public.live_event_allowlist(event_id, lower(email));
create index live_event_allowlist_event_idx on public.live_event_allowlist(event_id);

alter table public.live_event_allowlist enable row level security;

create policy live_event_allowlist_staff on public.live_event_allowlist
  for all using (public.is_live_event_staff(event_id))
  with check (public.is_live_event_staff(event_id));

-- ── live_run_allowlist_ok() : the actual list check ─────────────────────
-- Fails closed: no default scale... no, no matching row, or no auth.uid()
-- at all under an 'allowlist' policy both mean "not allowed", never "allow
-- and figure it out later". auth.users.email is only readable here because
-- this runs security definer (table owner bypasses RLS on auth.users).
create or replace function public.live_run_allowlist_ok(p_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when e.access_policy is distinct from 'allowlist' then true
    when auth.uid() is null then false
    else exists (
      select 1 from public.live_event_allowlist a
      join auth.users u on u.id = auth.uid()
      where a.event_id = e.id and lower(a.email) = lower(u.email)
    )
  end
  from public.live_runs r join public.live_events e on e.id = r.event_id
  where r.id = p_run_id;
$$;

revoke all on function public.live_run_allowlist_ok(uuid) from public;

-- ── the four entry points: same body as 20260811020000, plus one check ──
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
  if not public.live_run_allowlist_ok(p_run_id) then
    raise exception 'Not on the allowlist for this event';
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
  if not public.live_run_allowlist_ok(p_run_id) then
    raise exception 'Not on the allowlist for this event';
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
  if not public.live_run_allowlist_ok(v_run_id) then
    raise exception 'Not on the allowlist for this event';
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
  if not public.live_run_allowlist_ok(v_run_id) then
    raise exception 'Not on the allowlist for this event';
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
