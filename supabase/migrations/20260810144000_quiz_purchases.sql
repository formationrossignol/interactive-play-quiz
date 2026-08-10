create table if not exists public.quiz_purchases (
  id uuid primary key default gen_random_uuid(),
  quiz_id text not null,
  content_id uuid not null references public.content(id) on delete cascade,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  buyer_user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 100),
  currency text not null default 'eur' check (currency = 'eur'),
  stripe_checkout_session_id text unique,
  status text not null default 'pending' check (status in ('pending','paid','refunded')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (quiz_id, buyer_user_id)
);

alter table public.quiz_purchases enable row level security;

create policy quiz_purchases_buyer_read on public.quiz_purchases
  for select using (buyer_user_id = auth.uid() or creator_user_id = auth.uid());
