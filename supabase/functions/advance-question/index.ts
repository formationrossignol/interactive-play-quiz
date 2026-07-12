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
    const { error } = await supabase
      .from("session_state")
      .update({
        current_question_index: question_index,
        game_state,
        time_left,
        question_started_at: game_state === "question" ? now : null,
        updated_at: now,
      })
      .eq("game_code", game_code);

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to advance question" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, question_started_at: game_state === "question" ? now : null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
