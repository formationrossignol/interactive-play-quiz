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
      .select("players, question_started_at")
      .eq("game_code", game_code)
      .single();

    if (stateError || !stateRow) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
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
          correctAnswer: question.correctAnswer ?? question.correctValue ?? null,
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

    const nextPlayers = existingPlayer
      ? players.map((p) => (p.id === player_id ? updatedPlayer : p))
      : [...players, updatedPlayer];

    const { error: upsertError } = await supabase
      .from("session_state")
      .update({ players: nextPlayers, updated_at: new Date().toISOString() })
      .eq("game_code", game_code);

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
        correctAnswer: question.correctAnswer ?? question.correctValue ?? null,
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
