-- Organization-scoped community. Every thread, reply and reaction belongs to
-- exactly one organization through the parent thread; RLS prevents any
-- cross-tenant read or write even if an id is guessed client-side.

create table if not exists public.community_threads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(trim(author_name)) between 1 and 120),
  category text not null check (category in ('announcements','help','sharing','ideas')),
  title text not null check (char_length(trim(title)) between 3 and 180),
  body text not null default '' check (char_length(body) <= 12000),
  solved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_threads_org_created_idx
  on public.community_threads(org_id, created_at desc);

create table if not exists public.community_thread_likes (
  thread_id uuid not null references public.community_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create table if not exists public.community_thread_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.community_threads(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(trim(author_name)) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 12000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_thread_replies_thread_idx
  on public.community_thread_replies(thread_id, created_at);

drop trigger if exists community_threads_touch on public.community_threads;
create trigger community_threads_touch before update on public.community_threads
  for each row execute function public.touch_updated_at();

drop trigger if exists community_thread_replies_touch on public.community_thread_replies;
create trigger community_thread_replies_touch before update on public.community_thread_replies
  for each row execute function public.touch_updated_at();

alter table public.community_threads enable row level security;
alter table public.community_thread_likes enable row level security;
alter table public.community_thread_replies enable row level security;

create policy community_threads_member_read on public.community_threads
  for select using (
    public.has_org_role(org_id, array['learner','trainer','pedago','registrar','admin'])
  );

create policy community_threads_member_insert on public.community_threads
  for insert with check (
    author_user_id = auth.uid()
    and public.has_org_role(org_id, array['learner','trainer','pedago','registrar','admin'])
  );

create policy community_threads_author_update on public.community_threads
  for update using (
    author_user_id = auth.uid() or public.has_org_role(org_id, array['admin','pedago'])
  ) with check (
    public.has_org_role(org_id, array['learner','trainer','pedago','registrar','admin'])
    and (author_user_id = auth.uid() or public.has_org_role(org_id, array['admin','pedago']))
  );

create policy community_threads_author_delete on public.community_threads
  for delete using (
    author_user_id = auth.uid() or public.has_org_role(org_id, array['admin','pedago'])
  );

create policy community_likes_member_read on public.community_thread_likes
  for select using (
    exists (
      select 1 from public.community_threads thread
      where thread.id = community_thread_likes.thread_id
        and public.has_org_role(thread.org_id, array['learner','trainer','pedago','registrar','admin'])
    )
  );

create policy community_likes_member_insert on public.community_thread_likes
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.community_threads thread
      where thread.id = community_thread_likes.thread_id
        and public.has_org_role(thread.org_id, array['learner','trainer','pedago','registrar','admin'])
    )
  );

create policy community_likes_owner_delete on public.community_thread_likes
  for delete using (user_id = auth.uid());

create policy community_replies_member_read on public.community_thread_replies
  for select using (
    exists (
      select 1 from public.community_threads thread
      where thread.id = community_thread_replies.thread_id
        and public.has_org_role(thread.org_id, array['learner','trainer','pedago','registrar','admin'])
    )
  );

create policy community_replies_member_insert on public.community_thread_replies
  for insert with check (
    author_user_id = auth.uid()
    and exists (
      select 1 from public.community_threads thread
      where thread.id = community_thread_replies.thread_id
        and public.has_org_role(thread.org_id, array['learner','trainer','pedago','registrar','admin'])
    )
  );

create policy community_replies_author_update on public.community_thread_replies
  for update using (author_user_id = auth.uid())
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1 from public.community_threads thread
      where thread.id = community_thread_replies.thread_id
        and public.has_org_role(thread.org_id, array['learner','trainer','pedago','registrar','admin'])
    )
  );

create policy community_replies_author_delete on public.community_thread_replies
  for delete using (author_user_id = auth.uid());
