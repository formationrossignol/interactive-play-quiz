-- Spec 01 — Devoirs, remises et carnet de notes unifié
-- (docs/product-specs/2026-08-10-lms-program/01-assignments-gradebook.md).
--
-- Extends existing grading rather than replacing it: `manual_evaluations`
-- (manual_grading.sql) becomes one grade_items.source_type alongside
-- 'assignment', 'quiz', 'exam' and 'scorm'.

-- ── assignments ─────────────────────────────────────────────────────────
create table public.assignments (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  course_content_id  uuid references public.content(id) on delete set null,
  session_id         uuid references public.course_sessions(id) on delete set null,
  owner_id           uuid not null references auth.users(id),
  title              text not null check (char_length(trim(title)) between 1 and 200),
  instructions       text not null default '',
  response_mode      text not null check (response_mode in ('text','file','url','audio','video','none','combo')),
  open_at            timestamptz,
  due_at             timestamptz,
  close_at           timestamptz,
  max_points         numeric(12,4) not null default 20,
  weight             numeric(8,3) not null default 1 check (weight > 0),
  allowed_attempts   integer not null default 1 check (allowed_attempts > 0),
  policy             jsonb not null default '{}'::jsonb,
  status             text not null default 'draft' check (status in ('draft','published')),
  published_version  integer not null default 1,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index assignments_org_idx on public.assignments(org_id);
create index assignments_session_idx on public.assignments(session_id);
create trigger assignments_touch before update on public.assignments
  for each row execute function public.touch_updated_at();

create table public.assignment_targets (
  id           uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  target_type  text not null check (target_type in ('session','group','learner')),
  target_id    uuid not null,
  due_override timestamptz
);
create index assignment_targets_assignment_idx on public.assignment_targets(assignment_id);

-- security definer: this is read from inside assignment_targets_learner_read
-- below (a policy on the very table this function queries) — as invoker it
-- would recurse into that same policy for every candidate row and blow the
-- stack (same trap as live_engagement's is_live_event_staff), so it must
-- run as the table owner, who bypasses RLS.
create or replace function public.assignment_visible_to_learner(p_assignment_id uuid, p_learner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.assignment_targets t
    where t.assignment_id = p_assignment_id
      and (
        (t.target_type = 'learner' and t.target_id = p_learner_id)
        or (t.target_type = 'group' and exists (select 1 from public.share_group_members gm where gm.group_id = t.target_id and gm.user_id = p_learner_id))
        or (t.target_type = 'session' and exists (select 1 from public.enrollments e where e.session_id = t.target_id and e.learner_id = p_learner_id and e.status = 'active'))
      )
  );
$$;

-- ── submissions ─────────────────────────────────────────────────────────
create table public.submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  learner_id    uuid not null references auth.users(id) on delete cascade,
  group_id      uuid references public.share_groups(id) on delete set null,
  status        text not null default 'draft' check (status in ('draft','submitted','late','returned','resubmission_requested','graded','excused','void')),
  active_version integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (assignment_id, learner_id)
);
create index submissions_assignment_idx on public.submissions(assignment_id);
create trigger submissions_touch before update on public.submissions
  for each row execute function public.touch_updated_at();

-- SUB-003: previous versions are never deleted, only superseded.
create table public.submission_versions (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  version       integer not null,
  kind          text not null check (kind in ('text','file','url','audio','video')),
  text_content  text,
  url           text,
  is_draft      boolean not null default false,
  is_late       boolean not null default false,
  submitted_at  timestamptz not null default now(),
  unique (submission_id, version)
);
create index submission_versions_submission_idx on public.submission_versions(submission_id, version desc);

create table public.submission_files (
  id                    uuid primary key default gen_random_uuid(),
  submission_version_id uuid not null references public.submission_versions(id) on delete cascade,
  storage_path          text not null,
  file_name             text not null,
  mime_type             text,
  size_bytes            bigint,
  sha256                text,
  scan_status           text not null default 'pending' check (scan_status in ('pending','clean','rejected')),
  created_at            timestamptz not null default now()
);
create index submission_files_version_idx on public.submission_files(submission_version_id);

-- ── rubrics ─────────────────────────────────────────────────────────────
create table public.rubrics (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  owner_id   uuid not null references auth.users(id),
  title      text not null check (char_length(trim(title)) between 1 and 160),
  is_template boolean not null default true,
  created_at timestamptz not null default now()
);
create index rubrics_org_idx on public.rubrics(org_id);

create table public.rubric_criteria (
  id          uuid primary key default gen_random_uuid(),
  rubric_id   uuid not null references public.rubrics(id) on delete cascade,
  label       text not null,
  description text not null default '',
  position    integer not null default 0,
  max_points  numeric(12,4) not null default 0
);
create index rubric_criteria_rubric_idx on public.rubric_criteria(rubric_id, position);

create table public.rubric_levels (
  id          uuid primary key default gen_random_uuid(),
  criterion_id uuid not null references public.rubric_criteria(id) on delete cascade,
  label       text not null,
  points      numeric(12,4) not null default 0,
  position    integer not null default 0
);
create index rubric_levels_criterion_idx on public.rubric_levels(criterion_id, position);

-- ── correction ──────────────────────────────────────────────────────────
create table public.submission_assessments (
  id                    uuid primary key default gen_random_uuid(),
  submission_id         uuid not null references public.submissions(id) on delete cascade,
  submission_version_id uuid not null references public.submission_versions(id),
  grader_id             uuid not null references auth.users(id),
  rubric_id             uuid references public.rubrics(id),
  score                 numeric(12,4),
  feedback              text not null default '',
  status                text not null default 'draft' check (status in ('draft','published')),
  is_anonymous          boolean not null default false,
  published_at          timestamptz,
  created_at            timestamptz not null default now()
);
create index submission_assessments_submission_idx on public.submission_assessments(submission_id);

create table public.rubric_ratings (
  id           uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.submission_assessments(id) on delete cascade,
  criterion_id uuid not null references public.rubric_criteria(id),
  level_id     uuid references public.rubric_levels(id),
  points       numeric(12,4) not null default 0,
  comment      text not null default ''
);
create index rubric_ratings_assessment_idx on public.rubric_ratings(assessment_id);

-- ── gradebook : unified registry across assignment/quiz/exam/manual/scorm ──
create table public.grade_items (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  session_id  uuid references public.course_sessions(id) on delete set null,
  source_type text not null check (source_type in ('assignment','quiz','exam','manual','scorm','h5p')),
  source_id   uuid not null,
  title       text not null,
  category    text not null default 'general',
  weight      numeric(8,3) not null default 1 check (weight > 0),
  max_points  numeric(12,4) not null,
  created_at  timestamptz not null default now(),
  unique (source_type, source_id)
);
create index grade_items_org_idx on public.grade_items(org_id);
create index grade_items_session_idx on public.grade_items(session_id);

create table public.grade_results (
  id            uuid primary key default gen_random_uuid(),
  grade_item_id uuid not null references public.grade_items(id) on delete cascade,
  learner_id    uuid not null references auth.users(id) on delete cascade,
  status        text not null check (status in ('graded','excused','missing','not_graded')),
  points        numeric(12,4),
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (grade_item_id, learner_id)
);
create index grade_results_learner_idx on public.grade_results(learner_id);
create trigger grade_results_touch before update on public.grade_results
  for each row execute function public.touch_updated_at();

-- GRD-006: any revision of a published grade requires a reason and keeps before/after.
create table public.grade_revisions (
  id              uuid primary key default gen_random_uuid(),
  grade_result_id uuid not null references public.grade_results(id) on delete cascade,
  previous_points numeric(12,4),
  new_points      numeric(12,4),
  previous_status text,
  new_status      text not null,
  reason          text not null,
  author_id       uuid not null references auth.users(id),
  created_at      timestamptz not null default now()
);
create index grade_revisions_result_idx on public.grade_revisions(grade_result_id, created_at);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.assignments enable row level security;
alter table public.assignment_targets enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_versions enable row level security;
alter table public.submission_files enable row level security;
alter table public.rubrics enable row level security;
alter table public.rubric_criteria enable row level security;
alter table public.rubric_levels enable row level security;
alter table public.submission_assessments enable row level security;
alter table public.rubric_ratings enable row level security;
alter table public.grade_items enable row level security;
alter table public.grade_results enable row level security;
alter table public.grade_revisions enable row level security;

create policy assignments_staff_read on public.assignments
  for select using (public.has_org_role(org_id, array['trainer','pedago','registrar','admin']));
create policy assignments_learner_read on public.assignments
  for select using (status = 'published' and public.assignment_visible_to_learner(id, auth.uid()));
create policy assignments_insert on public.assignments
  for insert with check (owner_id = auth.uid() and public.has_org_role(org_id, array['trainer','pedago','admin']));
create policy assignments_update on public.assignments
  for update using (owner_id = auth.uid() or public.has_org_role(org_id, array['pedago','admin']))
  with check (owner_id = auth.uid() or public.has_org_role(org_id, array['pedago','admin']));
create policy assignments_delete on public.assignments
  for delete using (owner_id = auth.uid() or public.has_org_role(org_id, array['pedago','admin']));

create policy assignment_targets_staff_read on public.assignment_targets
  for select using (
    exists (select 1 from public.assignments a where a.id = assignment_id and public.has_org_role(a.org_id, array['trainer','pedago','registrar','admin']))
  );
create policy assignment_targets_learner_read on public.assignment_targets
  for select using (public.assignment_visible_to_learner(assignment_id, auth.uid()));
create policy assignment_targets_manage on public.assignment_targets
  for all using (
    exists (select 1 from public.assignments a where a.id = assignment_id and (a.owner_id = auth.uid() or public.has_org_role(a.org_id, array['pedago','admin'])))
  )
  with check (
    exists (select 1 from public.assignments a where a.id = assignment_id and (a.owner_id = auth.uid() or public.has_org_role(a.org_id, array['pedago','admin'])))
  );

-- submissions/versions/files: learner reads/manages their own; trainer/pedago/
-- admin read for grading. registrar is deliberately excluded (ASG spec:
-- statuses/grades only, no confidential submission content).
create policy submissions_owner on public.submissions
  for select using (learner_id = auth.uid());
create policy submissions_staff_read on public.submissions
  for select using (
    exists (select 1 from public.assignments a where a.id = assignment_id and public.has_org_role(a.org_id, array['trainer','pedago','admin']))
  );

create policy submission_versions_owner on public.submission_versions
  for select using (exists (select 1 from public.submissions s where s.id = submission_id and s.learner_id = auth.uid()));
create policy submission_versions_staff_read on public.submission_versions
  for select using (
    exists (
      select 1 from public.submissions s join public.assignments a on a.id = s.assignment_id
      where s.id = submission_id and public.has_org_role(a.org_id, array['trainer','pedago','admin'])
    )
  );

create policy submission_files_owner on public.submission_files
  for select using (
    exists (
      select 1 from public.submission_versions v join public.submissions s on s.id = v.submission_id
      where v.id = submission_version_id and s.learner_id = auth.uid()
    )
  );
create policy submission_files_staff_read on public.submission_files
  for select using (
    exists (
      select 1 from public.submission_versions v
      join public.submissions s on s.id = v.submission_id
      join public.assignments a on a.id = s.assignment_id
      where v.id = submission_version_id and public.has_org_role(a.org_id, array['trainer','pedago','admin'])
    )
  );

create policy rubrics_read on public.rubrics
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));
create policy rubrics_manage on public.rubrics
  for all using (owner_id = auth.uid() or public.has_org_role(org_id, array['pedago','admin']))
  with check (owner_id = auth.uid() or public.has_org_role(org_id, array['pedago','admin']));

