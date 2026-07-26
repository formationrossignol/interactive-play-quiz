-- Collaborative editing for quizzes, polls, flashcards, slides and courses.
-- A share can now grant either read-only access or permission to edit the
-- content JSON. Editors never receive ownership/folder/publication privileges:
-- writes go through a narrow security-definer RPC that only updates `data`.

alter table public.content_shares
  add column permission text not null default 'viewer'
  check (permission in ('viewer', 'editor'));

-- Existing links stay read-only. New builder invitations explicitly request
-- `editor`, while library-level sharing can still use `viewer`.

drop function if exists public.resolve_content_share(uuid, text);
create function public.resolve_content_share(
  p_content_id uuid,
  p_email text,
  p_permission text default 'viewer'
)
returns public.content_shares
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  result public.content_shares;
begin
  if p_permission not in ('viewer', 'editor') then
    raise exception 'Invalid permission';
  end if;

  if not exists (
    select 1 from public.content
    where id = p_content_id and user_id = auth.uid()
  ) then
    raise exception 'Not the owner of this content';
  end if;

  select u.id into target_user_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email));

  if target_user_id is not null then
    insert into public.content_shares (content_id, shared_with_user_id, permission)
    values (p_content_id, target_user_id, p_permission)
    on conflict (content_id, shared_with_user_id)
    do update set permission = excluded.permission
    returning * into result;
  else
    insert into public.content_shares (content_id, pending_email, permission)
    values (p_content_id, lower(trim(p_email)), p_permission)
    on conflict (content_id, pending_email)
    do update set permission = excluded.permission
    returning * into result;
  end if;

  return result;
end;
$$;

-- Restrict collaborator writes to the document payload. The owner may use the
-- same RPC; ownership, folder placement and visibility cannot be reassigned.
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
            from public.group_members gm
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

grant execute on function public.update_collaborative_content(uuid, jsonb) to authenticated;
grant execute on function public.resolve_content_share(uuid, text, text) to authenticated;
