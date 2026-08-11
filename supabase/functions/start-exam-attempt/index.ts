import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { getCallerUserId } from "../_shared/auth.ts";

interface Body {
  examId: string;
  participantId: string;
  participantName: string;
  participantEmail: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const body: Body = await req.json();
    if (!body.examId || !body.participantId || !body.participantName) {
      return jsonResponse({ error: "invalid_payload" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: exam, error: examError } = await supabase
      .from("exams").select("*").eq("id", body.examId).maybeSingle();
    if (examError || !exam) return jsonResponse({ error: "not_found" }, 404);

    let questionOrder = (exam.questions_public as { id: string }[] ?? []).map((q) => q.id);
    if (exam.shuffle_questions) questionOrder = shuffle(questionOrder);

    // Only set when the caller has a real Supabase session (not the anon
    // key) — an exam taken while logged in gets synced into the LMS
    // gradebook (see sync_exam_attempt_to_gradebook()); anonymous join-code
    // takers stay exactly as untracked as before.
    const learnerId = getCallerUserId(req);

    const { data: result, error: rpcError } = await supabase.rpc("start_exam_attempt_atomic", {
      p_exam_id: body.examId,
      p_participant_id: body.participantId,
      p_participant_name: body.participantName,
      p_participant_email: body.participantEmail ?? "",
      p_max_attempts: exam.max_attempts,
      p_max_participants: exam.max_participants,
      p_question_order: questionOrder,
      p_learner_id: learnerId,
    });
    if (rpcError) throw rpcError;

    return jsonResponse(result);
  } catch (err) {
    console.error("[start-exam-attempt] error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
