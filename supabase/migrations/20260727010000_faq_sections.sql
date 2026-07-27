-- Explicit FAQ sections for the admin editor. Questions retain their category
-- text for backward-compatible public reads; section rows persist ordering and
-- allow empty sections to exist before their first question is created.

create table if not exists public.faq_sections (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger faq_sections_touch before update on public.faq_sections
  for each row execute function public.touch_updated_at();

alter table public.faq_sections enable row level security;

create policy faq_sections_read on public.faq_sections
  for select using (true);
create policy faq_sections_write on public.faq_sections
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.faq_sections (title, sort)
select category, min(sort)
from public.faq_items
group by category
on conflict (title) do nothing;
