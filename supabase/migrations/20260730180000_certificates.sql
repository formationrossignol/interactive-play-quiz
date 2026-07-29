-- Course completion certificates: one row per learner per completed course,
-- owner-only. Previously certificates were generated client-side on the fly
-- (CourseCertificateDialog) with nothing persisted, so there was no way to
-- list past certificates.

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null,
  course_title text not null,
  learner_name text not null,
  total_lessons integer not null default 0,
  certificate_number text not null,
  issued_at timestamptz not null default now()
);

create unique index certificates_user_course_idx on public.certificates(user_id, course_id);
create index certificates_user_issued_idx on public.certificates(user_id, issued_at desc);

alter table public.certificates enable row level security;

create policy certificates_owner_read on public.certificates
  for select using (user_id = auth.uid());
create policy certificates_owner_insert on public.certificates
  for insert with check (user_id = auth.uid());
