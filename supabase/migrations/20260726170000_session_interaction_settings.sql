-- Persist per-quiz live interaction settings in public quiz_data so every
-- participant device can hide reactions and/or the final chat consistently.
drop function if exists create_session_atomic(text, text, jsonb, jsonb, text, int);

create or replace function create_session_atomic(
  p_game_code text,
  p_title text,
  p_public_questions jsonb,
  p_private_questions jsonb,
  p_ambiance_id text default 'arcade',
  p_max_participants int default null,
  p_live_reactions_enabled boolean default true,
  p_end_chat_enabled boolean default true
) returns void
language plpgsql
as $$
begin
  insert into session_quiz_answers (game_code, questions, created_at)
  values (p_game_code, p_private_questions, now())
  on conflict (game_code) do update
    set questions = excluded.questions, created_at = excluded.created_at;

  insert into session_state (
    game_code, players, game_state, current_question_index,
    time_left, question_started_at, quiz_data, control, updated_at
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
        updated_at = now();
end;
$$;