create policy rubric_criteria_read on public.rubric_criteria
  for select using (exists (select 1 from public.rubrics r where r.id = rubric_id and public.has_org_role(r.org_id, array['trainer','pedago','admin'])));
create policy rubric_criteria_manage on public.rubric_criteria
  for all using (exists (select 1 from public.rubrics r where r.id = rubric_id and (r.owner_id = auth.uid() or public.has_org_role(r.org_id, array['pedago','admin']))))
  with check (exists (select 1 from public.rubrics r where r.id = rubric_id and (r.owner_id = auth.uid() or public.has_org_role(r.org_id, array['pedago','admin']))));

create policy rubric_levels_read on public.rubric_levels
  for select using (exists (select 1 from public.rubric_criteria c join public.rubrics r on r.id = c.rubric_id where c.id = criterion_id and public.has_org_role(r.org_id, array['trainer','pedago','admin'])));
create policy rubric_levels_manage on public.rubric_levels
  for all using (exists (select 1 from public.rubric_criteria c join public.rubrics r on r.id = c.rubric_id where c.id = criterion_id and (r.owner_id = auth.uid() or public.has_org_role(r.org_id, array['pedago','admin']))))
  with check (exists (select 1 from public.rubric_criteria c join public.rubrics r on r.id = c.rubric_id where c.id = criterion_id and (r.owner_id = auth.uid() or public.has_org_role(r.org_id, array['pedago','admin']))));

