-- Solo quiz play history: one row per finished solo run, owner-only.

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_id text not null,
  quiz_title text not null,
  score integer not null default 0,
  total_questions integer not null default 0,
  correct_answers integer not null default 0,
  played_at timestamptz not null default now()
);

create index quiz_attempts_user_played_idx on public.quiz_attempts(user_id, played_at desc);

alter table public.quiz_attempts enable row level security;

create policy quiz_attempts_owner_read on public.quiz_attempts
  for select using (user_id = auth.uid());
create policy quiz_attempts_owner_insert on public.quiz_attempts
  for insert with check (user_id = auth.uid());
create policy quiz_attempts_owner_delete on public.quiz_attempts
  for delete using (user_id = auth.uid());
