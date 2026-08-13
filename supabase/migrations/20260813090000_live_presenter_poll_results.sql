-- Spec 09 — Sondage live, Q&A, modération et coanimation
-- (docs/product-specs/2026-08-10-lms-program/09-live-engagement.md).
--
-- RESTE-A-FAIRE.md/VALIDATION-STATUS.md §09: "Sondages sur l'écran
-- projeté (LivePresenterScreen.tsx) — l'éditeur/résultats staff et le
-- widget participant existent, l'écran public n'en affiche toujours
-- aucun." live_interactions is already publicly readable when
-- status in ('live','closed') and the event is active
-- (live_interactions_public_read, 20260810230000) — LivePresenterScreen
-- can already read which poll is live via listRunInteractions() with no
-- change needed. What's missing: live_responses is staff-only
-- (live_responses_staff_read) by design (a public reader shouldn't see
-- who answered what) — the presenter screen needs aggregate counts, not
-- raw rows, so this is a new security-definer RPC rather than a new RLS
-- policy: same posture as get_my_live_response() (a participant's own
-- answer is also not directly select-able, only through a function).
create or replace function public.get_public_live_interaction_results(p_interaction_id uuid)
returns table(option_id text, votes_count bigint, respondents bigint)
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
    where i.id = p_interaction_id and i.status in ('live', 'closed') and e.status = 'active'
  ) into v_visible;

  if not v_visible then
    raise exception 'Interaction not found';
  end if;

  return query
    select opt, count(*)::bigint, (select count(*) from public.live_responses where interaction_id = p_interaction_id)::bigint
    from public.live_responses lr, unnest(array(select jsonb_array_elements_text(lr.payload->'optionIds'))) as opt
    where lr.interaction_id = p_interaction_id
    group by opt;
end;
$$;

revoke all on function public.get_public_live_interaction_results(uuid) from public;
grant execute on function public.get_public_live_interaction_results(uuid) to anon, authenticated;
