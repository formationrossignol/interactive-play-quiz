-- remove_session_player() is called by sessionState.ts's removePlayerFromSession
-- on every "leave game" (PlayerView unmount/back button) but was never
-- defined in the repo or on prod — the call silently errors (swallowed,
-- console.error only) and the leaving player keeps showing in every other
-- device's roster (host screen, leaderboard, participant count) until the
-- session ends. Mirrors create_session_atomic's style: same players jsonb
-- array shape on session_state, no security definer (session_state has no
-- RLS blocking plain function writes, same as create_session_atomic/
-- upsert_session_player already rely on).

create or replace function public.remove_session_player(p_game_code text, p_player_id text)
returns void
language sql
as $$
  update session_state
  set players = coalesce(
        (select jsonb_agg(elem) from jsonb_array_elements(players) elem where elem->>'id' <> p_player_id),
        '[]'::jsonb
      ),
      updated_at = now()
  where game_code = p_game_code;
$$;
