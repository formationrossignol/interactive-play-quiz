import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { checkAnswerCorrect, calculateEarnedPoints, type QuestionForScoring } from "../_shared/scoring.ts";

interface SubmitAnswerBody {
  game_code: string;
  player_id: string;
  question_index: number;
  answer: number | string | null;
}

interface SharedPlayer {
  id: string;
  name: string;
  avatar: string;
  score: number;
  correctAnswers?: number;
  joinedAt: string;
  lastAnswer?: number;
  lastAnswerText?: string;
  lastAnswerQuestionIndex?: number;
  lastAnswerCorrect?: boolean;
  lastEarnedPoints?: number;
  [key: string]: unknown;
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
      .select("players, question_started_at, current_question_index")
      .eq("game_code", game_code)
      .single();

    if (stateError || !stateRow) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
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

    const players = (stateRow.players ?? []) as SharedPlayer[];
    const existingPlayer = players.find((p) => p.id === player_id);

    // Idempotent: a retry (network blip) for the same question returns the
    // already-computed result instead of recalculating or double-counting.
    if (existingPlayer?.lastAnswerQuestionIndex === question_index) {
      return new Response(
        JSON.stringify({
          correct: existingPlayer.lastAnswerCorrect ?? false,
          earnedPoints: existingPlayer.lastEarnedPoints ?? 0,
          ...buildCorrectAnswerPayload(question),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    const updatedPlayer: SharedPlayer = {
      ...(existingPlayer ?? { id: player_id, name: "", avatar: "", score: 0, joinedAt: new Date().toISOString() }),
      score: (existingPlayer?.score ?? 0) + earnedPoints,
      correctAnswers: (existingPlayer?.correctAnswers ?? 0) + (correct ? 1 : 0),
      lastAnswer: typeof answer === "number" ? answer : undefined,
      lastAnswerText:
        typeof answer === "string" && (question.type === "short-answer" || question.type === "open-text")
          ? answer.slice(0, 500)
          : undefined,
      lastAnswerQuestionIndex: question_index,
      lastAnswerCorrect: correct,
      lastEarnedPoints: earnedPoints,
    };

    // Persist via the existing upsert_session_player RPC rather than a manual
    // select-then-update: that RPC does SELECT ... FOR UPDATE + a single-row
    // merge inside one transaction, so concurrent submit-answer calls for
    // DIFFERENT players in the same session serialize instead of racing (a
    // naive read-modify-write here would let one player's write silently
    // overwrite another's under ordinary concurrent play).
    //
    // Scope note: the RPC merges by full-row REPLACE on matching id, not a
    // delta/increment — it protects cross-player writes, not two truly
    // concurrent submissions for the SAME player+question (e.g. overlapping
    // client retries). Not exploitable here (both would compute the same
    // earnedPoints for the same answer, so last-write-wins is idempotent in
    // practice), but if this RPC is ever reused for a case where two
    // concurrent calls for the same player could compute DIFFERENT point
    // values, that residual race would need a delta-based merge instead.
    const { error: upsertError } = await supabase.rpc("upsert_session_player", {
      p_game_code: game_code,
      p_player: updatedPlayer,
    });

    if (upsertError) {
      return new Response(JSON.stringify({ error: "Failed to save answer" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        correct,
        earnedPoints,
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
