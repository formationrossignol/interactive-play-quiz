-- Pages CMS interactions (SP2): visitor writes (login required), DB-only.

-- ── roadmap_votes : 1 vote per (user,item), global quota of 3 ───────────────
create table public.roadmap_votes (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.roadmap_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index roadmap_votes_item_idx on public.roadmap_votes(item_id);

create or replace function public.enforce_vote_quota()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.roadmap_votes where user_id = new.user_id) >= 3 then
    raise exception 'vote quota exceeded' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger roadmap_votes_quota before insert on public.roadmap_votes
  for each row execute function public.enforce_vote_quota();

-- ── roadmap_ideas : free-text proposal, moderated in SP3 ────────────────────
create table public.roadmap_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  status text not null default 'pending' check (status in ('pending','converted','rejected')),
  created_at timestamptz not null default now()
);
create index roadmap_ideas_user_idx on public.roadmap_ideas(user_id);

-- ── reports : support ticket ────────────────────────────────────────────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('bug','question','billing')),
  severity int not null check (severity in (1,2,3)),
  title text not null,
  body text not null default '',
  status text not null default 'open' check (status in ('open','in_progress','waiting','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reports_user_idx on public.reports(user_id);
create trigger reports_touch before update on public.reports
  for each row execute function public.touch_updated_at();

-- ── changelog_subscribers : toggle (email comes from the account) ───────────
create table public.changelog_subscribers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ── public vote-count view ──────────────────────────────────────────────────
create view public.roadmap_vote_counts as
  select item_id, count(*)::int as votes
  from public.roadmap_votes
  group by item_id;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.roadmap_votes         enable row level security;
alter table public.roadmap_ideas         enable row level security;
alter table public.reports               enable row level security;
alter table public.changelog_subscribers enable row level security;

create policy roadmap_votes_read on public.roadmap_votes for select using (true);
create policy roadmap_votes_insert on public.roadmap_votes
  for insert with check (auth.uid() = user_id);
create policy roadmap_votes_delete on public.roadmap_votes
  for delete using (auth.uid() = user_id);

create policy roadmap_ideas_owner on public.roadmap_ideas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy roadmap_ideas_admin_read on public.roadmap_ideas
  for select using (public.is_admin());

create policy reports_owner on public.reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy reports_admin on public.reports
  for all using (public.is_admin()) with check (public.is_admin());

create policy changelog_subscribers_owner on public.changelog_subscribers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- reviews (created in SP1): visitor insert, forced pending and attributed to self.
create policy reviews_insert_self on public.reviews
  for insert with check (auth.uid() = author_user_id and status = 'pending');
