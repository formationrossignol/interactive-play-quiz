import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

interface AdvanceQuestionBody {
  game_code: string;
  question_index: number;
  game_state: string;
  time_left: number;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const body: AdvanceQuestionBody = await req.json();
    const { game_code, question_index, game_state, time_left } = body;

    if (!game_code || typeof question_index !== "number" || !game_state) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();
    const questionStartedAt = game_state === "question" ? now : null;

    // .update() alone reports no error on zero matched rows (stale/wrong
    // game_code, or a race before create-session has run) — .select() forces
    // it to return the updated row so we can 404 instead of falsely claiming
    // success when nothing was actually advanced.
    const { data, error } = await supabase
      .from("session_state")
      .update({
        current_question_index: question_index,
        game_state,
        time_left,
        question_started_at: questionStartedAt,
        updated_at: now,
      })
      .eq("game_code", game_code)
      .select("game_code");

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to advance question" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, question_started_at: questionStartedAt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
