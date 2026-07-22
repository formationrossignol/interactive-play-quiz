-- Persistent host <-> participant chat thread, replacing the one-shot
-- host_message/host_message_at columns (20260722120000_exam_host_controls.sql)
-- which only held the single most-recent message with no history and no
-- participant reply path. Dropped in favor of a proper message log.

alter table public.exam_attempts drop column host_message;
alter table public.exam_attempts drop column host_message_at;

create table public.exam_messages (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  sender text not null check (sender in ('host','participant')),
  body text not null,
  created_at timestamptz not null default now()
);
create index exam_messages_attempt_idx on public.exam_messages(attempt_id, created_at);

alter table public.exam_messages enable row level security;

-- host: read/write the thread for exams they own, any time (including
-- after the participant has submitted — a proctor may still want to
-- follow up).
create policy exam_messages_host_read on public.exam_messages
  for select using (exists (select 1 from public.exams e where e.id = exam_id and e.host_id = auth.uid()));
create policy exam_messages_host_insert on public.exam_messages
  for insert with check (
    sender = 'host'
    and exists (select 1 from public.exams e where e.id = exam_id and e.host_id = auth.uid())
  );

-- participant: same Tier 1 trust level as exam_attempts (client-generated
-- participant id, not auth.uid()) — read scoped to a published exam,
-- writes only while their attempt is still in-progress.
create policy exam_messages_participant_read on public.exam_messages
  for select using (
    exists (select 1 from public.exams e where e.id = exam_id
            and now() >= e.open_at and e.status not in ('draft','archived'))
  );
create policy exam_messages_participant_insert on public.exam_messages
  for insert with check (
    sender = 'participant'
    and exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.status = 'in-progress')
  );

-- Learned the hard way on exam_attempts (20260722130000): RLS is not
-- enough, a table also needs to be added to the realtime publication for
-- postgres_changes to ever fire. Doing it upfront here.
alter publication supabase_realtime add table public.exam_messages;
