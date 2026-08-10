-- Spec 09 — Sondage live, Q&A, modération et coanimation
-- (docs/product-specs/2026-08-10-lms-program/09-live-engagement.md).
--
-- Scope note: participation here is authenticated-only — true unauthenticated
-- (anon-role) participation, PowerPoint/Teams/Zoom SDK embeds and
-- brainstorm-specific idea/group tables are follow-up work on top of this
-- schema (brainstorm ideas can already ride live_responses.payload with
-- interaction kind='brainstorm'). RLS below deliberately does not gate
-- Q&A/interaction *read* on org membership — a live audience is defined by
-- who has the join code and a session, not by org role.

create table public.live_events (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  owner_id      uuid not null references auth.users(id) default auth.uid(),
  title         text not null,
  code          text not null,
  access_policy text not null default 'anonymous' check (access_policy in ('anonymous','pseudonym','authenticated','allowlist')),
  status        text not null default 'draft' check (status in ('draft','active','closed')),
  created_at    timestamptz not null default now(),
  unique (org_id, code)
);
create index live_events_org_idx on public.live_events(org_id);

create table public.live_event_members (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.live_events(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner','presenter','moderator','operator','analyst')),
  created_at timestamptz not null default now(),
  unique (event_id, user_id, role)
);

-- LIVE-003: reusing an event creates a new run — history is never overwritten.
create table public.live_runs (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.live_events(id) on delete cascade,
  status     text not null default 'open' check (status in ('open','closed')),
  started_at timestamptz not null default now(),
  ended_at   timestamptz
);
create index live_runs_event_idx on public.live_runs(event_id, started_at desc);

create table public.live_participants (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid not null references public.live_runs(id) on delete cascade,
  user_id       uuid references auth.users(id),
  client_id     text not null,
  display_name  text,
  joined_at     timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  unique (run_id, client_id)
);

create table public.audience_questions (
  id                  uuid primary key default gen_random_uuid(),
  run_id              uuid not null references public.live_runs(id) on delete cascade,
  author_client_id    text not null,
  author_display_name text,
  body                text not null check (char_length(trim(body)) between 1 and 2000),
  status              text not null default 'pending' check (status in ('pending','approved','live','answered','dismissed','archived')),
  votes_count         integer not null default 0,
  created_at          timestamptz not null default now()
);
create index audience_questions_run_idx on public.audience_questions(run_id, status);

-- LIVE/QNA acceptance: "deux votes identiques rejoués ne comptent qu'une fois".
create table public.audience_question_votes (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.audience_questions(id) on delete cascade,
  client_id   text not null,
  created_at  timestamptz not null default now(),
  unique (question_id, client_id)
);

create table public.audience_question_actions (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.audience_questions(id) on delete cascade,
  moderator_id uuid not null references auth.users(id),
  action       text not null check (action in ('approved','dismissed','merged','tagged','featured','marked_answered','edited')),
  created_at   timestamptz not null default now()
);
create index audience_question_actions_question_idx on public.audience_question_actions(question_id, created_at);

create table public.live_interactions (
  id         uuid primary key default gen_random_uuid(),
  run_id     uuid not null references public.live_runs(id) on delete cascade,
  kind       text not null check (kind in ('poll','priority','matrix','brainstorm','ranking')),
  config     jsonb not null default '{}'::jsonb,
  status     text not null default 'draft' check (status in ('draft','live','closed')),
  opened_at  timestamptz,
  closed_at  timestamptz
);
create index live_interactions_run_idx on public.live_interactions(run_id);

-- Reconnection-safe: unique per (interaction, client) so a reconnect never
-- doubles a response (acceptance: "la reconnexion rétablit... réponse déjà envoyée").
create table public.live_responses (
  id             uuid primary key default gen_random_uuid(),
  interaction_id uuid not null references public.live_interactions(id) on delete cascade,
  client_id      text not null,
  payload        jsonb not null,
  submitted_at   timestamptz not null default now(),
  unique (interaction_id, client_id)
);

-- LIVE-007: single navigation authority — one row per run, last acquire wins atomically.
create table public.live_control_leases (
  run_id        uuid primary key references public.live_runs(id) on delete cascade,
  holder_id     uuid not null references auth.users(id),
  acquired_at   timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.live_events enable row level security;
alter table public.live_event_members enable row level security;
alter table public.live_runs enable row level security;
alter table public.live_participants enable row level security;
alter table public.audience_questions enable row level security;
alter table public.audience_question_votes enable row level security;
alter table public.audience_question_actions enable row level security;
alter table public.live_interactions enable row level security;
alter table public.live_responses enable row level security;
alter table public.live_control_leases enable row level security;

-- security definer: this is read from inside RLS policies on live_events
-- itself (live_events_staff below) — as security invoker it would recurse
-- into that same policy when it queries live_events, so it must run as the
-- table owner (who bypasses RLS) instead.
create or replace function public.is_live_event_staff(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.live_events e
    where e.id = p_event_id
      and (
        e.owner_id = auth.uid()
        or public.has_org_role(e.org_id, array['pedago','admin'])
        or exists (select 1 from public.live_event_members m where m.event_id = e.id and m.user_id = auth.uid())
      )
  );
$$;

create policy live_events_staff on public.live_events
  for select using (public.is_live_event_staff(id));
create policy live_events_active_read on public.live_events
  for select using (status = 'active');
create policy live_events_manage on public.live_events
  for all using (owner_id = auth.uid() or public.has_org_role(org_id, array['pedago','admin']))
  with check (owner_id = auth.uid() or public.has_org_role(org_id, array['pedago','admin']));

create policy live_event_members_staff on public.live_event_members
  for select using (public.is_live_event_staff(event_id));
create policy live_event_members_manage on public.live_event_members
  for all using (exists (select 1 from public.live_events e where e.id = event_id and (e.owner_id = auth.uid() or public.has_org_role(e.org_id, array['pedago','admin']))))
  with check (exists (select 1 from public.live_events e where e.id = event_id and (e.owner_id = auth.uid() or public.has_org_role(e.org_id, array['pedago','admin']))));

create policy live_runs_staff on public.live_runs
  for select using (public.is_live_event_staff(event_id));
create policy live_runs_participant_read on public.live_runs
  for select using (exists (select 1 from public.live_events e where e.id = event_id and e.status = 'active'));
create policy live_runs_manage on public.live_runs
  for all using (public.is_live_event_staff(event_id)) with check (public.is_live_event_staff(event_id));

create policy live_participants_staff on public.live_participants
  for select using (exists (select 1 from public.live_runs r where r.id = run_id and public.is_live_event_staff(r.event_id)));

-- Audience read: anyone authenticated can see moderated Q&A / interactions
-- for a run whose event is active — the join code is the real gate,
-- enforced by application flow, not by org membership.
create policy audience_questions_public_read on public.audience_questions
  for select using (
    status in ('approved','live','answered')
    and exists (select 1 from public.live_runs r join public.live_events e on e.id = r.event_id where r.id = run_id and e.status = 'active')
  );
create policy audience_questions_staff on public.audience_questions
  for select using (exists (select 1 from public.live_runs r where r.id = run_id and public.is_live_event_staff(r.event_id)));

create policy audience_question_votes_staff on public.audience_question_votes
  for select using (exists (select 1 from public.audience_questions q join public.live_runs r on r.id = q.run_id where q.id = question_id and public.is_live_event_staff(r.event_id)));

create policy audience_question_actions_staff on public.audience_question_actions
  for select using (exists (select 1 from public.audience_questions q join public.live_runs r on r.id = q.run_id where q.id = question_id and public.is_live_event_staff(r.event_id)));

create policy live_interactions_public_read on public.live_interactions
  for select using (
    status in ('live','closed')
    and exists (select 1 from public.live_runs r join public.live_events e on e.id = r.event_id where r.id = run_id and e.status = 'active')
  );
create policy live_interactions_staff on public.live_interactions
  for all using (exists (select 1 from public.live_runs r where r.id = run_id and public.is_live_event_staff(r.event_id)))
  with check (exists (select 1 from public.live_runs r where r.id = run_id and public.is_live_event_staff(r.event_id)));

create policy live_responses_staff_read on public.live_responses
  for select using (
    exists (select 1 from public.live_interactions i join public.live_runs r on r.id = i.run_id where i.id = interaction_id and public.is_live_event_staff(r.event_id))
  );

create policy live_control_leases_staff on public.live_control_leases
  for select using (exists (select 1 from public.live_runs r where r.id = run_id and public.is_live_event_staff(r.event_id)));

-- ── create_live_run() : reuse never overwrites history (LIVE-003) ─────────
create or replace function public.create_live_run(p_event_id uuid)
returns public.live_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.live_runs;
begin
  if not public.is_live_event_staff(p_event_id) then
    raise exception 'Not authorized';
  end if;
  insert into public.live_runs (event_id) values (p_event_id) returning * into v_result;
  return v_result;
end;
$$;

revoke all on function public.create_live_run(uuid) from public;
grant execute on function public.create_live_run(uuid) to authenticated;

-- ── submit_audience_question() : moderation-gated by default ──────────────
create or replace function public.submit_audience_question(p_run_id uuid, p_client_id text, p_display_name text, p_body text)
returns public.audience_questions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.audience_questions;
begin
  insert into public.audience_questions (run_id, author_client_id, author_display_name, body)
  values (p_run_id, p_client_id, p_display_name, p_body)
  returning * into v_result;
  return v_result;
end;
$$;

revoke all on function public.submit_audience_question(uuid, text, text, text) from public;
grant execute on function public.submit_audience_question(uuid, text, text, text) to authenticated;

-- ── moderate_question() : status transition + audit ────────────────────────
create or replace function public.moderate_question(p_question_id uuid, p_action text)
returns public.audience_questions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_next_status text;
  v_result public.audience_questions;
begin
  select run_id into v_run_id from public.audience_questions where id = p_question_id;
  if v_run_id is null then
    raise exception 'Question not found';
  end if;
  if not exists (select 1 from public.live_runs r where r.id = v_run_id and public.is_live_event_staff(r.event_id)) then
    raise exception 'Not authorized';
  end if;

  v_next_status := case p_action
    when 'approved' then 'approved'
    when 'dismissed' then 'dismissed'
    when 'marked_answered' then 'answered'
    when 'featured' then 'live'
    else null
  end;

  if v_next_status is not null then
    update public.audience_questions set status = v_next_status where id = p_question_id returning * into v_result;
  else
    select * into v_result from public.audience_questions where id = p_question_id;
  end if;

  insert into public.audience_question_actions (question_id, moderator_id, action) values (p_question_id, auth.uid(), p_action);

  return v_result;
end;
$$;

revoke all on function public.moderate_question(uuid, text) from public;
grant execute on function public.moderate_question(uuid, text) to authenticated;

-- ── cast_vote() : idempotent by (question, client) ──────────────────────
create or replace function public.cast_vote(p_question_id uuid, p_client_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
begin
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
grant execute on function public.cast_vote(uuid, text) to authenticated;

-- ── submit_live_response() : idempotent by (interaction, client) ──────────
create or replace function public.submit_live_response(p_interaction_id uuid, p_client_id text, p_payload jsonb)
returns public.live_responses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.live_responses;
begin
  insert into public.live_responses (interaction_id, client_id, payload)
  values (p_interaction_id, p_client_id, p_payload)
  on conflict (interaction_id, client_id) do update set payload = excluded.payload
  returning * into v_result;
  return v_result;
end;
$$;

revoke all on function public.submit_live_response(uuid, text, jsonb) from public;
grant execute on function public.submit_live_response(uuid, text, jsonb) to authenticated;

-- ── acquire_control_lease() : atomic single-authority handover ────────────
create or replace function public.acquire_control_lease(p_run_id uuid)
returns public.live_control_leases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.live_control_leases;
begin
  if not exists (select 1 from public.live_runs r where r.id = p_run_id and public.is_live_event_staff(r.event_id)) then
    raise exception 'Not authorized';
  end if;
  insert into public.live_control_leases (run_id, holder_id) values (p_run_id, auth.uid())
  on conflict (run_id) do update set holder_id = excluded.holder_id, acquired_at = now()
  returning * into v_result;
  return v_result;
end;
$$;

revoke all on function public.acquire_control_lease(uuid) from public;
grant execute on function public.acquire_control_lease(uuid) to authenticated;
