-- H5P packages and learner tracking.

insert into storage.buckets (id, name, public, file_size_limit)
values ('h5p-packages', 'h5p-packages', true, 104857600)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

create policy h5p_packages_owner_insert on storage.objects
  for insert
  with check (
    bucket_id = 'h5p-packages'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy h5p_packages_owner_update on storage.objects
  for update
  using (
    bucket_id = 'h5p-packages'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'h5p-packages'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy h5p_packages_owner_delete on storage.objects
  for delete
  using (
    bucket_id = 'h5p-packages'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy h5p_packages_public_read on storage.objects
  for select
  using (bucket_id = 'h5p-packages');

create table public.h5p_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null,
  lesson_id text not null,
  package_id text not null,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'completed', 'passed', 'failed')),
  score_raw numeric,
  score_max numeric,
  score_scaled numeric,
  progress integer not null default 0 check (progress between 0 and 100),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  state jsonb,
  last_statement jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_accessed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id, lesson_id)
);

create index h5p_tracking_course_lesson_idx
  on public.h5p_tracking(course_id, lesson_id);
create index h5p_tracking_user_access_idx
  on public.h5p_tracking(user_id, last_accessed_at desc);

alter table public.h5p_tracking enable row level security;

create policy h5p_tracking_learner_read on public.h5p_tracking
  for select using (user_id = auth.uid());

create policy h5p_tracking_learner_insert on public.h5p_tracking
  for insert with check (user_id = auth.uid());

create policy h5p_tracking_learner_update on public.h5p_tracking
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Course owners can consult learner results for reporting. Courses are mirrored
-- in public.content with their local course id in source_id.
create policy h5p_tracking_course_owner_read on public.h5p_tracking
  for select using (
    exists (
      select 1
      from public.content c
      where c.type = 'course'
        and c.source_id = h5p_tracking.course_id
        and c.user_id = auth.uid()
    )
  );

create or replace function public.set_h5p_tracking_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger h5p_tracking_set_updated_at
before update on public.h5p_tracking
for each row execute function public.set_h5p_tracking_updated_at();
