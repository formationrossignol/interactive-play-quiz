-- Rename groups/group_members to share_groups/share_group_members to free
-- the "groups" name for the future scolarité "groupe pédagogique" concept.
-- Renaming a table doesn't rewrite the text of dependent function bodies or
-- policy USING/WITH CHECK clauses, so every object below that textually
-- referenced public.groups / public.group_members is redefined pointing at
-- the new names. TypeScript type names (Group, GroupMember) are unchanged —
-- only the underlying table names move. Foreign keys (e.g.
-- signature_request_groups.group_id -> groups.id) need no action: Postgres
-- tracks them by OID and follows a table rename automatically.

alter table public.groups rename to share_groups;
alter table public.group_members rename to share_group_members;

alter index if exists groups_owner_idx rename to share_groups_owner_idx;
alter index if exists group_members_group_idx rename to share_group_members_group_idx;
alter index if exists group_members_user_idx rename to share_group_members_user_idx;

-- ── policies referencing the old names ──────────────────────────────────
drop policy if exists group_members_owner on public.share_group_members;
create policy group_members_owner on public.share_group_members
  for all using (
    exists (select 1 from public.share_groups g where g.id = group_id and g.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.share_groups g where g.id = group_id and g.owner_id = auth.uid())
  );

drop policy if exists content_shares_owner on public.content_shares;
create policy content_shares_owner on public.content_shares
  for all using (
    exists (select 1 from public.content c where c.id = content_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.content c where c.id = content_id and c.user_id = auth.uid())
    and (shared_with_group_id is null or exists (select 1 from public.share_groups g where g.id = shared_with_group_id and g.owner_id = auth.uid()))
  );

drop policy if exists content_shares_group_read on public.content_shares;
create policy content_shares_group_read on public.content_shares
  for select using (
    shared_with_group_id in (select group_id from public.share_group_members where user_id = auth.uid())
  );

drop policy if exists content_public_read on public.content;
create policy content_public_read on public.content
  for select using (
    is_public = true or is_open = true
    or exists (
      select 1 from public.content_shares cs
      where cs.content_id = content.id
        and (cs.shared_with_user_id = auth.uid()
             or cs.shared_with_group_id in (select group_id from public.share_group_members where user_id = auth.uid()))
    )
  );

-- signature_request_groups_insert_owner (group_signature_requests.sql) also
-- textually references public.groups.
drop policy if exists signature_request_groups_insert_owner on public.signature_request_groups;
create policy signature_request_groups_insert_owner on public.signature_request_groups
  for insert with check (
    exists (
      select 1 from public.signature_requests sr
      where sr.id = request_id and sr.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.share_groups g
      where g.id = group_id and g.owner_id = auth.uid()
    )
  );

-- ── functions referencing the old names ─────────────────────────────────
create or replace function public.resolve_group_member(p_group_id uuid, p_email text)
returns public.share_group_members
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  result public.share_group_members;
begin
  if not exists (select 1 from public.share_groups where id = p_group_id and owner_id = auth.uid()) then
    raise exception 'Not the owner of this group';
  end if;

  select u.id into target_user_id from auth.users u where u.email = p_email;

  if target_user_id is not null then
    insert into public.share_group_members (group_id, user_id)
    values (p_group_id, target_user_id)
    on conflict (group_id, user_id) do nothing
    returning * into result;
  else
    insert into public.share_group_members (group_id, pending_email)
    values (p_group_id, p_email)
    on conflict (group_id, pending_email) do nothing
    returning * into result;
  end if;

  return result;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text := coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1));
  candidate text := base_username;
  suffix int := 1;
begin
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base_username || '-' || suffix;
  end loop;

  insert into public.profiles (id, username) values (new.id, candidate)
  on conflict (id) do nothing;

  update public.share_group_members set user_id = new.id, pending_email = null where pending_email = new.email;
  update public.content_shares set shared_with_user_id = new.id, pending_email = null where pending_email = new.email;

  return new;
end;
$$;

create or replace function public.update_collaborative_content(
  p_content_id uuid,
  p_data jsonb
)
returns public.content
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.content;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    exists (
      select 1 from public.content c
      where c.id = p_content_id and c.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.content_shares cs
      where cs.content_id = p_content_id
        and cs.permission = 'editor'
        and (
          cs.shared_with_user_id = auth.uid()
          or cs.shared_with_group_id in (
            select gm.group_id
            from public.share_group_members gm
            where gm.user_id = auth.uid()
          )
        )
    )
  ) then
    raise exception 'Edit access required';
  end if;

  update public.content
  set data = p_data
  where id = p_content_id
  returning * into result;

  if result.id is null then
    raise exception 'Content not found';
  end if;

  return result;
end;
$$;

create or replace function public.notify_content_share()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  content_title text;
  content_type text;
