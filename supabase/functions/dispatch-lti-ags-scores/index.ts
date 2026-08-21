// LTI-004 — drains lti_ags_score_queue (20260821030000_lti_ags.sql),
// POSTing each pending row's score to the platform's AGS Score endpoint.
// Same shape as dispatch-automation-emails (spec 06): Postgres can't make
// outbound HTTP calls directly (no pg_net in this repo), so a trigger
// enqueues instead of calling out, and this edge function — invoked by an
// external scheduler on a shared secret, not a user — drains the queue.
// That's also LTI-004's "file de reprise" (retry queue): a transient
// failure here leaves the row 'pending' (or increments retry_count and
// leaves it 'pending' up to MAX_RETRIES, then 'failed') rather than losing
// the score, and the next scheduled invocation picks it up again.
//
// Idempotency: each row is claimed with an atomic
// `update ... where status = 'pending' ... select` before being processed —
// two concurrent invocations can't both send the same row (the second
// invocation's claim affects 0 rows once the first has already claimed it).
// A row that reaches 'sent' is excluded from every future query
// (`.eq("status","pending")`), so it is never reprocessed even across many
// invocations.
import { createClient } from "npm:@supabase/supabase-js@2";
import { importPKCS8 } from "npm:jose@5";
import { mapInBatches, resolveDispatchBatchSize } from "../_shared/batched-dispatch.ts";
import { buildLtiScorePayload, LtiAgsError, postLtiScore } from "../_shared/lti-ags.ts";
import { fetchLtiServiceToken, LtiServiceTokenError } from "../_shared/lti-signing.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const SCORE_SCOPE = "https://purl.imsglobal.org/spec/lti-ags/scope/score";
const MAX_RETRIES = 5;
const EXTERNAL_REQUEST_TIMEOUT_MS = 10_000;

