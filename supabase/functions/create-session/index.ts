import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

interface FullQuestion {
  id: string;
  type: string;
  question: string;
  answers?: string[];
  correctAnswer?: unknown;
  correctValue?: unknown;
  correctOrder?: number[];
  correctMatches?: { leftId: string; rightId: string }[];
  blanks?: { correctAnswer: string }[];
  points?: number;
  timeLimit?: number;
  [key: string]: unknown;
}

interface CreateSessionBody {
  game_code: string;
  title: string;
  questions: FullQuestion[];
}

// Fields that must never reach the player. Anything not in this list is
// considered public (question text, options, media, timing, points).
const PRIVATE_FIELDS = ["correctAnswer", "correctValue", "correctOrder", "correctMatches", "blanks"] as const;

function stripAnswers(question: FullQuestion): FullQuestion {
  const publicQuestion = { ...question };
  for (const field of PRIVATE_FIELDS) {
    delete publicQuestion[field];
  }
  // fill-blank questions need blank *positions* (not answers) to render input
  // fields — reconstruct a blank-count-only shape so the player still sees
  // the right number of inputs without the answer key.
  if (question.type === "fill-blank" && question.blanks) {
    // The public shape intentionally has no `correctAnswer` on each blank —
    // that's the whole point of stripping it. Cast is required because the
    // declared `blanks` type still models the private (answer-bearing) shape.
    publicQuestion.blanks = question.blanks.map(() => ({})) as FullQuestion["blanks"];
  }
  return publicQuestion;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const body: CreateSessionBody = await req.json();
    const { game_code, title, questions } = body;

    if (!game_code || !Array.isArray(questions)) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const publicQuestions = questions.map(stripAnswers);
    const now = new Date().toISOString();

    // Write private half first: if this fails, we bail before the public
    // half is written, so a session is never half-created (public data
    // visible with no matching answer key for submit-answer to use).
    const { error: privateError } = await supabase
      .from("session_quiz_answers")
      .upsert({ game_code, questions, created_at: now }, { onConflict: "game_code" });

    if (privateError) {
      return new Response(JSON.stringify({ error: "Failed to store answer key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: publicError } = await supabase.from("session_state").upsert(
      {
        game_code,
        players: [],
        game_state: "waiting",
        current_question_index: 0,
        time_left: 0,
        question_started_at: null,
        quiz_data: { title, questions: publicQuestions },
        updated_at: now,
      },
      { onConflict: "game_code" }
    );

    if (publicError) {
      return new Response(JSON.stringify({ error: "Failed to create session" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
