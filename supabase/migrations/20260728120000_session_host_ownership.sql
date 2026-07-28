-- Bug-hunt audit (Critical): create-session and advance-question trusted the
-- game_code alone as authorization. game_code is a public, low-entropy,
-- client-displayed value (QR code, on-screen) — anyone who saw or guessed it
-- could overwrite a live session's questions/answer key, or hijack game-state
-- control mid-game. Bind each session to the user who created it and have
-- both edge functions verify the caller matches before mutating.
set local lock_timeout = '2s';
alter table session_state add column if not exists host_user_id uuid;

-- Drops the 8-param signature from 20260726170000_session_interaction_
-- settings.sql (the actual current signature at this point in migration
-- history) — not the older 6-param one, which no longer exists by the time
-- this migration runs. Dropping the wrong signature would silently no-op
-- (DROP ... IF EXISTS) and CREATE OR REPLACE would then add a second,
-- overloaded version of this function instead of replacing it, leaving two
-- ambiguous create_session_atomic definitions live at once.
drop function if exists create_session_atomic(text, text, jsonb, jsonb, text, int, boolean, boolean);

create or replace function create_session_atomic(
  p_game_code text,
  p_title text,
  p_public_questions jsonb,
  p_private_questions jsonb,
  p_ambiance_id text default 'arcade',
  p_max_participants int default null,
  p_live_reactions_enabled boolean default true,
  p_end_chat_enabled boolean default true,
  p_host_user_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_host uuid;
begin
  select host_user_id into v_existing_host from session_state where game_code = p_game_code;

  -- A session already bound to a host can only be re-created (host restart,
  -- per create-session's own comment) by that same host. NULL existing host
  -- (session created before this migration, or created anonymously) is
  -- adopted below rather than rejected, to avoid locking out in-flight games.
  if v_existing_host is not null and p_host_user_id is not null and v_existing_host <> p_host_user_id then
    raise exception 'Session % is owned by a different host', p_game_code using errcode = '42501';
  end if;

  insert into session_quiz_answers (game_code, questions, created_at)
  values (p_game_code, p_private_questions, now())
  on conflict (game_code) do update
    set questions = excluded.questions, created_at = excluded.created_at;

  insert into session_state (
    game_code, players, game_state, current_question_index,
    time_left, question_started_at, quiz_data, control, host_user_id, updated_at
  )
  values (
    p_game_code, '[]'::jsonb, 'waiting', 0,
    0, null,
    jsonb_build_object(
      'title', p_title,
      'questions', p_public_questions,
      'ambianceId', p_ambiance_id,
      'maxParticipants', p_max_participants,
      'liveReactionsEnabled', p_live_reactions_enabled,
      'endChatEnabled', p_end_chat_enabled
    ),
    '{}'::jsonb,
    p_host_user_id,
    now()
  )
  on conflict (game_code) do update
    set players = '[]'::jsonb,
        game_state = 'waiting',
        current_question_index = 0,
        time_left = 0,
        question_started_at = null,
        quiz_data = excluded.quiz_data,
        control = '{}'::jsonb,
        host_user_id = coalesce(session_state.host_user_id, excluded.host_user_id),
        updated_at = now();
end;
$$;
