-- Spec 09 — Sondage live, Q&A, modération et coanimation.
--
-- LIVE-011 "brainstorm : idées, groupes/catégories, vote et export" —
-- voting on ideas is participant-facing (same posture as poll results),
-- but live_responses has no participant select policy at all (client_id
-- isn't an auth identity RLS can key on — same reason get_my_live_response()
-- exists instead of a direct read). A participant can't see other
-- participants' submitted ideas to vote on them without a read path that
-- doesn't leak who submitted what — same problem
-- get_public_live_interaction_results() (20260813090000) already solved
-- for poll counts, same shape of fix here: an aggregate-only RPC.
create or replace function public.get_live_brainstorm_ideas(p_interaction_id uuid)
returns table(idea_id text, idea_text text, votes_count bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_visible boolean;
begin
  select exists (
    select 1 from public.live_interactions i
    join public.live_runs r on r.id = i.run_id
    join public.live_events e on e.id = r.event_id
    where i.id = p_interaction_id and i.kind = 'brainstorm' and i.status in ('live', 'closed') and e.status = 'active'
  ) into v_visible;

  if not v_visible then
    raise exception 'Interaction not found';
  end if;

  return query
    with all_responses as (
      select payload from public.live_responses where interaction_id = p_interaction_id
    ),
    ideas as (
      select distinct (idea->>'id') as id, (idea->>'text') as text
      from all_responses, jsonb_array_elements(coalesce(payload->'ideas', '[]'::jsonb)) as idea
    ),
    votes as (
      select vote as id, count(*) as n
      from all_responses, jsonb_array_elements_text(coalesce(payload->'votes', '[]'::jsonb)) as vote
      group by vote
    )
    select i.id, i.text, coalesce(v.n, 0)
    from ideas i
    left join votes v on v.id = i.id;
end;
$$;

revoke all on function public.get_live_brainstorm_ideas(uuid) from public;
grant execute on function public.get_live_brainstorm_ideas(uuid) to anon, authenticated;
