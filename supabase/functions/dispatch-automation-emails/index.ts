import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

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

    const { data: pending, error: fetchError } = await supabase
      .from("automation_email_outbox")
      .select("id, learner_id, subject, body")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100);
    if (fetchError) throw fetchError;
    if (!pending || pending.length === 0) return jsonResponse({ dispatched: 0 });

    let dispatched = 0;
    for (const row of pending) {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(row.learner_id);
      const email = userData?.user?.email;
      if (userError || !email) {
        await supabase.from("automation_email_outbox").update({ status: "failed" }).eq("id", row.id);
        continue;
      }

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: email, subject: row.subject, html: `<p>${row.body}</p>` }),
      });

      if (resendResponse.ok) {
        await supabase.from("automation_email_outbox").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", row.id);
        dispatched++;
      } else {
        console.error("[dispatch-automation-emails] Resend error:", await resendResponse.text());
        await supabase.from("automation_email_outbox").update({ status: "failed" }).eq("id", row.id);
      }
    }

    return jsonResponse({ dispatched, total: pending.length });
  } catch (err) {
    console.error("[dispatch-automation-emails] error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
