import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

interface Body {
  examId: string;
  participantId: string;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const { examId, participantId }: Body = await req.json();
    if (!examId || !participantId) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Service-role, filtered server-side by the caller-supplied participant_id
    // — the thing exam_attempts_read_published could never do for an anon
    // caller (RLS has no way to bind a request to a claimed identity without
    // auth.uid()), which is exactly why that policy had to grant every
    // attempt of the exam instead of just this participant's own.
    const { data, error } = await supabase
      .from("exam_attempts").select("*")
      .eq("exam_id", examId).eq("participant_id", participantId);
    if (error) throw error;

    return new Response(JSON.stringify({ attempts: data ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[get-participant-attempts] error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
