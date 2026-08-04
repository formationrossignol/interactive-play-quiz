-- supabase/migrations/20260804120000_avatars_bucket.sql
-- Storage bucket for profile avatar photos. The URL is stored in
-- auth.users.user_metadata.avatarUrl (same convention as username/theme/
-- siteTheme — see updateProfile in lib/auth.ts), not a new profiles column.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Owner-only write, keyed by the first path segment being the uploader's
-- user id (path convention: <user_id>/avatar.<ext>).
create policy avatars_owner_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Public read (bucket is public=true above, but an explicit select policy
-- keeps behavior consistent if the bucket is ever flipped to private).
create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');
