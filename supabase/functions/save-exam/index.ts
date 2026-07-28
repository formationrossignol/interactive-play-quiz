import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";
import { stripAnswerKey } from "../_shared/examScoring.ts";
import { AUDIENCE_CAP, EXAM_CAP, normalizePlan } from "../_shared/plans.ts";

interface SaveExamBody {
  examId?: string;
  title: string;
  description: string;
  headerImage?: string;
  quizId: string;
  openAt: string;
  closeAt: string;
  durationMinutes: number | null;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  passingScore: number;
  showResultsPolicy: string;
  showDetailPolicy: string;
  scoreRetentionPolicy: string;
  status: string;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genJoinCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return code;
}
function genExamId(): string {
  return crypto.randomUUID();
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
    const user = await getAuthenticatedUser(req);
    if (!user) return jsonResponse({ error: "not_authenticated" }, 401);

    const body: SaveExamBody = await req.json();
    if (!body.title?.trim() || !body.quizId) {
      return jsonResponse({ error: "invalid_payload" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Ownership check for updates — bypassing RLS via service-role means we
    // must enforce host_id === caller ourselves.
    if (body.examId) {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("exams").select("host_id").eq("id", body.examId).maybeSingle();
      if (existingError || !existing) return jsonResponse({ error: "not_found" }, 404);
      if (existing.host_id !== user.id) return jsonResponse({ error: "forbidden" }, 403);
    } else {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("plan").eq("id", user.id).maybeSingle();
      const plan = normalizePlan(profile?.plan);
      const cap = EXAM_CAP[plan];
      if (cap !== null) {
        const { count } = await supabaseAdmin
          .from("exams").select("id", { count: "exact", head: true })
          .eq("host_id", user.id).neq("status", "archived");
        if ((count ?? 0) >= cap) return jsonResponse({ error: "plan_limit", cap, plan }, 409);
      }
    }

    const { data: quizRow, error: quizError } = await supabaseAdmin
      .from("content").select("data")
      .eq("type", "quiz").eq("source_id", body.quizId).eq("user_id", user.id)
      .maybeSingle();
    if (quizError || !quizRow) return jsonResponse({ error: "quiz_not_found" }, 404);

    const questions = ((quizRow.data as { questions?: Record<string, unknown>[] })?.questions ?? []);
    const questionsPublic = questions.map(stripAnswerKey);

    const rowPatch = {
      title: body.title.trim(),
      description: body.description ?? "",
      header_image: body.headerImage || null,
      quiz_id: body.quizId,
      open_at: body.openAt,
      close_at: body.closeAt,
      duration_minutes: body.durationMinutes,
      max_attempts: body.maxAttempts,
      shuffle_questions: body.shuffleQuestions,
      shuffle_answers: body.shuffleAnswers,
      passing_score: body.passingScore,
      show_results_policy: body.showResultsPolicy,
      show_detail_policy: body.showDetailPolicy,
      score_retention_policy: body.scoreRetentionPolicy,
      status: body.status,
      questions_public: questionsPublic,
    };

    let examRow: Record<string, unknown> | null = null;

    if (body.examId) {
      const { data, error } = await supabaseAdmin
        .from("exams").update(rowPatch).eq("id", body.examId).select().single();
      if (error) throw error;
      examRow = data;
      const { error: keyError } = await supabaseAdmin
        .from("exam_answer_keys")
        .upsert({ exam_id: body.examId, questions }, { onConflict: "exam_id" });
      if (keyError) throw keyError;
    } else {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("plan").eq("id", user.id).maybeSingle();
      const plan = normalizePlan(profile?.plan);
      const examId = genExamId();

      let inserted: Record<string, unknown> | null = null;
      for (let i = 0; i < 5 && !inserted; i++) {
        const { data, error } = await supabaseAdmin
          .from("exams")
          .insert({
            id: examId, host_id: user.id, join_code: genJoinCode(),
            max_participants: AUDIENCE_CAP[plan], ...rowPatch,
          })
          .select().single();
        if (!error) { inserted = data; break; }
        if (error.code !== "23505") throw error;
      }
      if (!inserted) return jsonResponse({ error: "join_code_conflict" }, 500);
      examRow = inserted;

      const { error: keyError } = await supabaseAdmin
        .from("exam_answer_keys").insert({ exam_id: examId, questions });
      if (keyError) throw keyError;
    }

    return jsonResponse({ exam: examRow });
  } catch (err) {
    console.error("[save-exam] error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
