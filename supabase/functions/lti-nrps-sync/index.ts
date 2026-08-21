// LTI-003 — Names and Role Provisioning Service: admin-triggered roster
// sync for one context. JWT-verified by default (no verify_jwt=false in
// config.toml) — runs as the caller's own session, because
// start_lti_nrps_sync() resolves auth.uid() for its admin check and for
// triggered_by. Fetches the platform's roster for real (fetchLtiContextMembership,
// via fetchLtiServiceToken — both already built this session), matches each
// member against an existing external_mappings row (same convention AGS's
// score dispatcher already established: never auto-provision an account for
// someone who has never actually launched into Brivia — INT-003/LTI-005,
// followed consistently for SSO subjects and LTI subjects alike all session),
// applies the LTI role → Brivia role mapping (_shared/lti-nrps.ts, additive
// only — never revokes a role a previous sync granted but this one's roster
// no longer lists, same posture SSO's _resolve_sso_roles() already took),
// and writes a full provenance record per member (LTI-003's own requirement).
import { createClient } from "npm:@supabase/supabase-js@2";
import { importPKCS8 } from "npm:jose@5";
import { fetchLtiContextMembership, LtiNrpsError, mapLtiRolesToBriviaRoles } from "../_shared/lti-nrps.ts";
import { fetchLtiServiceToken, LtiServiceTokenError } from "../_shared/lti-signing.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const NRPS_SCOPE = "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { context_id: contextId } = await req.json().catch(() => ({}));
    if (typeof contextId !== "string" || !contextId) {
      return jsonResponse({ error: "missing_context_id" }, 400);
    }

    // Admin check + run-row creation, one round trip — see
    // 20260821040000_lti_nrps.sql. Runs through callerClient so auth.uid()
    // there resolves to the real caller, matching the RLS/authorization
    // this same session's other admin-triggered functions (lti-generate-key,
    // lti-deep-linking-response) already established.
    const { data: startRows, error: startError } = await callerClient.rpc("start_lti_nrps_sync", { p_context_id: contextId });
    const start = startRows?.[0];
    if (startError || !start) {
      const status = startError?.message?.includes("Not authorized") ? 403 : 400;
      return jsonResponse({ error: startError?.message ?? "sync_start_failed" }, status);
    }

    const failRun = async (reason: string) => {
      await serviceClient.from("lti_nrps_sync_runs")
        .update({ status: "failed", error_reason: reason, completed_at: new Date().toISOString() })
        .eq("id", start.sync_run_id);
      return jsonResponse({ error: reason, sync_run_id: start.sync_run_id }, 500);
    };

    const { data: keyRow } = await serviceClient
      .from("lti_tool_keys")
      .select("id, kid")
      .eq("registration_id", start.registration_id)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!keyRow) return await failRun("no_signing_key");

    const { data: privateKeyPkcs8 } = await serviceClient.rpc("_decrypt_lti_tool_key", { p_id: keyRow.id });
    if (typeof privateKeyPkcs8 !== "string" || !privateKeyPkcs8) return await failRun("no_signing_key");

    let members;
    try {
      const privateKey = await importPKCS8(privateKeyPkcs8, "RS256");
      const accessToken = await fetchLtiServiceToken({
        tokenEndpoint: start.auth_token_url,
        clientId: start.client_id,
        privateKey,
        kid: keyRow.kid,
        scope: NRPS_SCOPE,
      });
      members = await fetchLtiContextMembership(start.context_memberships_url, accessToken);
    } catch (err) {
      const reason = err instanceof LtiNrpsError || err instanceof LtiServiceTokenError ? err.reason : "unknown_error";
      return await failRun(reason);
    }

    // Resolve mappings, apply roles and persist provenance set-wise in one
    // database call. The previous per-member lookup + per-role upsert +
    // provenance insert made a large roster thousands of sequential network
    // round-trips and routinely exceeded the Edge execution window.
    const memberRows = members.map((member) => ({
      external_subject: member.userId,
      name: member.name,
      email: member.email,
      lti_roles: member.roles,
      applied_roles: mapLtiRolesToBriviaRoles(member.roles),
    }));
    const { data: commitRows, error: commitError } = await serviceClient.rpc(
      "_commit_lti_nrps_members_service",
      { p_sync_run_id: start.sync_run_id, p_members: memberRows },
    );
    if (commitError) return await failRun(`member_commit_failed: ${commitError.message}`);
    const matchedCount = Number(commitRows?.[0]?.matched_count ?? 0);
    const unmatchedCount = Number(commitRows?.[0]?.unmatched_count ?? 0);

    await serviceClient.from("lti_nrps_sync_runs")
      .update({
        status: "completed",
        matched_count: matchedCount,
        unmatched_count: unmatchedCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", start.sync_run_id);

    return jsonResponse({ sync_run_id: start.sync_run_id, matched: matchedCount, unmatched: unmatchedCount });
  } catch (err) {
    console.error("[lti-nrps-sync] error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
