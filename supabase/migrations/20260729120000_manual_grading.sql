-- Manual grading MVP: group-scoped assessments, fast grade entry, publication,
-- optimistic concurrency, learner-only published results, and immutable audit.

create table public.manual_evaluations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid references public.content(id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 10000),
  context_label text not null default '' check (char_length(context_label) <= 160),
  grading_type text not null check (grading_type in ('numeric', 'validation')),
  minimum_score numeric(12,4) not null default 0,
  maximum_score numeric(12,4) not null default 20,
  decimal_places smallint not null default 2 check (decimal_places between 0 and 4),
  pass_threshold numeric(12,4),
  coefficient numeric(8,3) not null default 1 check (coefficient > 0),
  rounding_rule text not null default 'tenth'
    check (rounding_rule in ('none', 'tenth', 'half', 'integer')),
  validation_labels jsonb not null default
    '["Validé","Non validé","À revoir","Non évalué"]'::jsonb,
  evaluation_date date not null default current_date,
  entry_deadline timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (maximum_score > minimum_score),
  check (
    pass_threshold is null
    or (pass_threshold >= minimum_score and pass_threshold <= maximum_score)
  ),
  check (jsonb_typeof(validation_labels) = 'array')
);

create index manual_evaluations_owner_created_idx
  on public.manual_evaluations(owner_id, created_at desc);
create index manual_evaluations_content_idx
  on public.manual_evaluations(content_id) where content_id is not null;

