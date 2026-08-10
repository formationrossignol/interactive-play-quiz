-- Spec 02 — Inscriptions, sessions et gestion des apprenants
-- (docs/product-specs/2026-08-10-lms-program/02-enrollment-roster.md).
--
-- Also lays down `learning_events` + `emit_learning_event()`: the shared,
-- append-only analytics primitive required by the program's cross-cutting
-- "Événements analytiques" principle (README §Événements analytiques). It's
-- introduced here, in the first spec built, because enroll_in_session()
-- below is the program's first event producer; spec 07 later adds the
-- metric/report layer on top without touching this table's shape.
--
-- Arbitrages retenus par défaut (README §Arbitrages requis) : Brivia est la
-- source de vérité des inscriptions ; mobile = PWA ; anonymat/fournisseurs
-- non concernés par cette spec.

-- ── learning_events : append-only, dedup by event_id ───────────────────────
create table public.learning_events (
  id           uuid primary key default gen_random_uuid(),
  event_id     text not null unique,
  name         text not null,
  org_id       uuid not null references public.organizations(id) on delete cascade,
  actor_id     uuid references auth.users(id) on delete set null,
  subject_type text,
  subject_id   uuid,
  occurred_at  timestamptz not null default now(),
  received_at  timestamptz not null default now(),
  schema_version integer not null default 1,
  properties   jsonb not null default '{}'::jsonb
);
create index learning_events_org_name_idx on public.learning_events(org_id, name, occurred_at desc);
create index learning_events_subject_idx on public.learning_events(subject_type, subject_id);

alter table public.learning_events enable row level security;

-- No client insert/update/delete: only emit_learning_event() (security
-- definer) writes. Org admin/pedago can read their own org's events.
create policy learning_events_org_read on public.learning_events
  for select using (public.has_org_role(org_id, array['admin','pedago']));

