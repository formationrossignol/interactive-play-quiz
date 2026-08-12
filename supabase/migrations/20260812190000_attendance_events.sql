-- Spec 02 — Inscriptions, sessions et gestion des apprenants
-- (docs/product-specs/2026-08-10-lms-program/02-enrollment-roster.md).
--
-- RESTE-A-FAIRE.md §02: "`attendance_events` (présence) — dans le modèle
-- indicatif, non créé du tout." The spec's indicative model (line 111)
-- only says "présence déclarée/importée, facultatif V1" — no columns, no
-- RPC, no UI are specified anywhere else in the doc, and no ENR-xxx
-- requirement is dedicated to it (it only resurfaces as one input to the
-- not-yet-built completion policy: "activités obligatoires, score,
-- présence et durée éventuelle", line 150).
--
-- course_sessions has one starts_at/ends_at window and no concept of
-- individual meetings/seances/occurrences (confirmed: planning_events,
-- 20260812030000, is an unrelated personal-calendar table, not a session
-- occurrence model). Building a full occurrences table to attach
-- attendance to would be a separate, much bigger project the spec doesn't
-- ask for. Minimal unit that matches "déclarée/importée": one row per
-- (session, learner, calendar day) — a trainer marks a date's roster,
-- re-marking the same date upserts rather than accumulating history rows
-- (no correction-audit table either — the spec explicitly calls this
-- "facultatif V1", and every other table in this family that needed audit
-- history already has one; attendance doesn't get one invented here).
--
-- Write path: no direct client insert/update, same posture as
-- enroll_in_session()/extend_enrollment_due_date() before it — a trainer
-- marking their own session's roster isn't covered by any direct RLS write
-- policy anywhere in this table family (session_trainers_manage explicitly
-- excludes trainer, only registrar/pedago/admin get direct writes), so
-- record_attendance() checks registrar/pedago/admin OR "is a trainer of
-- this session" (session_trainers) itself, matching the spec's own
-- permissions text: trainer "voit ses sessions et les apprenants actifs".

create table public.attendance_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  session_id  uuid not null references public.course_sessions(id) on delete cascade,
  learner_id  uuid not null references auth.users(id) on delete cascade,
  occurred_on date not null,
  status      text not null check (status in ('present','absent','late','excused')),
  source      text not null default 'manual' check (source in ('manual','import')),
  note        text,
  recorded_by uuid not null references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (session_id, learner_id, occurred_on)
);
create index attendance_events_session_day_idx on public.attendance_events(session_id, occurred_on desc);
create index attendance_events_learner_idx on public.attendance_events(learner_id, occurred_on desc);
create trigger attendance_events_touch before update on public.attendance_events
  for each row execute function public.touch_updated_at();

alter table public.attendance_events enable row level security;

-- Same three-way shape as enrollments_read (20260810150000): self, org
-- staff roles, or a trainer assigned to this specific session.
create policy attendance_events_read on public.attendance_events
  for select using (
    learner_id = auth.uid()
    or public.has_org_role(org_id, array['registrar','pedago','admin'])
    or exists (select 1 from public.session_trainers t where t.session_id = attendance_events.session_id and t.user_id = auth.uid())
  );

-- ── record_attendance(): the only writer ────────────────────────────────
create or replace function public.record_attendance(
  p_session_id uuid,
  p_learner_id uuid,
  p_occurred_on date,
  p_status text,
  p_note text default null
)
returns public.attendance_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.course_sessions;
  v_row public.attendance_events;
begin
  select * into v_session from public.course_sessions where id = p_session_id;
  if v_session.id is null then
    raise exception 'session_not_found';
  end if;

  if not (
    public.has_org_role(v_session.org_id, array['registrar','pedago','admin'])
    or exists (select 1 from public.session_trainers t where t.session_id = p_session_id and t.user_id = auth.uid())
  ) then
    raise exception 'Not authorized';
  end if;

  if p_status not in ('present','absent','late','excused') then
    raise exception 'invalid_status: %', p_status;
  end if;

  if not exists (select 1 from public.enrollments e where e.session_id = p_session_id and e.learner_id = p_learner_id) then
    raise exception 'learner_not_enrolled';
  end if;

  insert into public.attendance_events (org_id, session_id, learner_id, occurred_on, status, source, note, recorded_by)
  values (v_session.org_id, p_session_id, p_learner_id, p_occurred_on, p_status, 'manual', p_note, auth.uid())
  on conflict (session_id, learner_id, occurred_on) do update set
    status = excluded.status,
    note = excluded.note,
    recorded_by = excluded.recorded_by,
    updated_at = now()
  returning * into v_row;

  perform public.emit_learning_event(
    'attendance.recorded', v_session.org_id, p_learner_id, 'attendance_event', v_row.id,
    jsonb_build_object('session_id', p_session_id, 'status', p_status, 'occurred_on', p_occurred_on)
  );

  return v_row;
end;
$$;

revoke all on function public.record_attendance(uuid, uuid, date, text, text) from public;
grant execute on function public.record_attendance(uuid, uuid, date, text, text) to authenticated;