create policy submission_assessments_staff_read on public.submission_assessments
  for select using (
    exists (select 1 from public.submissions s join public.assignments a on a.id = s.assignment_id where s.id = submission_id and public.has_org_role(a.org_id, array['trainer','pedago','admin']))
  );
create policy submission_assessments_learner_read on public.submission_assessments
  for select using (
    status = 'published' and exists (select 1 from public.submissions s where s.id = submission_id and s.learner_id = auth.uid())
  );

create policy rubric_ratings_staff_read on public.rubric_ratings
  for select using (
    exists (
      select 1 from public.submission_assessments sa join public.submissions s on s.id = sa.submission_id join public.assignments a on a.id = s.assignment_id
      where sa.id = assessment_id and public.has_org_role(a.org_id, array['trainer','pedago','admin'])
    )
  );
create policy rubric_ratings_learner_read on public.rubric_ratings
  for select using (
    exists (
      select 1 from public.submission_assessments sa join public.submissions s on s.id = sa.submission_id
      where sa.id = assessment_id and sa.status = 'published' and s.learner_id = auth.uid()
    )
  );

create policy grade_items_staff_read on public.grade_items
  for select using (public.has_org_role(org_id, array['trainer','pedago','registrar','admin']));
create policy grade_items_learner_read on public.grade_items
  for select using (exists (select 1 from public.grade_results gr where gr.grade_item_id = id and gr.learner_id = auth.uid()));

