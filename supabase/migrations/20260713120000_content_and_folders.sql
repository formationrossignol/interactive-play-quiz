-- Content organization: polymorphic content table + recursive folders + async poll responses.
-- All tables are per-user with RLS. Content is a JSON blob discriminated by `type`,
-- mirroring the existing localStorage model (quiz/poll/flashcard/exam/course).

-- ── folders : recursive tree per user and per content type ──────────────────
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('quiz','poll','flashcard','exam','course')),
  name text not null,
  parent_id uuid references public.folders(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index folders_user_type_idx on public.folders(user_id, type);
create index folders_parent_idx on public.folders(parent_id);

-- ── content : polymorphic blob ─────────────────────────────────────────────
create table public.content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('quiz','poll','flashcard','exam','course')),
  folder_id uuid references public.folders(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  is_open boolean not null default false,      -- async polls (chantier 5)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_user_type_idx on public.content(user_id, type);
create index content_folder_idx on public.content(folder_id);

-- ── poll_responses : anonymous async poll answers (chantier 5) ─────────────
create table public.poll_responses (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content(id) on delete cascade,
  answers jsonb not null,
  created_at timestamptz not null default now()
);
create index poll_responses_content_idx on public.poll_responses(content_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.folders enable row level security;
alter table public.content enable row level security;
alter table public.poll_responses enable row level security;

-- folders : owner only
create policy folders_owner on public.folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- content : owner full CRUD ; public read when is_public OR is_open
create policy content_owner on public.content
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy content_public_read on public.content
  for select using (is_public = true or is_open = true);

-- poll_responses : anonymous insert only when the poll is open ; owner reads its own
create policy poll_responses_insert_open on public.poll_responses
  for insert with check (
    exists (select 1 from public.content c
            where c.id = content_id and c.type = 'poll' and c.is_open = true)
  );
create policy poll_responses_owner_read on public.poll_responses
  for select using (
    exists (select 1 from public.content c
            where c.id = content_id and c.user_id = auth.uid())
  );

-- ── updated_at trigger ─────────────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger content_touch before update on public.content
  for each row execute function public.touch_updated_at();
