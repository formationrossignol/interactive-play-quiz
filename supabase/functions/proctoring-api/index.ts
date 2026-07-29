import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { getCallerUserId } from "../_shared/auth.ts";

type Severity = "info" | "warning" | "critical";

interface RequestBody {
  action: "verify-environment" | "record-event" | "upload-capture" | "get-overview" | "review-report" | "purge-expired";
  examId?: string;
  attemptId?: string;
  participantId?: string;
  type?: string;
  severity?: Severity;
  durationMs?: number;
  details?: Record<string, unknown>;
  pageUrl?: string;
  environment?: {
    detected?: boolean;
    version?: string | null;
    browserExamKey?: string | null;
    configKey?: string | null;
  };
  source?: "webcam" | "screen";
  trigger?: "manual" | "periodic" | "event";
  contentType?: string;
  base64?: string;
  analysis?: Record<string, unknown>;
  decision?: "compliant" | "review" | "non-compliant";
  note?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const bytesToHex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");

async function sha256(value: string): Promise<string> {
  return bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function parseVersion(value: string | null | undefined): number[] {
  if (!value) return [];
  const match = value.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)] : [];
}

function versionAtLeast(actual: string | null | undefined, expected: string): boolean {
  const left = parseVersion(actual);
  const right = parseVersion(expected);
  if (!left.length || !right.length) return false;
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    if ((left[index] ?? 0) > (right[index] ?? 0)) return true;
    if ((left[index] ?? 0) < (right[index] ?? 0)) return false;
  }
  return true;
}

