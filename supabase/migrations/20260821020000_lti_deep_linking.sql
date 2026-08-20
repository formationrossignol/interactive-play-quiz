-- Spec 04 — Interopérabilité, identité et administration Enterprise
-- (docs/product-specs/2026-08-10-lms-program/04-interoperability-identity.md:65-66).
-- LTI-002 — Deep Linking: "sélection/création d'un quiz, sondage, examen ou
-- activité Brivia depuis le LMS."
--
-- Content-type reality check done before writing this: this LMS's quiz/poll/
-- exam content is entirely game-code/join-code/live-session based
-- (/quiz/:gameCode, /join-exam/:joinCode, /take/:joinCode) — there is no
-- "one learner opens this exact content by id and takes it solo" route for
-- those types, which is what an LTI resource-link launch actually needs to
-- land on. `course` is the one content type with a direct, session-less,
-- id-addressable viewing route (/course/:courseId) already. So this pass
-- wires Deep Linking for `course` content for real, end-to-end — quiz/poll/
-- exam deep-linking is NOT closed here; it would first need a solo-attempt
-- viewing route this codebase doesn't have, a separate feature, not guessed
-- at in this migration. The session table/response-building code below
-- doesn't hardcode "course-only" as a protocol constraint, only the picker
-- UI does — extending to other types later is a UI change, not a schema one.
--
-- lti_deep_linking_sessions is the cross-request correlator between
-- lti-launch's deep-linking-request verification and the picker page the
-- browser lands on after — same "short-lived server-side row, single-use,
-- TTL'd" shape as lti_login_states/sso_login_states/saml_login_states, same
-- reason (a platform-issued deep_link_return_url + opaque `data` token is
-- exactly the kind of state this codebase already refuses to trust to a URL
-- param or cookie across a cross-site redirect).
create table public.lti_deep_linking_sessions (
  id                  uuid primary key default gen_random_uuid(),
  registration_id     uuid not null references public.lti_registrations(id) on delete cascade,
  deployment_id       text not null,
  user_id             uuid not null references auth.users(id) on delete cascade,
  deep_link_return_url text not null,
  accept_types        jsonb not null default '[]'::jsonb,
  platform_data       text,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null
);
create index lti_deep_linking_sessions_expires_idx on public.lti_deep_linking_sessions(expires_at);
alter table public.lti_deep_linking_sessions enable row level security;
-- No policies — same as lti_login_states: written by lti-launch
-- (service_role), read/consumed only through the narrow RPCs below (the
-- picker page never gets deep_link_return_url/platform_data directly, only
-- what it needs to confirm the session is real and show a picker).

-- Picker-page existence/ownership check — deliberately narrow, mirrors
-- resolve_sso_connection_for_email()'s posture: confirms the session is
-- real and belongs to the caller, returns nothing the client doesn't need
-- (not deep_link_return_url, not platform_data — those only matter at
-- submit time, handled server-side in lti-deep-linking-response).
create or replace function public.get_lti_deep_linking_session(p_session_id uuid)
returns table(registration_id uuid, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.registration_id, s.expires_at
  from public.lti_deep_linking_sessions s
  where s.id = p_session_id and s.user_id = auth.uid() and s.expires_at > now();
$$;
revoke all on function public.get_lti_deep_linking_session(uuid) from public;
grant execute on function public.get_lti_deep_linking_session(uuid) to authenticated;

-- Single-use consume, called by lti-deep-linking-response at submit time —
-- deletes on read (same anti-replay shape as every other login-state table
-- in this codebase) after verifying the caller owns it. Returns everything
-- the response-builder needs in one round trip.
create or replace function public.consume_lti_deep_linking_session(p_session_id uuid)
returns table(
  registration_id uuid,
  deployment_id text,
  deep_link_return_url text,
  accept_types jsonb,
  platform_data text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result record;
begin
  delete from public.lti_deep_linking_sessions
  where id = p_session_id and user_id = auth.uid() and expires_at > now()
  returning lti_deep_linking_sessions.registration_id, lti_deep_linking_sessions.deployment_id,
            lti_deep_linking_sessions.deep_link_return_url, lti_deep_linking_sessions.accept_types,
            lti_deep_linking_sessions.platform_data
  into v_result;

  if v_result is null then
    raise exception 'Session not found, already used, or expired';
  end if;

  return query select v_result.registration_id, v_result.deployment_id,
    v_result.deep_link_return_url, v_result.accept_types, v_result.platform_data;
end;
$$;
revoke all on function public.consume_lti_deep_linking_session(uuid) from public;
grant execute on function public.consume_lti_deep_linking_session(uuid) to authenticated;
