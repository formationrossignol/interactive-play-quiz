-- Spec 09 — Sondage live, Q&A, modération et coanimation
-- (docs/product-specs/2026-08-10-lms-program/09-live-engagement.md).
--
-- RESTE-A-FAIRE.md §09: "Rate limiting et filtre de termes assistant
-- (modération)." Spec text (## Modération et sécurité, the entirety of
-- what this item has to go on — no numeric thresholds given anywhere):
--   "Filtre de termes configurable comme assistance, jamais suppression
--   invisible." — flagged content must stay visible to the moderator, never
--   silently vanish. audience_questions already has a pending→approved/
--   dismissed gate (moderate_question()) nothing is ever public before a
--   human acts on it — so the filter here only has to annotate the pending
--   row for the moderator to see, not hide/block anything itself.
--   "Rate limits par participant, appareil et événement." — three
--   dimensions named. This system has no device-fingerprint mechanism
--   anywhere (no RPC takes a device id) and client_id is already the only
--   per-browser identity anonymous participants have (persisted
--   client-side, one per join) — it's already the practical "appareil"
--   proxy this system uses everywhere else (join_live_run, cast_vote,
--   submit_live_response all key on it), so "participant" and "appareil"
--   collapse to the same client_id-scoped check rather than inventing a
--   separate fingerprint. "événement" gets its own, higher, run-wide cap
--   independent of how many distinct client_ids are involved — the
--   defense a per-client cap alone can't provide against many synthetic
--   clients.
--
-- Scoped to the three content-write RPCs an unauthenticated participant
-- can spam today with zero limit (confirmed by reading their current
-- bodies before this migration: none of the four participant RPCs had
-- any cap): submit_audience_question, cast_vote, submit_live_response.
-- join_live_run is left out — that's admission control (already has its
-- own capacity/advisory-lock protection), not repeated-content flooding,
-- a different concern than what this item is about.
--
-- Term filtering is scoped to audience_questions.body only: it's the only
-- free-text content with an existing moderation gate to attach a flag to.
-- live_responses.payload has no moderation gate at all today (no format
-- that uses free text is even built yet — priority/matrix/brainstorm/
-- ranking have no editor/reader per RESTE-A-FAIRE §09), so filtering it
-- would mean inventing a moderation gate for content types that don't
-- exist yet — not attempted here.
--
-- Configurable per live_event (not per-org): mirrors live_event_allowlist's
-- own per-event settings shape and RLS (is_live_event_staff(event_id)),
-- the most recent precedent in this exact spec area. Sane defaults apply
-- when no row exists yet (coalesce), same posture as
-- analytics_privacy_settings' default-when-absent pattern.

create table public.live_event_moderation_settings (
  event_id                     uuid primary key references public.live_events(id) on delete cascade,
  rate_limit_per_window        integer not null default 5 check (rate_limit_per_window >= 1),
  rate_limit_window_seconds    integer not null default 60 check (rate_limit_window_seconds >= 1),
  event_rate_limit_per_window  integer not null default 60 check (event_rate_limit_per_window >= 1),
  blocked_terms                text[] not null default '{}',
  updated_at                   timestamptz not null default now()
);
create trigger live_event_moderation_settings_touch before update on public.live_event_moderation_settings
  for each row execute function public.touch_updated_at();

alter table public.live_event_moderation_settings enable row level security;
create policy live_event_moderation_settings_staff on public.live_event_moderation_settings
  for all using (public.is_live_event_staff(event_id))
  with check (public.is_live_event_staff(event_id));

-- Assist annotation, never a gate by itself — audience_questions is still
-- inserted normally (status defaults to 'pending' as before) regardless of
-- what matched; a moderator sees the flags and still explicitly
-- approves/dismisses via the existing moderate_question().
alter table public.audience_questions add column flagged_terms text[];

-- ── submit_audience_question(): rate limit + term-flag assist ───────────
create or replace function public.submit_audience_question(p_run_id uuid, p_client_id text, p_display_name text, p_body text)
returns public.audience_questions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_settings public.live_event_moderation_settings;
  v_client_count integer;
  v_event_count integer;
  v_lower_body text;
  v_flags text[] := '{}';
  v_term text;
  v_result public.audience_questions;
