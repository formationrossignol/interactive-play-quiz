-- Atomic session creation: writes the public quiz_data (session_state) and
-- the private answer key (session_quiz_answers) in a single transaction, so
-- a mid-write failure can never leave a stale public quiz paired with a
-- freshly-overwritten (or missing) private answer key — the exact gap a
-- two-step create-session (upsert, then upsert) has on every host restart,
-- since both upserts target the same game_code every time.
create or replace function create_session_atomic(
  p_game_code text,
  p_title text,
  p_public_questions jsonb,
  p_private_questions jsonb
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
    0, null, jsonb_build_object('title', p_title, 'questions', p_public_questions), now()
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