create policy grade_results_staff_read on public.grade_results
  for select using (exists (select 1 from public.grade_items gi where gi.id = grade_item_id and public.has_org_role(gi.org_id, array['trainer','pedago','registrar','admin'])));
create policy grade_results_learner_read on public.grade_results
  for select using (learner_id = auth.uid() and published_at is not null);

create policy grade_revisions_staff_read on public.grade_revisions
  for select using (
    exists (select 1 from public.grade_results gr join public.grade_items gi on gi.id = gr.grade_item_id where gr.id = grade_result_id and public.has_org_role(gi.org_id, array['trainer','pedago','admin']))
  );

-- ── submit_assignment() : atomic draft-save / finalize, server-side late check ──
create or replace function public.submit_assignment(
  p_assignment_id uuid,
  p_kind text,
  p_text_content text default null,
  p_url text default null,
  p_finalize boolean default true
)
returns public.submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.assignments;
  v_submission public.submissions;
  v_due timestamptz;
  v_next_version integer;
  v_is_late boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_assignment from public.assignments where id = p_assignment_id and status = 'published';
  if v_assignment.id is null then
    raise exception 'Assignment not found';
  end if;
  if not public.assignment_visible_to_learner(p_assignment_id, auth.uid()) then
    raise exception 'Not authorized';
  end if;

  insert into public.submissions (assignment_id, learner_id, status)
  values (p_assignment_id, auth.uid(), 'draft')
  on conflict (assignment_id, learner_id) do update set assignment_id = excluded.assignment_id
  returning * into v_submission;

  if v_submission.status in ('graded','void') then
    raise exception 'submission_locked';
  end if;

  -- ASG-004: a per-learner target override wins over the assignment default.
  select due_override into v_due
  from public.assignment_targets
  where assignment_id = p_assignment_id and target_type = 'learner' and target_id = auth.uid() and due_override is not null
  limit 1;
  v_due := coalesce(v_due, v_assignment.due_at);

  if p_finalize then
    v_is_late := v_due is not null and now() > v_due;
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version from public.submission_versions where submission_id = v_submission.id;

  insert into public.submission_versions (submission_id, version, kind, text_content, url, is_draft, is_late, submitted_at)
  values (v_submission.id, v_next_version, p_kind, p_text_content, p_url, not p_finalize, v_is_late, now());

  update public.submissions
  set active_version = v_next_version,
      status = case when not p_finalize then 'draft' when v_is_late then 'late' else 'submitted' end
  where id = v_submission.id
  returning * into v_submission;

  if p_finalize then
    perform public.emit_learning_event('submission.submitted', v_assignment.org_id, auth.uid(), 'submission', v_submission.id, jsonb_build_object('assignment_id', p_assignment_id, 'late', v_is_late));
  end if;

  return v_submission;
