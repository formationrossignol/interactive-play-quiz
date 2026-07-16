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
  ambiance_id?: string;
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
    const { game_code, title, questions, ambiance_id } = body;

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

    // Both halves are written inside a single Postgres transaction via this
    // RPC (see supabase/migrations/20260712130000_create_session_atomic.sql)
    // rather than two separate upserts. A two-step write here can't be made
    // safe with simple ordering: create-session runs on EVERY host restart
    // for the same game_code (not just first creation), so a failure between
    // the two upserts would leave the OLD public quiz paired with the NEW
    // private answer key — not "half-created", but silently mismatched,
    // scoring future answers against the wrong question set.
    const { error: rpcError } = await supabase.rpc("create_session_atomic", {
      p_game_code: game_code,
      p_title: title,
      p_public_questions: publicQuestions,
      p_private_questions: questions,
      p_ambiance_id: ambiance_id ?? "arcade",
    });

    if (rpcError) {
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
