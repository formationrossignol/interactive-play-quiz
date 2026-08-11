-- Course completion certificates were entirely self-issued: certificates.
-- certificates_owner_insert let any authenticated client insert its own
-- row with a client-supplied course_title/total_lessons — nothing checked
-- the course was ever actually completed (AUDIT_CODE.md flagged this
-- explicitly: "génération purement cliente, aucune vérification/anti-
-- fraude"; RESTE-A-FAIRE.md's Réconciliation section confirms it, and
-- notes it needs its own model rather than a quick patch — this migration
-- is that model, scoped to what's actually verifiable today).
--
-- The legacy course builder (CourseBuilder/CourseViewer) has no
-- server-side course definition at all — modules/lessons are authored and
-- stored client-side (courseStorage.ts), mirrored into `content` only as
-- an opaque JSON blob. So this cannot verify "the course itself is real"
-- (there is no server truth for that) — it can only verify "this learner
-- has a genuine, timestamped, per-lesson completion record", which is a
-- real step up from zero verification. Not claiming more than that.

create table public.course_lesson_progress (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  course_id    text not null,
  lesson_id    text not null,
  completed_at timestamptz not null default now(),
  unique (user_id, course_id, lesson_id)
);
create index course_lesson_progress_user_course_idx on public.course_lesson_progress(user_id, course_id);

alter table public.course_lesson_progress enable row level security;

create policy course_lesson_progress_owner on public.course_lesson_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The client can no longer insert its own certificate row directly — only
-- issue_course_certificate() below writes to this table now.
drop policy if exists certificates_owner_insert on public.certificates;

-- course_id is a client-generated 8-char slug (courseStorage.ts's genId()),
-- not a uuid — matches the existing certificates.course_id text column.
create or replace function public.issue_course_certificate(
  p_course_id text,
  p_course_title text,
  p_learner_name text,
  p_total_lessons integer
)
returns public.certificates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completed_count integer;
  v_result public.certificates;
begin
  if p_total_lessons <= 0 then
    raise exception 'A course must have at least one lesson to certify';
  end if;

  select count(distinct lesson_id) into v_completed_count
  from public.course_lesson_progress
  where user_id = auth.uid() and course_id = p_course_id;

  if v_completed_count < p_total_lessons then
    raise exception 'Not all lessons are completed server-side (% of % recorded)', v_completed_count, p_total_lessons;
  end if;

  insert into public.certificates (user_id, course_id, course_title, learner_name, total_lessons, certificate_number)
  values (
    auth.uid(), p_course_id, p_course_title, p_learner_name, p_total_lessons,
    'BRV-' || upper(left(p_course_id, 6)) || '-' || upper(left(auth.uid()::text, 6))
  )
  on conflict (user_id, course_id) do update set
    course_title = excluded.course_title,
    learner_name = excluded.learner_name,
    total_lessons = excluded.total_lessons
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.issue_course_certificate(text, text, text, integer) from public;
grant execute on function public.issue_course_certificate(text, text, text, integer) to authenticated;
