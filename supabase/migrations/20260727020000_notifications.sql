-- Persistent in-app notifications with per-category preferences and automatic
-- events for collaboration, exams, support tickets and product releases.

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  shares_enabled boolean not null default true,
  exams_enabled boolean not null default true,
  support_enabled boolean not null default true,
  product_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('share', 'exam', 'support', 'product', 'system')),
  title text not null,
  body text not null default '',
  action_url text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;

alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;

create policy notification_preferences_owner on public.notification_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notifications_owner_read on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_owner_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_owner_delete on public.notifications
  for delete using (user_id = auth.uid());
create policy notifications_admin_insert on public.notifications
  for insert with check (public.is_admin());

create trigger notification_preferences_touch before update on public.notification_preferences
  for each row execute function public.touch_updated_at();

create or replace function public.notify_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications(user_id, category, title, body, action_url)
  values (
    new.id,
    'system',
    'Bienvenue sur Brivia',
    'Votre centre de notifications est prêt. Retrouvez ici vos partages, examens et demandes de support.',
    '/help'
  );
  return new;
end;
$$;

create trigger profiles_welcome_notification
  after insert on public.profiles
  for each row execute function public.notify_new_profile();

create or replace function public.notification_category_enabled(p_user_id uuid, p_category text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
    select case p_category
      when 'share' then shares_enabled
      when 'exam' then exams_enabled
      when 'support' then support_enabled
      when 'product' then product_enabled
      else true
    end
    from public.notification_preferences
    where user_id = p_user_id
  ), true);
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
    from public.group_members gm
    where gm.group_id = new.shared_with_group_id
      and gm.user_id is not null
      and public.notification_category_enabled(gm.user_id, 'share');
  end if;
  return new;
end;
$$;

create trigger content_shares_notify
  after insert or update of shared_with_user_id, shared_with_group_id, permission
  on public.content_shares
  for each row execute function public.notify_content_share();

create or replace function public.notify_exam_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  exam_title text;
begin
  if old.status = 'in-progress' and new.status in ('submitted', 'auto-submitted') then
    select e.host_id, e.title into owner_id, exam_title
    from public.exams e where e.id = new.exam_id;
    if owner_id is not null and public.notification_category_enabled(owner_id, 'exam') then
      insert into public.notifications(user_id, category, title, body, action_url, metadata)
      values (
        owner_id,
        'exam',
        'Nouvelle copie remise',
        new.participant_name || ' a terminé « ' || exam_title || ' »',
        '/exam/' || new.exam_id || '/admin',
        jsonb_build_object('exam_id', new.exam_id, 'attempt_id', new.id, 'score', new.percentage)
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger exam_attempts_notify
  after update of status on public.exam_attempts
  for each row execute function public.notify_exam_submission();

create or replace function public.notify_report_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status
     and public.notification_category_enabled(new.user_id, 'support') then
    insert into public.notifications(user_id, category, title, body, action_url, metadata)
    values (
      new.user_id,
      'support',
      case new.status
        when 'in_progress' then 'Votre demande est en cours de traitement'
        when 'waiting' then 'Une réponse est attendue de votre part'
        when 'resolved' then 'Votre demande a été résolue'
        else 'Votre demande a été mise à jour'
      end,
      new.title,
      '/report',
      jsonb_build_object('report_id', new.id, 'status', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger reports_notify_status
  after update of status on public.reports
  for each row execute function public.notify_report_status();

create or replace function public.notify_product_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  should_notify boolean;
begin
  if tg_op = 'INSERT' then
    should_notify := new.status = 'published';
  else
    should_notify := new.status = 'published' and old.status is distinct from 'published';
  end if;

  if should_notify then
    insert into public.notifications(user_id, category, title, body, action_url, metadata)
    select
      subscriber.user_id,
      'product',
      'Nouveauté Brivia · ' || new.version,
      new.title,
      '/changelog',
      jsonb_build_object('release_id', new.id, 'version', new.version)
    from public.changelog_subscribers subscriber
    where public.notification_category_enabled(subscriber.user_id, 'product');
  end if;
  return new;
end;
$$;

create trigger changelog_releases_notify
  after insert or update of status on public.changelog_releases
  for each row execute function public.notify_product_release();

alter publication supabase_realtime add table public.notifications;