end;
$$;

revoke all on function public.submit_assignment(uuid, text, text, text, boolean) from public;
grant execute on function public.submit_assignment(uuid, text, text, text, boolean) to authenticated;

-- ── publish_submission_grade() : atomic correction + gradebook + audit ─────
create or replace function public.publish_submission_grade(
  p_submission_id uuid,
  p_score numeric,
  p_feedback text default '',
  p_rubric_id uuid default null,
  p_rubric_ratings jsonb default '[]'::jsonb,
  p_reason text default null
)
returns public.submission_assessments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.submissions;
  v_assignment public.assignments;
  v_assessment public.submission_assessments;
  v_grade_item public.grade_items;
  v_existing_result public.grade_results;
  v_rating jsonb;
begin
  select * into v_submission from public.submissions where id = p_submission_id for update;
  if v_submission.id is null then
    raise exception 'Submission not found';
  end if;
  select * into v_assignment from public.assignments where id = v_submission.assignment_id;
  if not public.has_org_role(v_assignment.org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  insert into public.submission_assessments (submission_id, submission_version_id, grader_id, rubric_id, score, feedback, status, published_at)
  values (p_submission_id, (select id from public.submission_versions where submission_id = p_submission_id order by version desc limit 1), auth.uid(), p_rubric_id, p_score, p_feedback, 'published', now())
  returning * into v_assessment;

  for v_rating in select * from jsonb_array_elements(coalesce(p_rubric_ratings, '[]'::jsonb))
  loop
    insert into public.rubric_ratings (assessment_id, criterion_id, level_id, points, comment)
    values (v_assessment.id, (v_rating->>'criterion_id')::uuid, nullif(v_rating->>'level_id','')::uuid, coalesce((v_rating->>'points')::numeric, 0), coalesce(v_rating->>'comment',''));
  end loop;

  insert into public.grade_items (org_id, session_id, source_type, source_id, title, max_points)
  values (v_assignment.org_id, v_assignment.session_id, 'assignment', v_assignment.id, v_assignment.title, v_assignment.max_points)
  on conflict (source_type, source_id) do update set title = excluded.title
  returning * into v_grade_item;

  select * into v_existing_result from public.grade_results where grade_item_id = v_grade_item.id and learner_id = v_submission.learner_id;

  if v_existing_result.id is not null then
    if v_existing_result.published_at is not null and p_reason is null then
      raise exception 'reason_required_for_grade_revision';
    end if;
    insert into public.grade_revisions (grade_result_id, previous_points, new_points, previous_status, new_status, reason, author_id)
    values (v_existing_result.id, v_existing_result.points, p_score, v_existing_result.status, 'graded', coalesce(p_reason, 'initial publication'), auth.uid());
    update public.grade_results set status = 'graded', points = p_score, published_at = now() where id = v_existing_result.id;
  else
    insert into public.grade_results (grade_item_id, learner_id, status, points, published_at)
    values (v_grade_item.id, v_submission.learner_id, 'graded', p_score, now());
  end if;

  update public.submissions set status = 'graded' where id = p_submission_id;

  perform public.emit_learning_event('grade.published', v_assignment.org_id, v_submission.learner_id, 'submission', p_submission_id, jsonb_build_object('grade_item_id', v_grade_item.id, 'score', p_score));

  return v_assessment;
end;
$$;

revoke all on function public.publish_submission_grade(uuid, numeric, text, uuid, jsonb, text) from public;
grant execute on function public.publish_submission_grade(uuid, numeric, text, uuid, jsonb, text) to authenticated;
