-- Idempotency hardening for the localStorage->Supabase import.
-- source_id stores the item's/folder's original localStorage id. A partial
-- unique index on (user_id, source_id) lets the import upsert instead of
-- insert, so a repeated run can never create duplicate rows.

alter table public.content add column if not exists source_id text;
alter table public.folders add column if not exists source_id text;

create unique index if not exists content_user_source_uidx
  on public.content(user_id, source_id) where source_id is not null;

create unique index if not exists folders_user_source_uidx
  on public.folders(user_id, source_id) where source_id is not null;
