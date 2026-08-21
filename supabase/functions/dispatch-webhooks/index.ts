// API-003 — drains webhook_deliveries (20260821070000_public_api_webhooks.sql),
// POSTing each pending row's payload, signed, to its endpoint's configured
// URL. Same shape as dispatch-lti-ags-scores (spec 04, this session): CRON_SECRET-
// gated (an external scheduler invokes this, not a user), atomic per-row
// claim (`update ... where status='pending' set status='sending'` — two
// concurrent invocations can't both send the same delivery, the second's
// claim affects 0 rows once the first has already claimed it), bounded
// retries with exponential-ish backoff via next_attempt_at.
//
// API-003's own words: "livrés au moins une fois" (delivered at least once)
// — retries on failure, never silently dropped; "rejouables" (replayable) —
// a delivery that keeps failing stays queued (status stays 'pending',
// next_attempt_at pushed forward) up to MAX_ATTEMPTS, then 'failed', not
// deleted, so an admin can inspect what didn't go out and why.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { signWebhookPayload } from "../_shared/webhook-signing.ts";

const MAX_ATTEMPTS = 6;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function backoffSeconds(attempt: number): number {
  // 30s, 60s, 120s, 240s, 480s, 960s — capped by MAX_ATTEMPTS itself, not an
  // artificial ceiling on the interval.
  return 30 * Math.pow(2, attempt);
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
      .from("webhook_deliveries")
      .select("id, endpoint_id, event_name, payload, attempt_count")
      .eq("status", "pending")
      .lte("next_attempt_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(50);
    if (fetchError) throw fetchError;
    if (!pending || pending.length === 0) return jsonResponse({ dispatched: 0 });

    let dispatched = 0;
    let failed = 0;

    for (const row of pending) {
      // Atomic claim: only proceeds if this row is still 'pending' right
      // now — a concurrent invocation that claimed it first leaves 0 rows
      // affected here.
      const { data: claimed } = await supabase
        .from("webhook_deliveries")
        .update({ status: "sending" })
        .eq("id", row.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (!claimed) continue;

      const failRow = async (reason: string) => {
        const nextAttempt = row.attempt_count + 1;
        const isExhausted = nextAttempt >= MAX_ATTEMPTS;
        await supabase
          .from("webhook_deliveries")
          .update({
            status: isExhausted ? "failed" : "pending",
            attempt_count: nextAttempt,
            last_error: reason,
            last_attempt_at: new Date().toISOString(),
            next_attempt_at: new Date(Date.now() + backoffSeconds(nextAttempt) * 1000).toISOString(),
          })
          .eq("id", row.id);
        failed++;
      };

      const { data: endpoint } = await supabase
        .from("webhook_endpoints")
        .select("id, url, status")
        .eq("id", row.endpoint_id)
        .maybeSingle();
      if (!endpoint || endpoint.status !== "active") {
        await failRow("endpoint_disabled_or_missing");
        continue;
      }

      const { data: secret } = await supabase.rpc("_decrypt_webhook_secret", { p_endpoint_id: endpoint.id });
      if (typeof secret !== "string" || !secret) {
        await failRow("no_webhook_secret");
        continue;
      }

      try {
        // Sign the exact string that will be sent — never re-serialize
        // after signing, or a receiver's independent JSON.stringify could
        // legitimately produce different bytes than what was actually
        // transmitted and signed (key ordering, whitespace).
        const rawBody = JSON.stringify({
          id: row.id,
          event: row.event_name,
          data: row.payload,
          created_at: new Date().toISOString(),
        });
        const signedHeaders = await signWebhookPayload(rawBody, secret);

        const resp = await fetch(endpoint.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...signedHeaders },
          body: rawBody,
        });

        if (!resp.ok) {
          await failRow(`endpoint_returned_${resp.status}`);
          continue;
        }

        await supabase
          .from("webhook_deliveries")
          .update({ status: "delivered", attempt_count: row.attempt_count + 1, last_attempt_at: new Date().toISOString(), last_error: null })
          .eq("id", row.id);
        dispatched++;
      } catch (err) {
        await failRow(err instanceof Error ? err.message : "delivery_failed");
      }
    }

    return jsonResponse({ dispatched, failed });
  } catch (err) {
    console.error("[dispatch-webhooks] error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