create table public.manual_evaluation_groups (
  evaluation_id uuid not null references public.manual_evaluations(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (evaluation_id, group_id)
);

create index manual_evaluation_groups_group_idx
  on public.manual_evaluation_groups(group_id, evaluation_id);

create table public.manual_grades (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.manual_evaluations(id) on delete cascade,
  learner_id uuid not null references auth.users(id) on delete cascade,
  score numeric(12,4),
  validation_value text
    check (validation_value in ('validated', 'not_validated', 'review', 'not_evaluated')),
  attendance_status text not null default 'present'
    check (attendance_status in (
      'present',
      'absent',
      'absent_excused',
      'absent_unexcused',
      'not_submitted',
      'exempt',
      'not_evaluated'
    )),
  appreciation text not null default '' check (char_length(appreciation) <= 10000),
  workflow_status text not null default 'draft'
    check (workflow_status in ('draft', 'published')),
  published_at timestamptz,
  locked_at timestamptz,
  version integer not null default 1 check (version > 0),
  last_edited_by uuid not null references auth.users(id),
  last_change_reason text not null default '' check (char_length(last_change_reason) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (evaluation_id, learner_id),
  check (
    attendance_status = 'present'
    or (score is null and validation_value is null)
  ),
  check (
    (workflow_status = 'draft' and published_at is null and locked_at is null)
    or (workflow_status = 'published' and published_at is not null and locked_at is not null)
  )
);

create index manual_grades_evaluation_idx
  on public.manual_grades(evaluation_id, workflow_status);
create index manual_grades_learner_published_idx
  on public.manual_grades(learner_id, published_at desc)
  where workflow_status = 'published';

create table public.manual_grade_history (
  id bigint generated always as identity primary key,
  grade_id uuid not null references public.manual_grades(id) on delete cascade,
  evaluation_id uuid not null references public.manual_evaluations(id) on delete cascade,
  learner_id uuid not null references auth.users(id) on delete cascade,
  changed_by uuid not null references auth.users(id),
  reason text not null default '',
  old_value jsonb not null,
  new_value jsonb not null,
  changed_at timestamptz not null default now()
);

create index manual_grade_history_grade_idx
  on public.manual_grade_history(grade_id, changed_at desc);
create index manual_grade_history_learner_idx
  on public.manual_grade_history(learner_id, changed_at desc);

create trigger manual_evaluations_touch_updated_at
  before update on public.manual_evaluations
  for each row execute function public.touch_updated_at();

create trigger manual_grades_touch_updated_at
  before update on public.manual_grades
  for each row execute function public.touch_updated_at();

alter table public.manual_evaluations enable row level security;
alter table public.manual_evaluation_groups enable row level security;
alter table public.manual_grades enable row level security;
alter table public.manual_grade_history enable row level security;

create or replace function public.can_manage_manual_evaluation(p_evaluation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.manual_evaluations evaluation
    where evaluation.id = p_evaluation_id
      and (evaluation.owner_id = auth.uid() or public.is_admin())
  );
$$;

create or replace function public.can_view_manual_evaluation(p_evaluation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.can_manage_manual_evaluation(p_evaluation_id)
    or exists (
      select 1
      from public.manual_grades grade
      where grade.evaluation_id = p_evaluation_id
        and grade.learner_id = auth.uid()
        and grade.workflow_status = 'published'
    );
$$;

revoke all on function public.can_manage_manual_evaluation(uuid) from public;
revoke all on function public.can_view_manual_evaluation(uuid) from public;
grant execute on function public.can_manage_manual_evaluation(uuid) to authenticated;
grant execute on function public.can_view_manual_evaluation(uuid) to authenticated;

create policy manual_evaluations_read_visible on public.manual_evaluations
  for select to authenticated
  using (public.can_view_manual_evaluation(id));

create policy manual_evaluation_groups_read_manager on public.manual_evaluation_groups
  for select to authenticated
  using (public.can_manage_manual_evaluation(evaluation_id));

create policy manual_grades_read_manager_or_learner on public.manual_grades
  for select to authenticated
  using (
    public.can_manage_manual_evaluation(evaluation_id)
    or (learner_id = auth.uid() and workflow_status = 'published')
  );

create policy manual_grade_history_read_parties on public.manual_grade_history
  for select to authenticated
  using (
    public.can_manage_manual_evaluation(evaluation_id)
    or (
      learner_id = auth.uid()
      and exists (
        select 1
        from public.manual_grades grade
        where grade.id = manual_grade_history.grade_id
          and grade.workflow_status = 'published'
      )
    )
  );

-- All writes use the functions below. No client INSERT/UPDATE/DELETE policies
-- exist on the four tables, so API clients cannot bypass validation or audit.

create or replace function public.create_manual_evaluation(
  p_name text,
  p_description text,
  p_context_label text,
  p_content_id uuid,
  p_grading_type text,
  p_minimum_score numeric,
  p_maximum_score numeric,
  p_decimal_places smallint,
  p_pass_threshold numeric,
  p_coefficient numeric,
  p_rounding_rule text,
  p_evaluation_date date,
  p_entry_deadline timestamptz,
  p_group_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_evaluation_id uuid;
  selected_group_count integer;
  owned_group_count integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 160 then
    raise exception 'Invalid evaluation name';
  end if;
  if p_grading_type not in ('numeric', 'validation') then
    raise exception 'Invalid grading type';
  end if;
  if p_maximum_score <= p_minimum_score then
    raise exception 'Maximum score must exceed minimum score';
  end if;
  if p_decimal_places not between 0 and 4 then
    raise exception 'Invalid decimal precision';
  end if;
  if p_coefficient <= 0 then raise exception 'Coefficient must be positive'; end if;
  if p_pass_threshold is not null
     and (p_pass_threshold < p_minimum_score or p_pass_threshold > p_maximum_score) then
    raise exception 'Pass threshold is outside the scale';
  end if;
  if p_rounding_rule not in ('none', 'tenth', 'half', 'integer') then
    raise exception 'Invalid rounding rule';
  end if;

  select count(*) into selected_group_count
  from (select distinct unnest(coalesce(p_group_ids, array[]::uuid[])) as id) selected;
  if selected_group_count = 0 then raise exception 'At least one group is required'; end if;

  select count(*) into owned_group_count
  from public.groups
  where owner_id = auth.uid()
    and id in (select distinct unnest(p_group_ids));
  if owned_group_count <> selected_group_count then
    raise exception 'One or more groups are not owned by the caller';
  end if;

  if p_content_id is not null and not exists (
    select 1 from public.content
    where id = p_content_id and user_id = auth.uid()
  ) then
    raise exception 'Linked content is not owned by the caller';
  end if;

  insert into public.manual_evaluations (
    owner_id,
    content_id,
    name,
    description,
    context_label,
    grading_type,
    minimum_score,
    maximum_score,
    decimal_places,
    pass_threshold,
    coefficient,
    rounding_rule,
    evaluation_date,
    entry_deadline
  )
  values (
    auth.uid(),
    p_content_id,
    trim(p_name),
    trim(coalesce(p_description, '')),
    trim(coalesce(p_context_label, '')),
    p_grading_type,
    p_minimum_score,
    p_maximum_score,
    p_decimal_places,
    p_pass_threshold,
    p_coefficient,
    p_rounding_rule,
    coalesce(p_evaluation_date, current_date),
    p_entry_deadline
  )
  returning id into new_evaluation_id;

  insert into public.manual_evaluation_groups(evaluation_id, group_id)
  select new_evaluation_id, id
  from (select distinct unnest(p_group_ids) as id) selected;

  return new_evaluation_id;
end;
$$;

revoke all on function public.create_manual_evaluation(
  text, text, text, uuid, text, numeric, numeric, smallint, numeric, numeric,
  text, date, timestamptz, uuid[]
) from public;
grant execute on function public.create_manual_evaluation(
  text, text, text, uuid, text, numeric, numeric, smallint, numeric, numeric,
  text, date, timestamptz, uuid[]
) to authenticated;

create or replace function public.save_manual_grade(
  p_evaluation_id uuid,
  p_learner_id uuid,
  p_score numeric,
  p_validation_value text,
  p_attendance_status text,
  p_appreciation text,
  p_workflow_status text,
  p_expected_version integer,
  p_change_reason text
)
returns public.manual_grades
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  evaluation public.manual_evaluations;
  existing public.manual_grades;
  result public.manual_grades;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into evaluation
  from public.manual_evaluations
  where id = p_evaluation_id;
  if evaluation.id is null
     or (evaluation.owner_id <> auth.uid() and not public.is_admin()) then
    raise exception 'Not allowed to grade this evaluation';
  end if;

  select * into existing
  from public.manual_grades
  where evaluation_id = p_evaluation_id and learner_id = p_learner_id
  for update;

  if existing.id is null and not exists (
    select 1
    from public.manual_evaluation_groups assignment
    join public.group_members member on member.group_id = assignment.group_id
    where assignment.evaluation_id = p_evaluation_id
      and member.user_id = p_learner_id
  ) then
    raise exception 'Learner is not in an assigned group';
  end if;

  if p_attendance_status not in (
    'present', 'absent', 'absent_excused', 'absent_unexcused',
    'not_submitted', 'exempt', 'not_evaluated'
  ) then
    raise exception 'Invalid attendance status';
  end if;
  if p_workflow_status not in ('draft', 'published') then
    raise exception 'Invalid workflow status';
  end if;

  if p_attendance_status <> 'present' then
    p_score := null;
    p_validation_value := null;
  elsif evaluation.grading_type = 'numeric' then
    p_validation_value := null;
    if p_score is not null and (
      p_score < evaluation.minimum_score
      or p_score > evaluation.maximum_score
      or p_score <> round(p_score, evaluation.decimal_places)
    ) then
      raise exception 'Score is outside the configured scale or precision';
    end if;
    if p_workflow_status = 'published' and p_score is null then
      raise exception 'A numeric score is required before publication';
    end if;
  else
    p_score := null;
    if p_validation_value is not null
       and p_validation_value not in ('validated', 'not_validated', 'review', 'not_evaluated') then
      raise exception 'Invalid validation value';
    end if;
    if p_workflow_status = 'published' and p_validation_value is null then
      raise exception 'A validation value is required before publication';
    end if;
  end if;

  if existing.id is not null and existing.workflow_status = 'published'
     and char_length(trim(coalesce(p_change_reason, ''))) < 3 then
    raise exception 'A change reason is required for a published grade';
  end if;

  if existing.id is null then
    if coalesce(p_expected_version, 0) <> 0 then
      raise exception 'Grade version conflict';
    end if;
    insert into public.manual_grades (
      evaluation_id,
      learner_id,
      score,
      validation_value,
      attendance_status,
      appreciation,
      workflow_status,
      published_at,
      locked_at,
      version,
      last_edited_by,
      last_change_reason
    )
    values (
      p_evaluation_id,
      p_learner_id,
      p_score,
      p_validation_value,
      p_attendance_status,
      trim(coalesce(p_appreciation, '')),
      p_workflow_status,
      case when p_workflow_status = 'published' then now() end,
      case when p_workflow_status = 'published' then now() end,
      1,
      auth.uid(),
      trim(coalesce(p_change_reason, ''))
    )
    returning * into result;
  else
    update public.manual_grades
    set score = p_score,
        validation_value = p_validation_value,
        attendance_status = p_attendance_status,
        appreciation = trim(coalesce(p_appreciation, '')),
        workflow_status = p_workflow_status,
        published_at = case
          when p_workflow_status = 'published' then coalesce(published_at, now())
          else null
        end,
        locked_at = case when p_workflow_status = 'published' then now() else null end,
        version = version + 1,
        last_edited_by = auth.uid(),
        last_change_reason = trim(coalesce(p_change_reason, ''))
    where id = existing.id and version = p_expected_version
    returning * into result;

    if result.id is null then raise exception 'Grade version conflict'; end if;
  end if;

  return result;
end;
$$;

revoke all on function public.save_manual_grade(
  uuid, uuid, numeric, text, text, text, text, integer, text
) from public;
grant execute on function public.save_manual_grade(
  uuid, uuid, numeric, text, text, text, text, integer, text
) to authenticated;

create or replace function public.publish_manual_grades(p_evaluation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  evaluation public.manual_evaluations;
  published_count integer;
begin
  select * into evaluation
  from public.manual_evaluations
  where id = p_evaluation_id;
  if evaluation.id is null
     or (evaluation.owner_id <> auth.uid() and not public.is_admin()) then
    raise exception 'Not allowed to publish this evaluation';
  end if;

  update public.manual_grades grade
  set workflow_status = 'published',
      published_at = now(),
      locked_at = now(),
      version = version + 1,
      last_edited_by = auth.uid(),
      last_change_reason = 'Publication groupée'
  where grade.evaluation_id = p_evaluation_id
    and grade.workflow_status = 'draft'
    and (
      grade.attendance_status <> 'present'
      or (evaluation.grading_type = 'numeric' and grade.score is not null)
      or (evaluation.grading_type = 'validation' and grade.validation_value is not null)
    );

  get diagnostics published_count = row_count;
  return published_count;
end;
$$;

revoke all on function public.publish_manual_grades(uuid) from public;
grant execute on function public.publish_manual_grades(uuid) to authenticated;

create or replace function public.audit_manual_grade_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if row(
    old.score,
    old.validation_value,
    old.attendance_status,
    old.appreciation,
    old.workflow_status
  ) is distinct from row(
    new.score,
    new.validation_value,
    new.attendance_status,
    new.appreciation,
    new.workflow_status
  ) then
    insert into public.manual_grade_history (
      grade_id,
      evaluation_id,
      learner_id,
      changed_by,
      reason,
      old_value,
      new_value
    )
    values (
      new.id,
      new.evaluation_id,
      new.learner_id,
      new.last_edited_by,
      new.last_change_reason,
      jsonb_build_object(
        'score', old.score,
        'validation_value', old.validation_value,
        'attendance_status', old.attendance_status,
        'appreciation', old.appreciation,
        'workflow_status', old.workflow_status
      ),
      jsonb_build_object(
        'score', new.score,
        'validation_value', new.validation_value,
        'attendance_status', new.attendance_status,
        'appreciation', new.appreciation,
        'workflow_status', new.workflow_status
      )
    );
  end if;
  return new;
end;
$$;

create trigger manual_grades_audit
  after update on public.manual_grades
  for each row execute function public.audit_manual_grade_change();

create or replace function public.notify_manual_grade_publication()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  evaluation_name text;
begin
  -- CASE must be parenthesized here: PL/pgSQL can't parse a bare CASE as an
  -- IF condition (its own THEN/END collide with the IF's) — fails at
  -- creation with "syntax error at end of input" otherwise.
  if new.workflow_status = 'published'
     and (case
       when tg_op = 'INSERT' then true
       else (
         old.workflow_status <> 'published'
         or old.score is distinct from new.score
         or old.validation_value is distinct from new.validation_value
         or old.appreciation is distinct from new.appreciation
       )
     end)
     and public.notification_category_enabled(new.learner_id, 'system') then
    select name into evaluation_name
    from public.manual_evaluations where id = new.evaluation_id;

    insert into public.notifications(user_id, category, title, body, action_url, metadata)
    values (
      new.learner_id,
      'system',
      case
        when tg_op = 'UPDATE' then
          case when old.workflow_status = 'published'
            then 'Une note a été révisée'
            else 'Une nouvelle note est disponible'
          end
        else 'Une nouvelle note est disponible'
      end,
      evaluation_name,
      '/my-grades',
      jsonb_build_object('evaluation_id', new.evaluation_id, 'grade_id', new.id)
    );
  end if;
  return new;
end;
$$;

create trigger manual_grades_notify
  after insert or update on public.manual_grades
  for each row execute function public.notify_manual_grade_publication();
