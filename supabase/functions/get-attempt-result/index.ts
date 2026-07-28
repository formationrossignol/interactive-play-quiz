import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { buildCorrectionPayload } from "../_shared/examScoring.ts";

interface Body {
  attemptId: string;
  participantId: string;
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
    const { attemptId, participantId }: Body = await req.json();
    if (!attemptId || !participantId) return jsonResponse({ error: "invalid_payload" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: attempt, error: attemptError } = await supabase
      .from("exam_attempts").select("*").eq("id", attemptId).maybeSingle();
    // Ownership proof: same trust level as everywhere else a participant is
    // identified in this app (a client-generated id, no auth session) — but
    // unlike the dropped exam_attempts_read_published, this is enforced
    // server-side against the specific attempt row, not "anyone with the
    // exam's uuid gets every attempt".
    if (attemptError || !attempt || attempt.participant_id !== participantId) {
      return jsonResponse({ error: "not_found" }, 404);
    }

    const { data: exam, error: examError } = await supabase
      .from("exams").select("*").eq("id", attempt.exam_id).maybeSingle();
    if (examError || !exam) return jsonResponse({ error: "not_found" }, 404);

    if (exam.show_results_policy === "never") {
      return jsonResponse({ error: "results_not_available" }, 403);
    }
    if (exam.show_results_policy === "after-close" && new Date(exam.close_at) > new Date()) {
      return jsonResponse({ error: "results_after_close", closeAt: exam.close_at }, 403);
    }

    let correction: Record<string, unknown>[] | undefined;
    if (exam.show_detail_policy === "score-correction") {
      const { data: keyRow } = await supabase
        .from("exam_answer_keys").select("questions").eq("exam_id", attempt.exam_id).maybeSingle();
      const questions = (keyRow?.questions as Record<string, unknown>[] | undefined) ?? [];
      correction = questions.map(buildCorrectionPayload);
    }

    return jsonResponse({
      attempt,
      exam: {
        title: exam.title,
        passingScore: exam.passing_score,
        showResultsPolicy: exam.show_results_policy,
        showDetailPolicy: exam.show_detail_policy,
      },
      questionsPublic: exam.questions_public,
      correction,
    });
  } catch (err) {
    console.error("[get-attempt-result] error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
