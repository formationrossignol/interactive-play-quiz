import { createClient } from "npm:@supabase/supabase-js@2";
import { mapInBatches, resolveDispatchBatchSize } from "../_shared/batched-dispatch.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const EXTERNAL_REQUEST_TIMEOUT_MS = 10_000;

type DispatchOutcome = "dispatched" | "failed";

// Spec 06 automation engine (20260813070000_automation_execution_engine.sql):
// _execute_automation_action() queues the 'email' action into
// automation_email_outbox rather than calling out from inside Postgres —
// no pg_net usage exists anywhere in this codebase to call from a
// migration blind, so the outbox is drained here instead, on the same
// Resend call shape send-welcome-email/send-org-invitation already use
// (RESEND_API_KEY, not a new vendor).
//
// Not user-invoked: this drains every org's pending queue in one pass, so
// it's gated on a shared secret (CRON_SECRET) rather than a caller's JWT —
// point a Supabase Dashboard Cron Job (or any external scheduler) at this
// URL with header `x-cron-secret: <CRON_SECRET>`. One-time operator setup,
// same category as setting RESEND_API_KEY itself.
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
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
      return jsonResponse({ error: "forbidden" }, 403);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return jsonResponse({ dispatched: 0, reason: "resend_not_configured" });
    }
    const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "Brivia <onboarding@brivia.app>";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const batchSize = resolveDispatchBatchSize(Deno.env.get("AUTOMATION_EMAIL_DISPATCH_BATCH_SIZE"));

    const { data: pending, error: fetchError } = await supabase
      .from("automation_email_outbox")
      .select("id, learner_id, subject, body")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(batchSize);
    if (fetchError) throw fetchError;
    if (!pending || pending.length === 0) return jsonResponse({ dispatched: 0 });

    const outcomes = await mapInBatches(pending, async (row): Promise<DispatchOutcome> => {
      const markFailed = async (): Promise<DispatchOutcome> => {
        try {
          const { error: updateError } = await supabase
            .from("automation_email_outbox")
            .update({ status: "failed" })
            .eq("id", row.id)
            .eq("status", "pending");
          if (updateError) {
            console.error(`[dispatch-automation-emails] could not record failure for ${row.id}:`, updateError);
          }
        } catch (err) {
          console.error(`[dispatch-automation-emails] recording failure threw for ${row.id}:`, err);
        }
        return "failed";
      };

      let acceptedByResend = false;
      try {
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(row.learner_id);
        const email = userData?.user?.email;
        if (userError || !email) {
          if (userError) console.error(`[dispatch-automation-emails] user lookup failed for ${row.id}:`, userError);
          return await markFailed();
        }

        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: email, subject: row.subject, html: `<p>${row.body}</p>` }),
          signal: AbortSignal.timeout(EXTERNAL_REQUEST_TIMEOUT_MS),
        });

        if (!resendResponse.ok) {
          console.error(`[dispatch-automation-emails] Resend error for ${row.id}:`, await resendResponse.text());
          return await markFailed();
        }
        acceptedByResend = true;

        const { error: sentError } = await supabase
          .from("automation_email_outbox")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", row.id)
          .eq("status", "pending");
        if (sentError) throw sentError;
        return "dispatched";
      } catch (err) {
        console.error(`[dispatch-automation-emails] delivery failed for ${row.id}:`, err);
        // Resend accepted the message, but persisting `sent` failed. Leave
        // the row pending for an at-least-once retry instead of incorrectly
        // marking a delivered email as a permanent delivery failure.
        if (acceptedByResend) return "failed";
        return await markFailed();
      }
    });

    const dispatched = outcomes.filter((outcome) => outcome === "dispatched").length;
    const failed = outcomes.filter((outcome) => outcome === "failed").length;

    return jsonResponse({ dispatched, failed, total: pending.length });
  } catch (err) {
    console.error("[dispatch-automation-emails] error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
