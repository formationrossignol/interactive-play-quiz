-- Add ambiance to quiz_data so players hear the host-chosen music bed.
-- Adding a parameter changes the function signature, so drop the old 4-arg
-- version first (create-or-replace cannot alter the argument list).
drop function if exists create_session_atomic(text, text, jsonb, jsonb);

create or replace function create_session_atomic(
  p_game_code text,
  p_title text,
  p_public_questions jsonb,
  p_private_questions jsonb,
  p_ambiance_id text default 'arcade'
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
    time_left, question_started_at, quiz_data, updated_at
  )
  values (
    p_game_code, '[]'::jsonb, 'waiting', 0,
    0, null,
    jsonb_build_object('title', p_title, 'questions', p_public_questions, 'ambianceId', p_ambiance_id),
    now()
  )
  on conflict (game_code) do update
    set players = '[]'::jsonb,
        game_state = 'waiting',
        current_question_index = 0,
        time_left = 0,
        question_started_at = null,
        quiz_data = excluded.quiz_data,
        updated_at = now();
end;
$$;
