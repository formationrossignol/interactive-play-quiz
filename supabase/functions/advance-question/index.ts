import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { getCallerUserId } from "../_shared/auth.ts";

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

    // Every function in config.toml defaults to verify_jwt = true, so a valid
    // Authorization bearer is already guaranteed by the platform gateway —
    // this only fails if the request somehow arrived without one.
    const callerUserId = getCallerUserId(req);
    if (!callerUserId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // game_code alone is not an authorization credential — it's a public,
    // low-entropy, client-displayed value. Only the user session_state is
    // bound to (see 20260728120000_session_host_ownership.sql) may advance
    // it. A NULL host_user_id (session created before that migration) is
    // treated as unclaimed and allowed through, rather than locking out
    // in-flight games.
    const { data: hostRow, error: hostError } = await supabase
      .from("session_state")
      .select("host_user_id")
      .eq("game_code", game_code)
      .single();

    if (hostError || !hostRow) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (hostRow.host_user_id && hostRow.host_user_id !== callerUserId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
