// OneRoster 1.2 — ROS-002 (REST-inbound sync). Scoped to USER sync only in
// this pass (see 20260821060000_oneroster.sql's file header): the write
// path for enrollments reuses enroll_in_session()/transition_enrollment()
// unmodified, and both hard-require a real Supabase auth.uid() this
// service_role/token-authenticated caller never has — enrollment sync via
// REST is a stated gap, not silently broken here.
//
// verify_jwt=false (config.toml) — this function verifies its OWN bearer
// credential (verifyApiBearerToken, same SHA-256 hash-lookup primitive
// SCIM's edge functions already use, generalized this session — see
// _shared/api-token-auth.ts) — not a Supabase session JWT. An external
// provider POSTs {users:[{sourcedId,email}]} on a schedule it controls;
// delta vs full sync (ROS-002's "delta lorsque le fournisseur le permet")
// is the caller's choice — this endpoint accepts whatever subset of users
// the provider sends, it doesn't itself track "what changed since last
// time" (that's the provider's own delta-computation responsibility, this
// endpoint is a receiver, not a poller).
//
// Resolution is a single SQL-side join (_resolve_oneroster_users_service,
// mirrors resolve_org_members_by_identifier()'s posture) — NOT a per-row
// loop over auth.admin.listUsers(), which would be both slow and silently
// wrong past that API's default 50-row page size. Caught and fixed before
// this function's first commit.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { verifyApiBearerToken } from "../_shared/api-token-auth.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ctx = await verifyApiBearerToken(req, supabase);
  if (!ctx) return jsonResponse({ error: "invalid_or_missing_bearer_token" }, 401);

  try {
    const body = await req.json().catch(() => null);
    const users = Array.isArray(body?.users) ? body.users : null;
    if (!users) return jsonResponse({ error: "missing_users_array" }, 400);

    const rows = users
      .filter((u: unknown): u is { sourcedId: string; email: string } =>
        typeof (u as { sourcedId?: unknown })?.sourcedId === "string" && typeof (u as { email?: unknown })?.email === "string")
      .map((u: { sourcedId: string; email: string }) => ({ sourced_id: u.sourcedId, email: u.email }));

    const { data: runId } = await supabase.rpc("_start_oneroster_sync_run_service", { p_org_id: ctx.orgId });

    const { data: resolved } = await supabase.rpc("_resolve_oneroster_users_service", {
      p_org_id: ctx.orgId,
      p_rows: rows,
    });
    const resolvedRows = (resolved ?? []).map((r: { sourced_id: string; email: string; learner_id: string | null }) => ({
      sourced_id: r.sourced_id, email: r.email, learner_id: r.learner_id,
    }));

    const { data: results, error: commitError } = await supabase.rpc("_commit_oneroster_users_service", {
      p_org_id: ctx.orgId,
      p_rows: resolvedRows,
    });

    const created = (results ?? []).filter((r: { outcome: string }) => r.outcome === "created").length;
    const updated = (results ?? []).filter((r: { outcome: string }) => r.outcome === "updated").length;
    const skipped = (results ?? []).filter((r: { outcome: string }) => r.outcome === "skipped_unmatched").length;

    if (runId) {
      await supabase.rpc("complete_oneroster_sync_run", {
        p_run_id: runId,
        p_status: commitError ? "failed" : "completed",
        p_created: created,
        p_updated: updated,
        p_deactivated: 0,
        p_errors: commitError ? rows.length : skipped,
        p_error_reason: commitError?.message ?? null,
      });
    }

    if (commitError) return jsonResponse({ error: "commit_failed", detail: commitError.message }, 500);
    return jsonResponse({ processed: rows.length, resolved: resolvedRows.filter((r: { learner_id: string | null }) => r.learner_id).length, created, updated, skipped });
  } catch (err) {
    console.error("[oneroster-sync] error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
