-- Move hot live-session player state out of session_state.players.  The old
-- jsonb column is kept during the rollout so older rows remain readable, but
-- all current writers/readers use one row per player below.  This removes the
-- single session_state row lock from concurrent answer submissions.

create table if not exists public.session_players (
  game_code text not null references public.session_state(game_code) on delete cascade on update cascade,
  player_id text not null,
  player jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (game_code, player_id),
  constraint session_players_player_id_matches_payload
    check (player_id = player->>'id')
);

-- Preserve active sessions when this migration is deployed.  Duplicate ids in
-- a legacy array collapse deterministically to the last json value seen by the
-- upsert; subsequent writes are protected by the primary key.
insert into public.session_players (game_code, player_id, player, updated_at)
select legacy.game_code, legacy.player_id, legacy.player, legacy.updated_at
from (
  select distinct on (s.game_code, p.player->>'id')
    s.game_code,
    p.player->>'id' as player_id,
    p.player,
    coalesce(s.updated_at, now()) as updated_at
  from public.session_state s
  cross join lateral jsonb_array_elements(coalesce(s.players, '[]'::jsonb))
    with ordinality as p(player, ordinal)
  where nullif(p.player->>'id', '') is not null
  order by s.game_code, p.player->>'id', p.ordinal desc
) legacy
on conflict (game_code, player_id) do update
set player = excluded.player,
    updated_at = greatest(public.session_players.updated_at, excluded.updated_at);

alter table public.session_players enable row level security;

-- Live rooms are intentionally readable by unauthenticated participants, just
-- like session_state.  Mutations stay behind the validated RPCs below.
create policy session_players_read_live
on public.session_players
for select
to anon, authenticated
using (true);

revoke insert, update, delete on public.session_players from anon, authenticated;
grant select on public.session_players to anon, authenticated;

-- Supabase Realtime emits a small row-level delta instead of retransmitting an
-- O(players) json array for every heartbeat/answer.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'session_players'
  ) then
    alter publication supabase_realtime add table public.session_players;
  end if;
end;
$$;

create or replace function public.upsert_session_player(
  p_game_code text,
  p_player jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id text := nullif(p_player->>'id', '');
  v_existing jsonb;
  v_incoming jsonb := p_player;
  v_is_scored_quiz boolean;
  v_kicked_ids jsonb;
begin
  if v_player_id is null or length(v_player_id) > 200 then
    raise exception 'Invalid player id' using errcode = '22023';
  end if;
  if jsonb_typeof(p_player) <> 'object' or pg_column_size(p_player) > 16384 then
    raise exception 'Invalid player payload' using errcode = '22023';
  end if;

  select coalesce(control->'kickedIds', '[]'::jsonb)
  into v_kicked_ids
  from public.session_state
  where game_code = p_game_code;

  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;
  if v_kicked_ids @> jsonb_build_array(v_player_id) then
    raise exception 'Player has been removed from this session' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.session_quiz_answers where game_code = p_game_code
  ) into v_is_scored_quiz;

  -- Quiz scores and answer markers are server-authoritative.  Client writes in
  -- scored quizzes are limited to identity, heartbeat and reaction data. Polls
  -- have no answer-key row and retain their existing direct-answer behaviour.
  if v_is_scored_quiz then
    v_incoming := v_incoming
      - 'score'
      - 'correctAnswers'
      - 'lastAnswer'
      - 'lastAnswerText'
      - 'lastAnswerQuestionIndex'
      - 'lastAnswerCorrect'
      - 'lastEarnedPoints';
  end if;

  -- Establish the row first, then lock only this player.  Concurrent players
  -- never contend; concurrent writes for one player merge serially.
  insert into public.session_players (game_code, player_id, player)
  values (
    p_game_code,
    v_player_id,
    jsonb_build_object(
      'id', v_player_id,
      'score', 0,
      'correctAnswers', 0,
      'joinedAt', coalesce(p_player->>'joinedAt', now()::text)
    )
  )
  on conflict (game_code, player_id) do nothing;

  select player
  into v_existing
  from public.session_players
  where game_code = p_game_code and player_id = v_player_id
  for update;

  update public.session_players
  set player = v_existing || v_incoming || jsonb_build_object('id', v_player_id),
      updated_at = now()
  where game_code = p_game_code and player_id = v_player_id;
end;
$$;

revoke all on function public.upsert_session_player(text, jsonb) from public;
grant execute on function public.upsert_session_player(text, jsonb) to anon, authenticated, service_role;

