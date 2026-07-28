-- Storage bucket for imported SCORM package assets. Public read so the
-- Vercel same-origin rewrite (/scorm-content/...) can proxy objects without
-- an auth header. Path convention: <user_id>/<package_id>/<relative_path>.
insert into storage.buckets (id, name, public)
values ('scorm-packages', 'scorm-packages', true)
on conflict (id) do nothing;

create policy scorm_packages_owner_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'scorm-packages' and (storage.foldername(name))[1] = auth.uid()::text);

create policy scorm_packages_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'scorm-packages' and (storage.foldername(name))[1] = auth.uid()::text);

create policy scorm_packages_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'scorm-packages' and (storage.foldername(name))[1] = auth.uid()::text);

create policy scorm_packages_public_read on storage.objects
  for select using (bucket_id = 'scorm-packages');
