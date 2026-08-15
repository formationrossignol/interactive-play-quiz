import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { calculateScore, type ExamQuestionForScoring } from "../_shared/examScoring.ts";

interface Body {
  attemptId: string;
  answers: Record<string, number | string | null>;
  timeUsedSeconds: number;
  mode: "manual" | "auto";
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const body: Body = await req.json();
    if (!body.attemptId || !body.answers) return jsonResponse({ error: "invalid_payload" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: attempt, error: attemptError } = await supabase
      .from("exam_attempts").select("*").eq("id", body.attemptId).maybeSingle();
    if (attemptError || !attempt) return jsonResponse({ error: "not_found" }, 404);

    // Idempotent: a retry (network blip, or the fire-and-forget auto-submit
    // racing a manual submit) returns the already-computed attempt instead
    // of recomputing or double-logging.
    if (attempt.status !== "in-progress") return jsonResponse({ attempt });

    const { data: keyRow, error: keyError } = await supabase
      .from("exam_answer_keys").select("questions").eq("exam_id", attempt.exam_id).maybeSingle();
    if (keyError || !keyRow) {
      console.error("[submit-exam-attempt] missing answer key for exam", attempt.exam_id);
      return jsonResponse({ error: "answer_key_missing" }, 500);
    }

    const { data: exam, error: examError } = await supabase
      .from("exams").select("passing_score").eq("id", attempt.exam_id).maybeSingle();
    if (examError || !exam) return jsonResponse({ error: "not_found" }, 404);

    // expires_at is server-computed at start (start_exam_attempt_atomic,
    // extra_time-aware — 20260815030000_exam_extra_time_engine.sql). Past it,
    // save_exam_answers already refuses further writes, so `attempt.answers`
    // is the last answer set saved before the deadline — trust that instead
    // of `body.answers`, which could carry edits typed after expiry that
    // just never made it past the (also expiry-gated) autosave. Also forces
    // the outcome to auto-submitted and clamps the recorded time regardless
    // of what the client claims, closing the gap a forged `mode`/
    // `timeUsedSeconds` payload would otherwise walk through.
    const isExpired = attempt.expires_at != null && new Date(attempt.expires_at).getTime() < Date.now();
    const answersToScore = isExpired ? (attempt.answers ?? {}) : body.answers;
    const { score, percentage, passed } = calculateScore(answersToScore, questions, exam.passing_score);

    const now = new Date().toISOString();
    const status = isExpired ? "auto-submitted" : (body.mode === "manual" ? "submitted" : "auto-submitted");
    const timeUsedSeconds = isExpired
      ? Math.max(0, Math.round((new Date(attempt.expires_at).getTime() - new Date(attempt.started_at).getTime()) / 1000))
      : body.timeUsedSeconds;
    const { data: updated, error: updateError } = await supabase
      .from("exam_attempts")
      .update({
        answers: answersToScore,
        time_used_seconds: timeUsedSeconds,
        submitted_at: now,
        score, percentage, passed,
        submission_mode: isExpired ? "auto" : body.mode,
        status,
        logs: [...(attempt.logs ?? []), { event: status, timestamp: now }],
      })
      .eq("id", body.attemptId)
      .select().single();
    if (updateError) throw updateError;

    return jsonResponse({ attempt: updated });
  } catch (err) {
    console.error("[submit-exam-attempt] error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
