-- SCORM 1.2 / 2004 runtime tracking: one row per learner per lesson,
-- upserted each session (mirrors CourseProgress, not an attempt-history log).
-- See docs/superpowers/specs/2026-07-28-scorm-support-design.md.

create table public.scorm_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.content(id) on delete cascade,
  lesson_id text not null,
  scorm_version text not null check (scorm_version in ('1.2','2004')),
  lesson_status text,
  completion_status text,
  success_status text,
  score_raw numeric,
  score_min numeric,
  score_max numeric,
  score_scaled numeric,
  progress_measure numeric,
  total_time text,
  suspend_data text,
  entry text,
  exit text,
  attempt_count integer not null default 1,
  interactions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, course_id, lesson_id)
);

create index scorm_tracking_course_idx on public.scorm_tracking(course_id);

alter table public.scorm_tracking enable row level security;

-- Learner: full CRUD on their own row.
-- Tier 1 scope: any authenticated user may write a row against any existing
-- course_id — enrollment/share access-scoping on the course is deliberately
-- deferred for v1.
create policy scorm_tracking_owner on public.scorm_tracking
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Course owner: read-only access to every learner's row for their own course,
-- for the reporting page.
create policy scorm_tracking_course_owner_read on public.scorm_tracking
  for select using (
    exists (select 1 from public.content c
            where c.id = course_id and c.user_id = auth.uid())
  );

create trigger scorm_tracking_touch before update on public.scorm_tracking
  for each row execute function public.touch_updated_at();