-- properties must never carry free text, an answer or an attachment — see
-- README §Événements analytiques. Enforced by convention in call sites, not
-- by the database.
create or replace function public.emit_learning_event(
  p_name text,
  p_org_id uuid,
  p_actor_id uuid,
  p_subject_type text,
  p_subject_id uuid,
  p_properties jsonb default '{}'::jsonb,
  p_event_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.learning_events (event_id, name, org_id, actor_id, subject_type, subject_id, properties)
  values (coalesce(p_event_id, gen_random_uuid()::text), p_name, p_org_id, p_actor_id, p_subject_type, p_subject_id, coalesce(p_properties, '{}'::jsonb))
  on conflict (event_id) do nothing;
end;
$$;

revoke all on function public.emit_learning_event(text, uuid, uuid, text, uuid, jsonb, text) from public;
grant execute on function public.emit_learning_event(text, uuid, uuid, text, uuid, jsonb, text) to authenticated;

-- ── course_offerings : catalogued view of a `content` course ───────────────
create table public.course_offerings (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  content_id uuid not null references public.content(id) on delete cascade,
  visibility text not null default 'internal' check (visibility in ('uncatalogued','internal','public','invite_only')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index course_offerings_org_idx on public.course_offerings(org_id);
create unique index course_offerings_content_idx on public.course_offerings(content_id);

-- ── course_sessions : a planned occurrence of an offering ──────────────────
create table public.course_sessions (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  offering_id    uuid not null references public.course_offerings(id) on delete cascade,
  label          text not null check (char_length(trim(label)) between 1 and 160),
  code           text not null,
  mode           text not null default 'fixed' check (mode in ('fixed','self_paced_relative','self_paced_open','recurring')),
  timezone       text not null default 'UTC',
  starts_at      timestamptz,
  ends_at        timestamptz,
  capacity       integer check (capacity is null or capacity > 0),
  enrollment_policy jsonb not null default '{}'::jsonb,
  content_snapshot jsonb not null,
  content_schema_version integer not null default 1,
  content_hash   text not null,
  status         text not null default 'draft' check (status in ('draft','published','in_progress','completed','cancelled')),
  created_by     uuid not null references auth.users(id),
  created_at     timestamptz not null default now()
);
create unique index course_sessions_org_code_idx on public.course_sessions(org_id, code);
create index course_sessions_offering_idx on public.course_sessions(offering_id);

create table public.session_trainers (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.course_sessions(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  responsibility text not null default 'co' check (responsibility in ('lead','co')),
  created_at     timestamptz not null default now(),
  unique (session_id, user_id)
);
create index session_trainers_user_idx on public.session_trainers(user_id);

-- ── enrollments : durable learner ↔ session relation ────────────────────────
create table public.enrollments (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  session_id         uuid not null references public.course_sessions(id) on delete cascade,
  learner_id         uuid not null references auth.users(id) on delete cascade,
  status             text not null check (status in ('invited','pending','waitlisted','active','completed','failed','withdrawn','cancelled','expired')),
  source             text not null check (source in ('manual','group','import','self','purchase','lti','oneroster','scim')),
  effective_start_at timestamptz not null default now(),
  effective_due_at   timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index enrollments_session_idx on public.enrollments(session_id);
create index enrollments_learner_idx on public.enrollments(learner_id);
-- ENR-010 / acceptance: at most one *active* enrollment per learner/session.
create unique index enrollments_active_unique_idx on public.enrollments(session_id, learner_id) where status = 'active';

create trigger enrollments_touch before update on public.enrollments
  for each row execute function public.touch_updated_at();

-- ENR-007: every transition is append-only audit, never overwritten.
create table public.enrollment_history (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  from_status   text,
  to_status     text not null,
  actor_id      uuid references auth.users(id),
  source        text not null,
  reason        text,
  created_at    timestamptz not null default now()
);
create index enrollment_history_enrollment_idx on public.enrollment_history(enrollment_id, created_at);

-- ENR-008: origin group is recorded but never a live dependency — removing
-- someone from the group later does not touch the enrollment.
create table public.enrollment_group_sources (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  group_id      uuid not null references public.groups(id) on delete cascade,
  added_at      timestamptz not null default now()
);
create index enrollment_group_sources_enrollment_idx on public.enrollment_group_sources(enrollment_id);

create table public.waitlist_entries (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.course_sessions(id) on delete cascade,
  learner_id uuid not null references auth.users(id) on delete cascade,
  position   integer not null,
  status     text not null default 'waiting' check (status in ('waiting','offered','expired','accepted','declined')),
  offered_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index waitlist_entries_waiting_unique_idx on public.waitlist_entries(session_id, learner_id) where status = 'waiting';
create index waitlist_entries_session_idx on public.waitlist_entries(session_id, position);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.course_offerings enable row level security;
alter table public.course_sessions enable row level security;
alter table public.session_trainers enable row level security;
alter table public.enrollments enable row level security;
alter table public.enrollment_history enable row level security;
alter table public.enrollment_group_sources enable row level security;
alter table public.waitlist_entries enable row level security;

create policy course_offerings_org_read on public.course_offerings
  for select using (public.has_org_role(org_id, array['learner','trainer','pedago','registrar','admin']));
create policy course_offerings_public_read on public.course_offerings
  for select using (visibility = 'public');
create policy course_offerings_manage on public.course_offerings
  for all using (public.has_org_role(org_id, array['registrar','pedago','admin']))
  with check (public.has_org_role(org_id, array['registrar','pedago','admin']));

create policy course_sessions_org_read on public.course_sessions
  for select using (public.has_org_role(org_id, array['learner','trainer','pedago','registrar','admin']));
create policy course_sessions_public_read on public.course_sessions
  for select using (
    status = 'published'
    and exists (select 1 from public.course_offerings o where o.id = offering_id and o.visibility = 'public')
  );
create policy course_sessions_manage on public.course_sessions
  for all using (public.has_org_role(org_id, array['registrar','pedago','admin']))
  with check (public.has_org_role(org_id, array['registrar','pedago','admin']));

create policy session_trainers_read on public.session_trainers
  for select using (
    exists (select 1 from public.course_sessions s where s.id = session_id and public.has_org_role(s.org_id, array['learner','trainer','pedago','registrar','admin']))
  );
create policy session_trainers_manage on public.session_trainers
  for all using (
    exists (select 1 from public.course_sessions s where s.id = session_id and public.has_org_role(s.org_id, array['registrar','pedago','admin']))
  )
  with check (
    exists (select 1 from public.course_sessions s where s.id = session_id and public.has_org_role(s.org_id, array['registrar','pedago','admin']))
  );

-- enrollments: learner reads their own; registrar/pedago/admin read the org
-- roster; a session's trainer reads its roster. No client insert/update —
-- only enroll_in_session()/transition_enrollment() below (security definer).
create policy enrollments_read on public.enrollments
  for select using (
    learner_id = auth.uid()
    or public.has_org_role(org_id, array['registrar','pedago','admin'])
    or exists (select 1 from public.session_trainers t where t.session_id = enrollments.session_id and t.user_id = auth.uid())
  );

create policy enrollment_history_read on public.enrollment_history
  for select using (
    exists (
      select 1 from public.enrollments e
      where e.id = enrollment_id
        and (e.learner_id = auth.uid() or public.has_org_role(e.org_id, array['registrar','pedago','admin']))
    )
  );

create policy enrollment_group_sources_read on public.enrollment_group_sources
  for select using (
    exists (
      select 1 from public.enrollments e
      where e.id = enrollment_id
        and (e.learner_id = auth.uid() or public.has_org_role(e.org_id, array['registrar','pedago','admin']))
    )
  );

create policy waitlist_entries_read on public.waitlist_entries
  for select using (
    learner_id = auth.uid()
    or exists (select 1 from public.course_sessions s where s.id = session_id and public.has_org_role(s.org_id, array['registrar','pedago','admin']))
  );

-- ── enroll_in_session() : atomic capacity reservation (ENR-010) ────────────
-- Locks the session row so two concurrent calls for the last seat serialize;
-- the loser is waitlisted instead of both becoming active.
create or replace function public.enroll_in_session(
  p_session_id uuid,
  p_learner_id uuid default auth.uid(),
  p_source text default 'self'
)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.course_sessions;
  v_active_count integer;
  v_result public.enrollments;
  v_next_position integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_session from public.course_sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception 'Session not found';
  end if;
  if v_session.status not in ('draft','published','in_progress') then
    raise exception 'session_not_open';
  end if;

  -- self-service requires the caller to act for themself; staff can enroll others.
  if p_learner_id <> auth.uid() and not public.has_org_role(v_session.org_id, array['registrar','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  if exists (select 1 from public.enrollments where session_id = p_session_id and learner_id = p_learner_id and status = 'active') then
    select * into v_result from public.enrollments where session_id = p_session_id and learner_id = p_learner_id and status = 'active';
    return v_result;
  end if;

  select count(*) into v_active_count from public.enrollments where session_id = p_session_id and status = 'active';

  if v_session.capacity is null or v_active_count < v_session.capacity then
    insert into public.enrollments (org_id, session_id, learner_id, status, source)
    values (v_session.org_id, p_session_id, p_learner_id, 'active', p_source)
    returning * into v_result;
    insert into public.enrollment_history (enrollment_id, from_status, to_status, actor_id, source, reason)
    values (v_result.id, null, 'active', auth.uid(), p_source, 'enroll_in_session');
    perform public.emit_learning_event('enrollment.started', v_session.org_id, p_learner_id, 'enrollment', v_result.id, jsonb_build_object('session_id', p_session_id, 'source', p_source));
  else
    insert into public.enrollments (org_id, session_id, learner_id, status, source)
    values (v_session.org_id, p_session_id, p_learner_id, 'waitlisted', p_source)
    returning * into v_result;
    insert into public.enrollment_history (enrollment_id, from_status, to_status, actor_id, source, reason)
    values (v_result.id, null, 'waitlisted', auth.uid(), p_source, 'capacity_reached');
    select coalesce(max(position), 0) + 1 into v_next_position from public.waitlist_entries where session_id = p_session_id;
    insert into public.waitlist_entries (session_id, learner_id, position, status)
    values (p_session_id, p_learner_id, v_next_position, 'waiting');
    perform public.emit_learning_event('enrollment.waitlisted', v_session.org_id, p_learner_id, 'enrollment', v_result.id, jsonb_build_object('session_id', p_session_id, 'position', v_next_position));
  end if;

  return v_result;
end;
$$;

revoke all on function public.enroll_in_session(uuid, uuid, text) from public;
grant execute on function public.enroll_in_session(uuid, uuid, text) to authenticated;

-- ── transition_enrollment() : withdraw/cancel/complete, always audited ─────
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
  -- a learner may only withdraw themself, never mark completed/failed.
  if v_enrollment.learner_id = auth.uid() and not public.has_org_role(v_enrollment.org_id, array['registrar','pedago','admin']) and p_to_status <> 'withdrawn' then
    raise exception 'Not authorized';
  end if;

  update public.enrollments set status = p_to_status where id = p_enrollment_id returning * into v_result;
  insert into public.enrollment_history (enrollment_id, from_status, to_status, actor_id, source, reason)
  values (p_enrollment_id, v_enrollment.status, p_to_status, auth.uid(), 'manual', p_reason);

  return v_result;
end;
$$;

revoke all on function public.transition_enrollment(uuid, text, text) from public;
grant execute on function public.transition_enrollment(uuid, text, text) to authenticated;