begin
  if public.live_run_requires_auth(p_run_id) and auth.uid() is null then
    raise exception 'Authentication required for this event';
  end if;
  if not public.live_run_allowlist_ok(p_run_id) then
    raise exception 'Not on the allowlist for this event';
  end if;

  select event_id into v_event_id from public.live_runs where id = p_run_id;
  select * into v_settings from public.live_event_moderation_settings where event_id = v_event_id;

  select count(*) into v_client_count from public.audience_questions
    where run_id = p_run_id and author_client_id = p_client_id
      and created_at > now() - make_interval(secs => coalesce(v_settings.rate_limit_window_seconds, 60));
  if v_client_count >= coalesce(v_settings.rate_limit_per_window, 5) then
    raise exception 'rate_limited';
  end if;

  select count(*) into v_event_count from public.audience_questions
    where run_id = p_run_id
      and created_at > now() - make_interval(secs => coalesce(v_settings.rate_limit_window_seconds, 60));
  if v_event_count >= coalesce(v_settings.event_rate_limit_per_window, 60) then
    raise exception 'rate_limited';
  end if;

  if v_settings.blocked_terms is not null and array_length(v_settings.blocked_terms, 1) > 0 then
    v_lower_body := lower(p_body);
    foreach v_term in array v_settings.blocked_terms loop
      if strpos(v_lower_body, lower(v_term)) > 0 then
        v_flags := array_append(v_flags, v_term);
      end if;
    end loop;
  end if;

  insert into public.audience_questions (run_id, author_client_id, author_display_name, body, flagged_terms)
  values (p_run_id, p_client_id, p_display_name, p_body, nullif(v_flags, '{}'))
  returning * into v_result;
  return v_result;
end;
$$;

revoke all on function public.submit_audience_question(uuid, text, text, text) from public;
grant execute on function public.submit_audience_question(uuid, text, text, text) to anon, authenticated;

-- ── cast_vote(): rate limit (no free text to filter) ────────────────────
create or replace function public.cast_vote(p_question_id uuid, p_client_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_event_id uuid;
  v_settings public.live_event_moderation_settings;
  v_client_count integer;
  v_event_count integer;
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

  select event_id into v_event_id from public.live_runs where id = v_run_id;
  select * into v_settings from public.live_event_moderation_settings where event_id = v_event_id;

  select count(*) into v_client_count from public.audience_question_votes v
    join public.audience_questions q on q.id = v.question_id
    where q.run_id = v_run_id and v.client_id = p_client_id
      and v.created_at > now() - make_interval(secs => coalesce(v_settings.rate_limit_window_seconds, 60));
  if v_client_count >= coalesce(v_settings.rate_limit_per_window, 5) then
    raise exception 'rate_limited';
  end if;

  select count(*) into v_event_count from public.audience_question_votes v
    join public.audience_questions q on q.id = v.question_id
    where q.run_id = v_run_id
      and v.created_at > now() - make_interval(secs => coalesce(v_settings.rate_limit_window_seconds, 60));
  if v_event_count >= coalesce(v_settings.event_rate_limit_per_window, 60) then
    raise exception 'rate_limited';
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

-- ── submit_live_response(): rate limit only — no format uses free text
-- yet, nothing to term-filter ─────────────────────────────────────────
create or replace function public.submit_live_response(p_interaction_id uuid, p_client_id text, p_payload jsonb)
returns public.live_responses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_event_id uuid;
  v_settings public.live_event_moderation_settings;
  v_client_count integer;
  v_event_count integer;
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

  select event_id into v_event_id from public.live_runs where id = v_run_id;
  select * into v_settings from public.live_event_moderation_settings where event_id = v_event_id;

  select count(*) into v_client_count from public.live_responses r
    join public.live_interactions i on i.id = r.interaction_id
    where i.run_id = v_run_id and r.client_id = p_client_id
      and r.submitted_at > now() - make_interval(secs => coalesce(v_settings.rate_limit_window_seconds, 60));
  if v_client_count >= coalesce(v_settings.rate_limit_per_window, 5) then
    raise exception 'rate_limited';
  end if;

  select count(*) into v_event_count from public.live_responses r
    join public.live_interactions i on i.id = r.interaction_id
    where i.run_id = v_run_id
      and r.submitted_at > now() - make_interval(secs => coalesce(v_settings.rate_limit_window_seconds, 60));
  if v_event_count >= coalesce(v_settings.event_rate_limit_per_window, 60) then
    raise exception 'rate_limited';
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