begin
  if tg_op = 'UPDATE'
     and old.shared_with_user_id is not distinct from new.shared_with_user_id
     and old.shared_with_group_id is not distinct from new.shared_with_group_id
     and old.permission is not distinct from new.permission then
    return new;
  end if;

  select coalesce(c.data->>'title', 'Un contenu'), c.type
  into content_title, content_type
  from public.content c
  where c.id = new.content_id;

  if new.shared_with_user_id is not null
     and public.notification_category_enabled(new.shared_with_user_id, 'share') then
    insert into public.notifications(user_id, category, title, body, action_url, metadata)
    values (
      new.shared_with_user_id,
      'share',
      'Un contenu a été partagé avec vous',
      content_title || case when new.permission = 'editor' then ' · accès en modification' else ' · accès en lecture' end,
      '/shared-with-me',
      jsonb_build_object('content_id', new.content_id, 'content_type', content_type, 'permission', new.permission)
    );
  elsif new.shared_with_group_id is not null then
    insert into public.notifications(user_id, category, title, body, action_url, metadata)
    select
      gm.user_id,
      'share',
      'Un contenu a été partagé avec votre groupe',
      content_title || case when new.permission = 'editor' then ' · accès en modification' else ' · accès en lecture' end,
      '/shared-with-me',
      jsonb_build_object('content_id', new.content_id, 'content_type', content_type, 'permission', new.permission)
    from public.share_group_members gm
    where gm.group_id = new.shared_with_group_id
      and gm.user_id is not null
      and public.notification_category_enabled(gm.user_id, 'share');
  end if;
  return new;
end;
$$;

-- can_access_signature_request (group_signature_requests.sql) also
-- textually references public.group_members.
create or replace function public.can_access_signature_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.signature_requests sr
    where sr.id = p_request_id
      and (
        sr.owner_id = auth.uid()
        or exists (
          select 1
          from public.signature_request_groups srg
          join public.share_group_members gm on gm.group_id = srg.group_id
          where srg.request_id = sr.id
            and gm.user_id = auth.uid()
        )
      )
  );
$$;

-- create_group_signature_request (group_signature_requests.sql) also
-- textually references public.groups.
create or replace function public.create_group_signature_request(
  p_title text,
  p_message text,
  p_due_at timestamptz,
  p_group_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  new_request_id uuid;
  distinct_group_count integer;
  owned_group_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if char_length(trim(coalesce(p_title, ''))) not between 1 and 160 then
    raise exception 'Invalid title';
  end if;

  select count(*) into distinct_group_count
  from (select distinct unnest(coalesce(p_group_ids, array[]::uuid[])) as id) selected;

  if distinct_group_count = 0 then
    raise exception 'At least one group is required';
  end if;

  select count(*) into owned_group_count
  from public.share_groups
  where owner_id = auth.uid()
    and id in (select distinct unnest(p_group_ids));

  if owned_group_count <> distinct_group_count then
    raise exception 'One or more groups are not owned by the caller';
  end if;

  insert into public.signature_requests (owner_id, title, message, due_at)
  values (auth.uid(), trim(p_title), trim(coalesce(p_message, '')), p_due_at)
  returning id into new_request_id;

  insert into public.signature_request_groups (request_id, group_id)
  select new_request_id, id
  from (select distinct unnest(p_group_ids) as id) selected;

  return new_request_id;
end;
$$;

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
  from public.share_groups
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
    owner_id, content_id, name, description, context_label, grading_type,
    minimum_score, maximum_score, decimal_places, pass_threshold, coefficient,
    rounding_rule, evaluation_date, entry_deadline
  )
  values (
    auth.uid(), p_content_id, trim(p_name), trim(coalesce(p_description, '')),
    trim(coalesce(p_context_label, '')), p_grading_type, p_minimum_score,
    p_maximum_score, p_decimal_places, p_pass_threshold, p_coefficient,
    p_rounding_rule, coalesce(p_evaluation_date, current_date), p_entry_deadline
  )
  returning id into new_evaluation_id;

  insert into public.manual_evaluation_groups(evaluation_id, group_id)
  select new_evaluation_id, id
  from (select distinct unnest(p_group_ids) as id) selected;

  return new_evaluation_id;
end;
$$;

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
    join public.share_group_members member on member.group_id = assignment.group_id
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
      evaluation_id, learner_id, score, validation_value, attendance_status,
      appreciation, workflow_status, published_at, locked_at, version,
      last_edited_by, last_change_reason
    )
    values (
      p_evaluation_id, p_learner_id, p_score, p_validation_value,
      p_attendance_status, trim(coalesce(p_appreciation, '')), p_workflow_status,
      case when p_workflow_status = 'published' then now() end,
      case when p_workflow_status = 'published' then now() end,
      1, auth.uid(), trim(coalesce(p_change_reason, ''))
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
