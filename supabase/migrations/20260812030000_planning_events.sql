-- Personal planning (apps/app/src/pages/PlanningPage.tsx) has been
-- localStorage-only since it was built — keyed by `planning-events-${userId}`,
-- so an event created on one device is invisible on any other (the exact
-- "private data isn't private across devices" pattern AUDIT_CODE.md flagged
-- for this app's domain data generally). Manual events (meetings etc.) get a
-- real owner-scoped table; the calendar itself keeps merging in real
-- assignment due dates client-side (no new table needed for that half —
-- assignments already carry due_at).
create table public.planning_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title      text not null check (char_length(title) between 1 and 200),
  kind       text not null check (kind in ('quiz','course','exam','meeting')),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null check (ends_at >= starts_at),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index planning_events_user_idx on public.planning_events(user_id, starts_at);

create trigger planning_events_touch before update on public.planning_events
  for each row execute function public.touch_updated_at();

alter table public.planning_events enable row level security;

create policy planning_events_owner on public.planning_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
