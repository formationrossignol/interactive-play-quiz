// LTI-004 — the actual "création de line item" the spec requires. Not
// auto-invoked from lti-launch (see 20260821030000_lti_ags.sql's header —
// no real gradable content behind an LTI resource-link launch exists in
// this app yet). This is the real, callable capability a future gradable
// content type's grading code (or, today, an admin testing the AGS wiring
// manually) calls with real title/max_points it actually has — never a
// placeholder.
//
// JWT-verified by default (no verify_jwt=false in config.toml) — runs as
// the caller's own session; admin-of-the-registration's-org check happens
// via the caller-scoped client reading lti_resource_links/lti_registrations
// under RLS (lti_resource_links_admin policy), not a manual has_org_role
// call duplicated here.
import { createClient } from "npm:@supabase/supabase-js@2";
import { importPKCS8 } from "npm:jose@5";
import { createLtiLineItem, fetchLtiLineItem, LtiAgsError } from "../_shared/lti-ags.ts";
import { fetchLtiServiceToken, LtiServiceTokenError } from "../_shared/lti-signing.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const LINEITEM_SCOPE = "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: corsHeaders });
  }

  try {
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

    const { resource_link_id: resourceLinkId, title, max_points: maxPoints } = await req.json().catch(() => ({}));
    if (typeof resourceLinkId !== "string" || typeof title !== "string" || typeof maxPoints !== "number" || maxPoints <= 0) {
      return new Response(JSON.stringify({ error: "missing_required_param" }), { status: 400, headers: corsHeaders });
    }

    // RLS (lti_resource_links_admin) enforces the caller is an admin of this
    // registration's org — a non-admin or wrong-org caller simply finds
    // nothing here, no separate check needed.
    const { data: link, error: linkError } = await callerClient
      .from("lti_resource_links")
      .select("id, registration_id, line_item_url, line_items_url, ags_scopes")
      .eq("id", resourceLinkId)
      .maybeSingle();
    if (linkError || !link) {
      return new Response(JSON.stringify({ error: "unknown_or_unauthorized_resource_link" }), { status: 404, headers: corsHeaders });
    }

    const { data: registration, error: registrationError } = await serviceClient
      .from("lti_registrations")
      .select("id, client_id, auth_token_url")
      .eq("id", link.registration_id)
      .maybeSingle();
    if (registrationError || !registration?.auth_token_url) {
      return new Response(JSON.stringify({ error: "registration_not_configured" }), { status: 500, headers: corsHeaders });
    }

    const { data: keyRow, error: keyError } = await serviceClient
      .from("lti_tool_keys")
      .select("id, kid")
      .eq("registration_id", registration.id)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (keyError || !keyRow) {
      return new Response(JSON.stringify({ error: "no_signing_key" }), { status: 500, headers: corsHeaders });
    }
    const { data: privateKeyPkcs8, error: decryptError } = await serviceClient.rpc("_decrypt_lti_tool_key", { p_id: keyRow.id });
    if (decryptError || typeof privateKeyPkcs8 !== "string" || !privateKeyPkcs8) {
      return new Response(JSON.stringify({ error: "no_signing_key" }), { status: 500, headers: corsHeaders });
    }
    const privateKey = await importPKCS8(privateKeyPkcs8, "RS256");

    let accessToken: string;
    try {
      accessToken = await fetchLtiServiceToken({
        tokenEndpoint: registration.auth_token_url,
        clientId: registration.client_id,
        privateKey,
        kid: keyRow.kid,
        scope: LINEITEM_SCOPE,
      });
    } catch (err) {
      const reason = err instanceof LtiServiceTokenError ? err.reason : "token_request_failed";
      return new Response(JSON.stringify({ error: reason }), { status: 502, headers: corsHeaders });
    }

    let resolvedScoreMaximum: number;
    let lineItemUrl: string;

    try {
      if (link.line_item_url) {
        // Already exists (platform pre-created it, or a previous call to
        // this function did) — read the platform's own declared
        // scoreMaximum rather than trusting whatever the caller just typed.
        const item = await fetchLtiLineItem(link.line_item_url, accessToken);
        resolvedScoreMaximum = item.scoreMaximum;
        lineItemUrl = link.line_item_url;
      } else if (link.line_items_url) {
        const item = await createLtiLineItem(link.line_items_url, accessToken, {
          scoreMaximum: maxPoints,
          label: title,
        });
        resolvedScoreMaximum = maxPoints;
        lineItemUrl = item.id;
        await serviceClient.from("lti_resource_links").update({ line_item_url: lineItemUrl }).eq("id", link.id);
      } else {
        return new Response(JSON.stringify({ error: "no_ags_endpoint_granted" }), { status: 400, headers: corsHeaders });
      }
    } catch (err) {
      const reason = err instanceof LtiAgsError ? err.reason : "line_item_create_failed";
      return new Response(JSON.stringify({ error: reason }), { status: 502, headers: corsHeaders });
    }

    const { data: gradeItemId, error: ensureError } = await serviceClient.rpc("ensure_lti_grade_item", {
      p_resource_link_id: link.id,
      p_title: title,
      p_max_points: resolvedScoreMaximum,
    });
    if (ensureError || !gradeItemId) {
      return new Response(JSON.stringify({ error: "grade_item_creation_failed" }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ grade_item_id: gradeItemId, line_item_url: lineItemUrl, score_maximum: resolvedScoreMaximum }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[lti-create-line-item] error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: corsHeaders });
  }
});
