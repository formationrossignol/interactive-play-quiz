-- Spec 09 — Sondage live, Q&A, modération et coanimation
-- (docs/product-specs/2026-08-10-lms-program/09-live-engagement.md).
--
-- RESTE-A-FAIRE.md's own cross-cutting dependency note: "Aucune UI staff ne
-- crée de sondage/priorisation/matrice (spec 09) bloque : l'écran de réponse
-- participant à ces formats — le construire avant l'éditeur serait deviner
-- un format." live_interactions/live_responses, submit_live_response() and
-- get_my_live_response() were already fully built and realtime-enabled
-- (20260810230000/20260811020000) — the RLS policy on live_interactions is
-- already `for all`, so staff can create/update rows directly with no new
-- RPC required for that part. What was actually missing was the UI itself,
-- for every kind.
--
-- Scope: this migration + its matching UI cover 'poll' only — question +
-- options, single or multi-select. 'priority' (points budget), 'matrix'
-- (2D placement), 'brainstorm' (idea clustering) and 'ranking' each need
-- their own config/payload contract and a materially different response
-- UI; still reste-à-faire, not guessed here. Payload contract for 'poll',
-- since live_responses.payload was otherwise fully undefined jsonb:
--   config  = {question: string, options: [{id, label}], allowMultiple: bool}
--   payload = {optionIds: string[]}  (always an array, even for single-select)
--
-- Two small additions:
--   - live_interactions gets created_at (missing entirely before this —
--     draft interactions have null opened_at/closed_at, so there was no way
--     to order a run's interaction list at all).
--   - open_live_interaction()/close_live_interaction(): a direct client
--     update could set status='live' just as validly under the existing RLS
--     policy, but neither the "only one interaction live per run at a time"
--     invariant (mirrors the single-navigation-authority principle
--     LIVE-007 already established via live_control_leases) nor
--     opened_at/closed_at could be expressed safely client-side without a
--     race between two staff members opening different interactions at once.

alter table public.live_interactions add column created_at timestamptz not null default now();
create index live_interactions_run_created_idx on public.live_interactions(run_id, created_at);

create or replace function public.open_live_interaction(p_interaction_id uuid)
returns public.live_interactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_result public.live_interactions;
begin
  select run_id into v_run_id from public.live_interactions where id = p_interaction_id;
  if v_run_id is null then
    raise exception 'Interaction not found';
  end if;
  if not exists (select 1 from public.live_runs r where r.id = v_run_id and public.is_live_event_staff(r.event_id)) then
    raise exception 'Not authorized';
  end if;

  update public.live_interactions
  set status = 'closed', closed_at = now()
  where run_id = v_run_id and status = 'live' and id <> p_interaction_id;

  update public.live_interactions
  set status = 'live', opened_at = now()
  where id = p_interaction_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.open_live_interaction(uuid) from public;
grant execute on function public.open_live_interaction(uuid) to authenticated;

create or replace function public.close_live_interaction(p_interaction_id uuid)
returns public.live_interactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_status text;
  v_result public.live_interactions;
begin
  select run_id, status into v_run_id, v_status from public.live_interactions where id = p_interaction_id;
  if v_run_id is null then
    raise exception 'Interaction not found';
  end if;
  if not exists (select 1 from public.live_runs r where r.id = v_run_id and public.is_live_event_staff(r.event_id)) then
    raise exception 'Not authorized';
  end if;
  if v_status <> 'live' then
    raise exception 'interaction_not_live';
  end if;

  update public.live_interactions
  set status = 'closed', closed_at = now()
  where id = p_interaction_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.close_live_interaction(uuid) from public;
grant execute on function public.close_live_interaction(uuid) to authenticated;