type DispatchOutcome = "dispatched" | "failed" | "skipped";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function errorReason(error: unknown): string {
  if (error && typeof error === "object" && "name" in error && error.name === "TimeoutError") return "request_timeout";
  if (error instanceof LtiAgsError || error instanceof LtiServiceTokenError) return error.reason;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "unknown_error";
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
      return jsonResponse({ error: "forbidden" }, 403);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const batchSize = resolveDispatchBatchSize(Deno.env.get("LTI_AGS_DISPATCH_BATCH_SIZE"));

    const { data: pending, error: fetchError } = await supabase
      .from("lti_ags_score_queue")
      .select("id, grade_item_id, learner_id, retry_count")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(batchSize);
    if (fetchError) throw fetchError;
    if (!pending || pending.length === 0) return jsonResponse({ dispatched: 0 });

    const outcomes = await mapInBatches(pending, async (row): Promise<DispatchOutcome> => {
      // Atomic claim: only proceeds if this row is still 'pending' right
      // now — a concurrent invocation that claimed it first leaves 0 rows
      // affected here, and this loop iteration skips it.
      let claimed = false;
      try {
        const { data, error: claimError } = await supabase
          .from("lti_ags_score_queue")
          .update({ status: "sending" })
          .eq("id", row.id)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();
        if (claimError) {
          console.error(`[dispatch-lti-ags-scores] could not claim ${row.id}:`, claimError);
          return "skipped";
        }
        claimed = Boolean(data);
      } catch (err) {
        console.error(`[dispatch-lti-ags-scores] claim threw for ${row.id}:`, err);
        return "skipped";
      }
      if (!claimed) return "skipped";

      const fail = async (reason: string): Promise<DispatchOutcome> => {
        const nextRetryCount = row.retry_count + 1;
        try {
          const { error: updateError } = await supabase
            .from("lti_ags_score_queue")
            .update({
              status: nextRetryCount >= MAX_RETRIES ? "failed" : "pending",
              retry_count: nextRetryCount,
              last_error: reason,
            })
            .eq("id", row.id);
          if (updateError) {
            console.error(`[dispatch-lti-ags-scores] could not record failure for ${row.id}:`, updateError);
          }
        } catch (err) {
          console.error(`[dispatch-lti-ags-scores] recording failure threw for ${row.id}:`, err);
        }
        return "failed";
      };

      try {
        const { data: gradeItem, error: gradeItemError } = await supabase
          .from("grade_items")
          .select("source_type, source_id, max_points")
          .eq("id", row.grade_item_id)
          .maybeSingle();
        if (gradeItemError) throw gradeItemError;
        if (!gradeItem || gradeItem.source_type !== "lti") {
          return await fail("grade_item_not_lti_sourced");
        }

        const { data: link, error: linkError } = await supabase
          .from("lti_resource_links")
          .select("id, registration_id, line_item_url")
          .eq("id", gradeItem.source_id)
          .maybeSingle();
        if (linkError) throw linkError;
        if (!link?.line_item_url) return await fail("no_line_item_url");

        const { data: registration, error: registrationError } = await supabase
          .from("lti_registrations")
          .select("id, client_id, auth_token_url")
          .eq("id", link.registration_id)
          .maybeSingle();
        if (registrationError) throw registrationError;
        if (!registration?.auth_token_url) return await fail("registration_not_configured");

        const { data: keyRow, error: keyError } = await supabase
          .from("lti_tool_keys")
          .select("id, kid")
          .eq("registration_id", registration.id)
          .eq("is_active", true)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (keyError) throw keyError;
        if (!keyRow) return await fail("no_signing_key");

        const { data: privateKeyPkcs8, error: decryptError } = await supabase.rpc("_decrypt_lti_tool_key", { p_id: keyRow.id });
        if (decryptError) throw decryptError;
        if (typeof privateKeyPkcs8 !== "string" || !privateKeyPkcs8) {
          return await fail("no_signing_key");
        }

        // The platform identifies the learner by ITS OWN sub, not Brivia's
        // internal user id — external_mappings is the reverse lookup
        // (external_id is namespaced "<registration_id>:<sub>", same
        // convention lti-launch already writes it in).
        const { data: mappingRow, error: mappingError } = await supabase
          .from("external_mappings")
          .select("external_id")
          .eq("system", "lti")
          .eq("object_type", "user")
          .eq("internal_id", row.learner_id)
          .like("external_id", `${registration.id}:%`)
          .maybeSingle();
        if (mappingError) throw mappingError;
        if (!mappingRow) return await fail("no_external_subject_for_learner");
        const externalSubject = mappingRow.external_id.slice(`${registration.id}:`.length);

        const { data: gradeResult, error: gradeResultError } = await supabase
          .from("grade_results")
          .select("points")
          .eq("grade_item_id", row.grade_item_id)
          .eq("learner_id", row.learner_id)
          .maybeSingle();
        if (gradeResultError) throw gradeResultError;
        if (gradeResult?.points == null) return await fail("no_published_points");

        const privateKey = await importPKCS8(privateKeyPkcs8, "RS256");
        const accessToken = await fetchLtiServiceToken({
          tokenEndpoint: registration.auth_token_url,
          clientId: registration.client_id,
          privateKey,
          kid: keyRow.kid,
          scope: SCORE_SCOPE,
          signal: AbortSignal.timeout(EXTERNAL_REQUEST_TIMEOUT_MS),
        });
        const payload = buildLtiScorePayload({
          externalSubject,
          scoreGiven: gradeResult.points,
          scoreMaximum: gradeItem.max_points,
          timestamp: new Date(),
        });
        await postLtiScore(
          link.line_item_url,
          accessToken,
          payload,
          AbortSignal.timeout(EXTERNAL_REQUEST_TIMEOUT_MS),
        );

        const { error: sentError } = await supabase
          .from("lti_ags_score_queue")
          .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
          .eq("id", row.id);
        if (sentError) throw sentError;
        return "dispatched";
      } catch (err) {
        return await fail(errorReason(err));
      }
    });

    const dispatched = outcomes.filter((outcome) => outcome === "dispatched").length;
    const failed = outcomes.filter((outcome) => outcome === "failed").length;

    return jsonResponse({ dispatched, failed });
  } catch (err) {
    console.error("[dispatch-lti-ags-scores] error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