const ALERT_TITLES: Record<string, string> = {
  tab_hidden: "Changement d’onglet",
  focus_lost: "Perte de focus prolongée",
  fullscreen_exited: "Sortie du plein écran",
  abnormal_resize: "Redimensionnement inhabituel",
  camera_disabled: "Caméra désactivée",
  microphone_disabled: "Microphone désactivé",
  screen_share_stopped: "Partage d’écran interrompu",
  multiple_screens: "Plusieurs écrans détectés",
  camera_obstructed: "Caméra possiblement obstruée",
  unusual_audio: "Activité sonore inhabituelle",
  seb_verification_failed: "Vérification SEB refusée",
};

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const body: RequestBody = await req.json();
    if (!body.action) return json({ error: "invalid_payload" }, 400);

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const callerId = getCallerUserId(req);

    if (body.action === "purge-expired") {
      const suppliedSecret = req.headers.get("X-Proctoring-Cleanup-Secret");
      const cleanupSecret = Deno.env.get("PROCTORING_CLEANUP_SECRET");
      if (!cleanupSecret || suppliedSecret !== cleanupSecret) return json({ error: "forbidden" }, 403);
      const { data: expiredCaptures, error: captureReadError } = await db
        .from("exam_proctoring_captures")
        .select("id, storage_path")
        .lte("expires_at", new Date().toISOString())
        .limit(500);
      if (captureReadError) throw captureReadError;
      const paths = (expiredCaptures ?? []).map((capture) => capture.storage_path);
      if (paths.length) {
        const { error: removeError } = await db.storage.from("exam-proctoring").remove(paths);
        if (removeError) throw removeError;
        await db.from("exam_proctoring_captures").delete().in("id", (expiredCaptures ?? []).map((capture) => capture.id));
      }
      const now = new Date().toISOString();
      const [alerts, events, reports, accesses] = await Promise.all([
        db.from("exam_proctoring_alerts").delete().lte("expires_at", now).select("id"),
        db.from("exam_proctoring_events").delete().lte("expires_at", now).select("id"),
        db.from("exam_proctoring_reports").delete().lte("expires_at", now).select("id"),
        db.from("exam_proctoring_access_log").delete().lte("expires_at", now).select("id"),
      ]);
      return json({
        ok: true,
        deleted: {
          captures: paths.length,
          alerts: alerts.data?.length ?? 0,
          events: events.data?.length ?? 0,
          reports: reports.data?.length ?? 0,
          accessLogs: accesses.data?.length ?? 0,
        },
        remainingCaptureBatch: paths.length === 500,
      });
    }

    if (!body.examId) return json({ error: "invalid_payload" }, 400);

    const { data: exam, error: examError } = await db
      .from("exams")
      .select("id, host_id, proctoring_config")
      .eq("id", body.examId)
      .maybeSingle();
    if (examError || !exam) return json({ error: "exam_not_found" }, 404);

    const config = (exam.proctoring_config ?? {}) as Record<string, unknown>;
    const retentionDays = Math.max(1, Math.min(3650, Number(config.retentionDays ?? 90)));
    const expiresAt = new Date(Date.now() + retentionDays * 86400000).toISOString();

    if (body.action === "verify-environment") {
      if (config.enabled !== true || config.sebRequired !== true) return json({ valid: true });
      if (!body.environment?.detected) return json({ valid: false, reason: "seb_not_detected" });
      if (!versionAtLeast(body.environment.version, String(config.sebMinVersion ?? "3.3.2"))) {
        return json({ valid: false, reason: "seb_version_too_old" });
      }

      const { data: secrets } = await db
        .from("exam_proctoring_secrets")
        .select("browser_exam_keys, config_keys")
        .eq("exam_id", body.examId)
        .maybeSingle();
      const browserKeys = (secrets?.browser_exam_keys ?? []) as string[];
      const configKeys = (secrets?.config_keys ?? []) as string[];
      if (!browserKeys.length && !configKeys.length) return json({ valid: false, reason: "seb_key_missing" });

      const pageUrl = String(body.pageUrl ?? "").split("#")[0];
      const expectedBrowser = await Promise.all(browserKeys.map((key) => sha256(pageUrl + key)));
      const expectedConfig = await Promise.all(configKeys.map((key) => sha256(pageUrl + key)));
      const browserValid = body.environment.browserExamKey
        ? expectedBrowser.some((key) => key.toLowerCase() === body.environment!.browserExamKey!.toLowerCase())
        : false;
      const configValid = body.environment.configKey
        ? expectedConfig.some((key) => key.toLowerCase() === body.environment!.configKey!.toLowerCase())
        : false;
      return json({ valid: browserValid || configValid, reason: browserValid || configValid ? undefined : "seb_key_mismatch" });
    }

    if (body.action === "get-overview" || body.action === "review-report") {
      if (!callerId) return json({ error: "not_authenticated" }, 401);
      if (exam.host_id !== callerId) return json({ error: "forbidden" }, 403);

      if (body.action === "review-report") {
        if (!body.attemptId || !body.decision) return json({ error: "invalid_payload" }, 400);
        const { error } = await db.from("exam_proctoring_reports").upsert({
          exam_id: body.examId,
          attempt_id: body.attemptId,
          teacher_decision: body.decision,
          teacher_note: body.note ?? "",
          validation_status: "reviewed",
          validated_at: new Date().toISOString(),
          validated_by: callerId,
          expires_at: expiresAt,
        }, { onConflict: "attempt_id" });
        if (error) throw error;
        await db.from("exam_proctoring_access_log").insert({
          exam_id: body.examId,
          attempt_id: body.attemptId,
          actor_id: callerId,
          action: "review_report",
          resource_type: "report",
          details: { decision: body.decision },
          expires_at: expiresAt,
        });
        return json({ ok: true });
      }

      const [attemptsResult, eventsResult, alertsResult, capturesResult, reportsResult] = await Promise.all([
        db.from("exam_attempts").select("id, participant_name").eq("exam_id", body.examId),
        db.from("exam_proctoring_events").select("*").eq("exam_id", body.examId).order("occurred_at"),
        db.from("exam_proctoring_alerts").select("*").eq("exam_id", body.examId).order("occurred_at"),
        db.from("exam_proctoring_captures").select("*").eq("exam_id", body.examId).order("occurred_at"),
        db.from("exam_proctoring_reports").select("*").eq("exam_id", body.examId),
      ]);
      const captures = await Promise.all((capturesResult.data ?? []).map(async (capture) => {
        const { data } = await db.storage.from("exam-proctoring").createSignedUrl(capture.storage_path, 300);
        return { ...capture, signed_url: data?.signedUrl };
      }));
      await db.from("exam_proctoring_access_log").insert({
        exam_id: body.examId,
        actor_id: callerId,
        action: "view_overview",
        resource_type: "exam",
        resource_id: body.examId,
        expires_at: expiresAt,
      });
      const attempts = (attemptsResult.data ?? []).map((attempt) => ({
        attemptId: attempt.id,
        participantName: attempt.participant_name,
        events: (eventsResult.data ?? []).filter((event) => event.attempt_id === attempt.id).map(mapEvent),
        alerts: (alertsResult.data ?? []).filter((alert) => alert.attempt_id === attempt.id).map(mapAlert),
        captures: captures.filter((capture) => capture.attempt_id === attempt.id).map(mapCapture),
        report: mapReport((reportsResult.data ?? []).find((report) => report.attempt_id === attempt.id) ?? null),
      }));
      return json({ attempts });
    }

    if (!body.attemptId || !body.participantId) return json({ error: "invalid_payload" }, 400);
    const { data: attempt } = await db
      .from("exam_attempts")
      .select("id, exam_id, participant_id, status")
      .eq("id", body.attemptId)
      .eq("exam_id", body.examId)
      .eq("participant_id", body.participantId)
      .maybeSingle();
    if (!attempt || attempt.status !== "in-progress") return json({ error: "attempt_not_active" }, 403);

    if (body.action === "record-event") {
      if (!body.type) return json({ error: "invalid_payload" }, 400);
      const occurrence = Number(body.details?.occurrence ?? 1);
      const { data: event, error } = await db.from("exam_proctoring_events").insert({
        exam_id: body.examId,
        attempt_id: body.attemptId,
        participant_id: body.participantId,
        event_type: body.type,
        severity: body.severity ?? "info",
        duration_ms: body.durationMs ?? null,
        occurrence,
        details: body.details ?? {},
        expires_at: expiresAt,
      }).select().single();
      if (error) throw error;

      if ((body.severity === "warning" || body.severity === "critical") && ALERT_TITLES[body.type]) {
        await db.from("exam_proctoring_alerts").insert({
          exam_id: body.examId,
          attempt_id: body.attemptId,
          event_id: event.id,
          alert_type: body.type,
          severity: body.severity,
          title: ALERT_TITLES[body.type],
          details: "Alerte automatique à vérifier par un enseignant.",
          expires_at: expiresAt,
        });
      }
      await refreshReport(db, body.examId, body.attemptId, expiresAt);
      return json({ event: mapEvent(event) });
    }

    if (body.action === "upload-capture") {
      if (!body.base64 || !body.source || !body.trigger) return json({ error: "invalid_payload" }, 400);
      const binary = Uint8Array.from(atob(body.base64), (character) => character.charCodeAt(0));
      if (binary.byteLength > 5 * 1024 * 1024) return json({ error: "capture_too_large" }, 413);
      const extension = body.contentType === "image/png" ? "png" : "jpg";
      const captureId = crypto.randomUUID();
      const path = `${body.examId}/${body.attemptId}/${captureId}.${extension}`;
      const { error: uploadError } = await db.storage.from("exam-proctoring").upload(path, binary, {
        contentType: body.contentType ?? "image/jpeg",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data: capture, error } = await db.from("exam_proctoring_captures").insert({
        id: captureId,
        exam_id: body.examId,
        attempt_id: body.attemptId,
        source: body.source,
        trigger: body.trigger,
        storage_path: path,
        content_type: body.contentType ?? "image/jpeg",
        analysis: body.analysis ?? {},
        expires_at: expiresAt,
      }).select().single();
      if (error) throw error;
      await db.from("exam_proctoring_events").insert({
        exam_id: body.examId,
        attempt_id: body.attemptId,
        participant_id: body.participantId,
        event_type: "capture_created",
        severity: "info",
        details: { captureId, source: body.source, trigger: body.trigger },
        expires_at: expiresAt,
      });
      await refreshReport(db, body.examId, body.attemptId, expiresAt);
      return json({ capture: mapCapture(capture) });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (error) {
    console.error("[proctoring-api]", error);
    return json({ error: "internal_error" }, 500);
  }
});