-- Atomic, idempotent scoring write.  submit-answer calls this with a service
-- role after validating the question and computing correctness.  A retry for
-- the same player/question returns the first persisted result without adding
-- points twice.  Contention is scoped to that player's primary-key row.
create or replace function public.submit_session_answer(
  p_game_code text,
  p_player_id text,
  p_question_index integer,
  p_last_answer integer,
  p_last_answer_text text,
  p_correct boolean,
  p_earned_points integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player jsonb;
  v_updated jsonb;
  v_score numeric;
  v_correct_answers integer;
  v_existing_question integer;
  v_existing_correct boolean;
  v_existing_points integer;
begin
  if nullif(p_player_id, '') is null or length(p_player_id) > 200
     or p_question_index < 0 or p_earned_points < 0 then
    raise exception 'Invalid answer payload' using errcode = '22023';
  end if;

  insert into public.session_players (game_code, player_id, player)
  values (
    p_game_code,
    p_player_id,
    jsonb_build_object(
      'id', p_player_id,
      'name', '',
      'avatar', '',
      'score', 0,
      'correctAnswers', 0,
      'joinedAt', now()::text
    )
  )
  on conflict (game_code, player_id) do nothing;

  select player
  into v_player
  from public.session_players
  where game_code = p_game_code and player_id = p_player_id
  for update;

  v_existing_question := case
    when jsonb_typeof(v_player->'lastAnswerQuestionIndex') = 'number'
      then (v_player->>'lastAnswerQuestionIndex')::integer
    else null
  end;

  if v_existing_question = p_question_index then
    v_existing_correct := case
      when jsonb_typeof(v_player->'lastAnswerCorrect') = 'boolean'
        then (v_player->>'lastAnswerCorrect')::boolean
      else false
    end;
    v_existing_points := case
      when jsonb_typeof(v_player->'lastEarnedPoints') = 'number'
        then (v_player->>'lastEarnedPoints')::integer
      else 0
    end;
    return jsonb_build_object(
      'correct', v_existing_correct,
      'earnedPoints', v_existing_points,
      'created', false
    );
  end if;

  v_score := case
    when jsonb_typeof(v_player->'score') = 'number' then (v_player->>'score')::numeric
    else 0
  end;
  v_correct_answers := case
    when jsonb_typeof(v_player->'correctAnswers') = 'number'
      then (v_player->>'correctAnswers')::integer
    else 0
  end;

  v_updated := (v_player
      - 'lastAnswer'
      - 'lastAnswerText'
      - 'lastAnswerQuestionIndex'
      - 'lastAnswerCorrect'
      - 'lastEarnedPoints')
    || jsonb_build_object(
      'id', p_player_id,
      'score', v_score + p_earned_points,
      'correctAnswers', v_correct_answers + case when p_correct then 1 else 0 end,
      'lastAnswerQuestionIndex', p_question_index,
      'lastAnswerCorrect', p_correct,
      'lastEarnedPoints', p_earned_points
    )
    || jsonb_strip_nulls(jsonb_build_object(
      'lastAnswer', p_last_answer,
      'lastAnswerText', left(p_last_answer_text, 500)
    ));

  update public.session_players
  set player = v_updated,
      updated_at = now()
  where game_code = p_game_code and player_id = p_player_id;

  return jsonb_build_object(
    'correct', p_correct,
    'earnedPoints', p_earned_points,
    'created', true
  );
end;
$$;

revoke all on function public.submit_session_answer(text, text, integer, integer, text, boolean, integer) from public;
grant execute on function public.submit_session_answer(text, text, integer, integer, text, boolean, integer) to service_role;

create or replace function public.remove_session_player(p_game_code text, p_player_id text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.session_players
  where game_code = p_game_code and player_id = p_player_id;
$$;

revoke all on function public.remove_session_player(text, text) from public;
grant execute on function public.remove_session_player(text, text) to anon, authenticated, service_role;

-- Keep a new quiz run and its empty player shard set in the same transaction.
-- This is the current 9-argument signature from session_host_ownership.sql.
create or replace function public.create_session_atomic(
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
  select host_user_id into v_existing_host
  from public.session_state
  where game_code = p_game_code;

  if v_existing_host is not null and p_host_user_id is not null and v_existing_host <> p_host_user_id then
    raise exception 'Session % is owned by a different host', p_game_code using errcode = '42501';
  end if;

  delete from public.session_players where game_code = p_game_code;

  insert into public.session_quiz_answers (game_code, questions, created_at)
  values (p_game_code, p_private_questions, now())
  on conflict (game_code) do update
    set questions = excluded.questions, created_at = excluded.created_at;

  insert into public.session_state (
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

revoke all on function public.create_session_atomic(text, text, jsonb, jsonb, text, int, boolean, boolean, uuid) from public;
grant execute on function public.create_session_atomic(text, text, jsonb, jsonb, text, int, boolean, boolean, uuid) to service_role;
