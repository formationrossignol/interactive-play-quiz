-- Bug-hunt audit fixes for supabase/migrations/20260716140000_pages_cms_interactions.sql:
--
-- 1. roadmap_ideas_owner / reports_owner used `for all`, which includes
--    UPDATE — letting a user self-transition their own idea/report `status`
--    column directly via the Supabase client, bypassing the admin-only
--    ModerationTab workflow entirely. Neither table had any admin UPDATE
--    policy at all for roadmap_ideas (reports already had one via
--    reports_admin), so moderation there couldn't have worked for anyone
--    except a user moderating their own submission. Split owner access into
--    select/insert/delete (no update) and add a proper admin write policy.
-- 2. changelog_subscribers had only an owner-scoped policy, so an admin
--    querying it for SubscribersTab.tsx would see at most their own row
--    instead of the full subscriber list.

drop policy if exists roadmap_ideas_owner on public.roadmap_ideas;
create policy roadmap_ideas_owner_read on public.roadmap_ideas
  for select using (auth.uid() = user_id);
create policy roadmap_ideas_owner_insert on public.roadmap_ideas
  for insert with check (auth.uid() = user_id and status = 'pending');
create policy roadmap_ideas_owner_delete on public.roadmap_ideas
  for delete using (auth.uid() = user_id);

drop policy if exists roadmap_ideas_admin_read on public.roadmap_ideas;
create policy roadmap_ideas_admin_all on public.roadmap_ideas
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists reports_owner on public.reports;
create policy reports_owner_read on public.reports
  for select using (auth.uid() = user_id);
create policy reports_owner_insert on public.reports
  for insert with check (auth.uid() = user_id and status = 'open');
create policy reports_owner_delete on public.reports
  for delete using (auth.uid() = user_id);
-- reports_admin (for all, is_admin()) already covers admin status updates.

create policy changelog_subscribers_admin_read on public.changelog_subscribers
  for select using (public.is_admin());