async function refreshReport(
  db: SupabaseClient<any, "public", any>,
  examId: string,
  attemptId: string,
  expiresAt: string,
) {
  const [eventsResult, alertsResult, capturesResult] = await Promise.all([
    db.from("exam_proctoring_events").select("event_type, duration_ms").eq("attempt_id", attemptId),
    db.from("exam_proctoring_alerts").select("severity").eq("attempt_id", attemptId),
    db.from("exam_proctoring_captures").select("id").eq("attempt_id", attemptId),
  ]);
  const events = eventsResult.data ?? [];
  const alerts = alertsResult.data ?? [];
  const critical = alerts.filter((alert) => alert.severity === "critical").length;
  const decision = critical > 0 || alerts.length >= 3 ? "review" : "compliant";
  await db.from("exam_proctoring_reports").upsert({
    exam_id: examId,
    attempt_id: attemptId,
    decision,
    event_count: events.length,
    alert_count: alerts.length,
    capture_count: capturesResult.data?.length ?? 0,
    tab_switch_count: events.filter((event) => event.event_type === "tab_hidden").length,
    fullscreen_exit_count: events.filter((event) => event.event_type === "fullscreen_exited").length,
    focus_lost_seconds: Math.round(events
      .filter((event) => event.event_type === "focus_lost")
      .reduce((sum, event) => sum + Number(event.duration_ms ?? 0), 0) / 1000),
    generated_at: new Date().toISOString(),
    expires_at: expiresAt,
  }, { onConflict: "attempt_id" });
}

