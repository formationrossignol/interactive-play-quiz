-- Static pages CMS: admin-editable legal + marketing pages
-- (cgu, confidentialite, mentions-legales, features, about).
-- Content source-of-truth lives in code (staticPageDefaults.ts); rows here
-- overlay those defaults once an admin edits a page. No seed required —
-- pages render from defaults until a row exists.

create table public.static_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null default '',
  subtitle text not null default '',
  body text not null default '',          -- sanitized HTML (legal pages, About mission)
  blocks jsonb not null default '[]'::jsonb, -- [{title, desc}] icon cards (Features / About)
  status text not null default 'published' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger static_pages_touch before update on public.static_pages
  for each row execute function public.touch_updated_at();

alter table public.static_pages enable row level security;

-- Published pages world-readable; writes admin-only (mirrors other CMS tables).
create policy static_pages_read on public.static_pages
  for select using (status = 'published' or public.is_admin());
create policy static_pages_write on public.static_pages
  for all using (public.is_admin()) with check (public.is_admin());
