-- Retrofit org_id onto every pre-existing content table (chantier 1b).
-- Three auto-fill triggers cover every insert path so no existing
-- application code (or security-definer function) needs to change to keep
-- inserting rows: today every user has exactly one org (Brivia), so the
-- fallback always resolves correctly.

-- set_default_org_id: for rows inserted by an authenticated *actor* acting
-- for themself (content, folders, exams, quiz_attempts, content_shares,
-- manual_evaluations, manual_evaluation_groups, manual_grades). Falls back
-- to the caller's first (oldest) org membership when org_id isn't supplied.
create or replace function public.set_default_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select org_id into new.org_id
    from public.user_org_roles
    where user_id = auth.uid()
    order by created_at
    limit 1;
  end if;
  return new;
end;
$$;

-- set_target_user_org_id: for rows inserted *about* another user by a
-- trigger (notifications, notification_preferences) — org must follow the
-- row's own user_id, not auth.uid() of whoever triggered the insert.
create or replace function public.set_target_user_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select org_id into new.org_id
    from public.user_org_roles
    where user_id = new.user_id
    order by created_at
    limit 1;
  end if;
  return new;
end;
$$;

-- set_exam_attempt_org_id: exam_attempts participants are frequently
-- anonymous (client-generated participant_id, not auth.uid() — see
-- exam_tables.sql), so org_id must come from the parent exam, not the actor.
create or replace function public.set_exam_attempt_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select org_id into new.org_id from public.exams where id = new.exam_id;
  end if;
  return new;
end;
$$;

-- ── per-table: add column, backfill, enforce not null, index, trigger ──────
do $$
declare
  brivia_id uuid;
  t text;
  actor_tables text[] := array[
    'content', 'folders', 'exams', 'quiz_attempts', 'content_shares',
    'manual_evaluations', 'manual_evaluation_groups', 'manual_grades'
  ];
  target_user_tables text[] := array['notifications', 'notification_preferences'];
begin
  select id into brivia_id from public.organizations where slug = 'brivia';

  foreach t in array actor_tables || target_user_tables || array['exam_attempts']
  loop
    execute format('alter table public.%I add column if not exists org_id uuid references public.organizations(id)', t);
    execute format('update public.%I set org_id = %L where org_id is null', t, brivia_id);
    execute format('alter table public.%I alter column org_id set not null', t);
    execute format('create index if not exists %I on public.%I(org_id)', t || '_org_idx', t);
  end loop;

  foreach t in array actor_tables
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_org_id', t);
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.set_default_org_id()',
      t || '_set_org_id', t
    );
  end loop;

  foreach t in array target_user_tables
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_org_id', t);
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.set_target_user_org_id()',
      t || '_set_org_id', t
    );
  end loop;

  execute 'drop trigger if exists exam_attempts_set_org_id on public.exam_attempts';
  execute 'create trigger exam_attempts_set_org_id before insert on public.exam_attempts for each row execute function public.set_exam_attempt_org_id()';
end $$;

-- ── role-gate exam creation : trainer/pedago/admin only ────────────────────
-- The only RLS change beyond adding org_id: every other existing policy
-- (owner-only reads/writes) already provides the correct security boundary,
-- so org_id there is data-model-only for now (UI-level per-persona gating is
-- a separate future sub-project — see spec's Non-goals). Exam creation is
-- named explicitly in the spec and is safe to gate today: every existing
-- user is 'admin' of the bootstrap org from Task 1, so nothing breaks.
drop policy if exists exams_owner_insert on public.exams;
create policy exams_owner_insert on public.exams
  for insert with check (
    host_id = auth.uid() and public.has_org_role(org_id, array['trainer','pedago','admin'])
  );
