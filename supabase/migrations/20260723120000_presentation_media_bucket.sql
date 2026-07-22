-- supabase/migrations/20260723120000_presentation_media_bucket.sql
-- Storage bucket for presentation-editor image/video uploads. URLs are
-- stored in ImageElement/VideoElement.src; raw bytes never go in content.data.
insert into storage.buckets (id, name, public)
values ('presentation-media', 'presentation-media', true)
on conflict (id) do nothing;

-- Owner-only write, keyed by the first path segment being the uploader's user id
-- (path convention: <user_id>/<presentation_id>/<element_id>.<ext>).
create policy presentation_media_owner_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'presentation-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy presentation_media_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'presentation-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy presentation_media_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'presentation-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Public read (bucket is public=true above, but an explicit select policy
-- keeps behavior consistent if the bucket is ever flipped to private).
create policy presentation_media_public_read on storage.objects
  for select using (bucket_id = 'presentation-media');