function mapEvent(row: Record<string, unknown>) {
  return {
    id: row.id,
    examId: row.exam_id,
    attemptId: row.attempt_id,
    participantId: row.participant_id,
    type: row.event_type,
    severity: row.severity,
    occurredAt: row.occurred_at,
    durationMs: row.duration_ms,
    occurrence: row.occurrence,
    details: row.details,
  };
}

function mapAlert(row: Record<string, unknown>) {
  return {
    id: row.id,
    examId: row.exam_id,
    attemptId: row.attempt_id,
    type: row.alert_type,
    severity: row.severity,
    title: row.title,
    details: row.details,
    occurredAt: row.occurred_at,
    reviewStatus: row.review_status,
  };
}

function mapCapture(row: Record<string, unknown>) {
  return {
    id: row.id,
    examId: row.exam_id,
    attemptId: row.attempt_id,
    source: row.source,
    trigger: row.trigger,
    occurredAt: row.occurred_at,
    storagePath: row.storage_path,
    signedUrl: row.signed_url,
  };
}

function mapReport(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    id: row.id,
    examId: row.exam_id,
    attemptId: row.attempt_id,
    decision: row.decision,
    teacherDecision: row.teacher_decision,
    teacherNote: row.teacher_note,
    validationStatus: row.validation_status,
    eventCount: row.event_count,
    alertCount: row.alert_count,
    captureCount: row.capture_count,
    tabSwitchCount: row.tab_switch_count,
    fullscreenExitCount: row.fullscreen_exit_count,
    focusLostSeconds: row.focus_lost_seconds,
    generatedAt: row.generated_at,
    validatedAt: row.validated_at,
  };
}
