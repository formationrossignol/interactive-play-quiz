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
import { buildLtiScorePayload, LtiAgsError, postLtiScore } from "../_shared/lti-ags.ts";
import { fetchLtiServiceToken, LtiServiceTokenError } from "../_shared/lti-signing.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const SCORE_SCOPE = "https://purl.imsglobal.org/spec/lti-ags/scope/score";
const MAX_RETRIES = 5;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    const { data: pending, error: fetchError } = await supabase
      .from("lti_ags_score_queue")
      .select("id, grade_item_id, learner_id, retry_count")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);
    if (fetchError) throw fetchError;
    if (!pending || pending.length === 0) return jsonResponse({ dispatched: 0 });

    let dispatched = 0;
    let failed = 0;

    for (const row of pending) {
      // Atomic claim: only proceeds if this row is still 'pending' right
      // now — a concurrent invocation that claimed it first leaves 0 rows
      // affected here, and this loop iteration skips it.
      const { data: claimed } = await supabase
        .from("lti_ags_score_queue")
        .update({ status: "sending" })
        .eq("id", row.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (!claimed) continue;

      const fail = async (reason: string) => {
        const nextRetryCount = row.retry_count + 1;
        await supabase
          .from("lti_ags_score_queue")
          .update({
            status: nextRetryCount >= MAX_RETRIES ? "failed" : "pending",
            retry_count: nextRetryCount,
            last_error: reason,
          })
          .eq("id", row.id);
        failed++;
      };

      const { data: gradeItem } = await supabase
        .from("grade_items")
        .select("source_type, source_id, max_points")
        .eq("id", row.grade_item_id)
        .maybeSingle();
      if (!gradeItem || gradeItem.source_type !== "lti") {
        await fail("grade_item_not_lti_sourced");
        continue;
      }

      const { data: link } = await supabase
        .from("lti_resource_links")
        .select("id, registration_id, line_item_url")
        .eq("id", gradeItem.source_id)
        .maybeSingle();
      if (!link?.line_item_url) {
        await fail("no_line_item_url");
        continue;
      }

      const { data: registration } = await supabase
        .from("lti_registrations")
        .select("id, client_id, auth_token_url")
        .eq("id", link.registration_id)
        .maybeSingle();
      if (!registration?.auth_token_url) {
        await fail("registration_not_configured");
        continue;
      }

      const { data: keyRow } = await supabase
        .from("lti_tool_keys")
        .select("id, kid")
        .eq("registration_id", registration.id)
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!keyRow) {
        await fail("no_signing_key");
        continue;
      }
      const { data: privateKeyPkcs8 } = await supabase.rpc("_decrypt_lti_tool_key", { p_id: keyRow.id });
      if (typeof privateKeyPkcs8 !== "string" || !privateKeyPkcs8) {
        await fail("no_signing_key");
        continue;
      }

      // The platform identifies the learner by ITS OWN sub, not Brivia's
      // internal user id — external_mappings is the reverse lookup
      // (external_id is namespaced "<registration_id>:<sub>", same
      // convention lti-launch already writes it in).
      const { data: mappingRow } = await supabase
        .from("external_mappings")
        .select("external_id")
        .eq("system", "lti")
        .eq("object_type", "user")
        .eq("internal_id", row.learner_id)
        .like("external_id", `${registration.id}:%`)
        .maybeSingle();
      if (!mappingRow) {
        await fail("no_external_subject_for_learner");
        continue;
      }
      const externalSubject = mappingRow.external_id.slice(`${registration.id}:`.length);

      const { data: gradeResult } = await supabase
        .from("grade_results")
        .select("points")
        .eq("grade_item_id", row.grade_item_id)
        .eq("learner_id", row.learner_id)
        .maybeSingle();
      if (gradeResult?.points == null) {
        await fail("no_published_points");
        continue;
      }

      try {
        const privateKey = await importPKCS8(privateKeyPkcs8, "RS256");
        const accessToken = await fetchLtiServiceToken({
          tokenEndpoint: registration.auth_token_url,
          clientId: registration.client_id,
          privateKey,
          kid: keyRow.kid,
          scope: SCORE_SCOPE,
        });
        const payload = buildLtiScorePayload({
          externalSubject,
          scoreGiven: gradeResult.points,
          scoreMaximum: gradeItem.max_points,
          timestamp: new Date(),
        });
        await postLtiScore(link.line_item_url, accessToken, payload);

        await supabase
          .from("lti_ags_score_queue")
          .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
          .eq("id", row.id);
        dispatched++;
      } catch (err) {
        const reason = err instanceof LtiAgsError || err instanceof LtiServiceTokenError
          ? err.reason
          : (err instanceof Error ? err.message : "unknown_error");
        await fail(reason);
      }
    }

    return jsonResponse({ dispatched, failed });
  } catch (err) {
    console.error("[dispatch-lti-ags-scores] error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
