-- Fix infinite RLS recursion between `content` and `content_shares`
-- (introduced by 20260730140000_rename_share_groups.sql's rebuild of these
-- policies). content_public_read (on content) subqueries content_shares to
-- check for shares, while content_shares_owner (on content_shares)
-- subqueried content directly to check ownership — evaluating either
-- policy required evaluating the other table's RLS, looping forever
-- (Postgres 42P17) and breaking every content list for every user
-- (my-quizzes, my-polls, my-flashcards, my-slides, my-courses, discover).
--
-- Fix: a SECURITY DEFINER helper (owned by a role that bypasses content's
-- RLS, same pattern as set_default_org_id() etc.) checks ownership without
-- re-entering content's own policies, breaking the cycle at that edge.

create or replace function public.user_owns_content(p_content_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.content
    where id = p_content_id and user_id = auth.uid()
  );
$$;

drop policy if exists content_shares_owner on public.content_shares;
create policy content_shares_owner on public.content_shares
  for all using (
    public.user_owns_content(content_id)
  ) with check (
    public.user_owns_content(content_id)
    and (shared_with_group_id is null or exists (select 1 from public.share_groups g where g.id = shared_with_group_id and g.owner_id = auth.uid()))
  );
