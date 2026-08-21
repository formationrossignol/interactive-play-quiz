import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { checkAnswerCorrect, calculateEarnedPoints, type QuestionForScoring } from "../_shared/scoring.ts";

interface SubmitAnswerBody {
  game_code: string;
  player_id: string;
  question_index: number;
  answer: number | string | null;
}

/** Full answer-key payload for the reveal screen — covers every implemented
 *  question type, not just multiple-choice/slider. Only ever returned in
 *  response to the player's OWN submission for the CURRENT question (see the
 *  question_index === current_question_index check below), never in advance. */
function buildCorrectAnswerPayload(question: QuestionForScoring) {
  return {
    correctAnswer: question.correctAnswer ?? null,
    correctValue: question.correctValue ?? null,
    correctOrder: question.correctOrder ?? null,
    correctMatches: question.correctMatches ?? null,
    blanks: question.blanks ?? null,
  };
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const body: SubmitAnswerBody = await req.json();
    const { game_code, player_id, question_index, answer } = body;

    if (!game_code || !player_id || typeof question_index !== "number") {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: answerRow, error: answerError } = await supabase
      .from("session_quiz_answers")
      .select("questions")
      .eq("game_code", game_code)
      .single();

    if (answerError || !answerRow) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const questions = answerRow.questions as QuestionForScoring[];
    const question = questions[question_index];
    if (!question) {
      return new Response(JSON.stringify({ error: "Question not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: stateRow, error: stateError } = await supabase
      .from("session_state")
      .select("question_started_at, current_question_index, control")
      .eq("game_code", game_code)
      .single();

    if (stateError || !stateRow) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Host-authoritative kick list: a removed player has no row left in
    // `players`, so without this check a kicked client's retry would fall
    // through to the "new player" branch below and get silently re-upserted,
    // defeating the kick.
    const kickedIds = (stateRow.control as { kickedIds?: unknown } | null)?.kickedIds;
    if (Array.isArray(kickedIds) && kickedIds.includes(player_id)) {
      return new Response(JSON.stringify({ error: "You have been removed from this session" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Trust boundary: only the question the host has actually advanced to may
    // be answered/revealed. Without this check, any caller who knows game_code
    // could request scoring for any question_index at any time — including
    // ones not yet presented — and read that question's answer key from the
    // response below. This is what actually closes audit finding H-6; the
    // private-table split alone isn't sufficient without this check too.
    if (question_index !== stateRow.current_question_index) {
      return new Response(JSON.stringify({ error: "This question is not currently active" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // isPoll is always false here: submit-answer is exclusively the quiz-live
    // path (per this plan's scope decision) — polls keep using the pre-existing
    // direct upsertPlayerInSession path, unchanged. checkAnswerCorrect's isPoll
    // parameter is a hard boundary against future misuse, not a live branch here.
    const correct = checkAnswerCorrect(question, answer, false);

    const startedAt = stateRow.question_started_at ? new Date(stateRow.question_started_at).getTime() : Date.now();
    const elapsedSeconds = Math.max(0, (Date.now() - startedAt) / 1000);
    const basePoints = (question as { points?: number }).points ?? 100;
    const timeLimit = (question as { timeLimit?: number }).timeLimit ?? 30;
    const earnedPoints = calculateEarnedPoints(basePoints, elapsedSeconds, timeLimit, correct);

    // Persist through a row-per-player RPC. It locks only
    // session_players(game_code, player_id), so answers from different players
    // proceed concurrently. The RPC also owns the idempotency check: overlapping
    // retries for one player/question return the first committed result.
    const lastAnswer =
      typeof answer === "number"
        ? answer
        : answer === "true"
        ? 0
        : answer === "false"
        ? 1
        : null;
    const lastAnswerText =
      typeof answer === "string" && (question.type === "short-answer" || question.type === "open-text")
        ? answer.slice(0, 500)
        : null;

    const { data: persisted, error: upsertError } = await supabase.rpc("submit_session_answer", {
      p_game_code: game_code,
      p_player_id: player_id,
      p_question_index: question_index,
      p_last_answer: lastAnswer,
      p_last_answer_text: lastAnswerText,
      p_correct: correct,
      p_earned_points: earnedPoints,
    });

    if (upsertError) {
      return new Response(JSON.stringify({ error: "Failed to save answer" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const persistedResult = persisted as { correct?: boolean; earnedPoints?: number } | null;

    return new Response(
      JSON.stringify({
        correct: persistedResult?.correct ?? correct,
        earnedPoints: persistedResult?.earnedPoints ?? earnedPoints,
        ...buildCorrectAnswerPayload(question),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
