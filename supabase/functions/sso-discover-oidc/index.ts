// OIDC discovery helper for the admin connection-setup form (INT-001) — an
// admin pastes an issuer URL and this fetches its
// `.well-known/openid-configuration` server-side (avoids relying on the
// IdP's CORS policy allowing a direct browser fetch, which isn't guaranteed)
// and returns only the four endpoints the OIDC flow needs. No secrets
// involved, but this function does make the project's own server fetch an
// admin-supplied URL — kept JWT-verified (see config.toml, unlike
// sso-login/sso-callback) and additionally checks the caller is actually an
// admin of the org they claim, so it can't be used as an open URL-fetching
// proxy by any authenticated platform user. The hostname guard below blocks
// the obvious loopback/private-literal targets; it is not a complete SSRF
// defense (e.g. DNS rebinding after this check isn't covered) — a fuller
// guard would need outbound network policy this project doesn't have today.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0" || h === "::1") return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  return false;
}

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

    const { orgId, issuer } = await req.json();
    if (typeof orgId !== "string" || typeof issuer !== "string" || !issuer) {
      return new Response(JSON.stringify({ error: "missing_required_param" }), { status: 400, headers: corsHeaders });
    }

    const { data: isAdmin, error: roleError } = await callerClient.rpc("has_org_role", { p_org_id: orgId, p_roles: ["admin"] });
    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: "not_authorized" }), { status: 403, headers: corsHeaders });
    }

    let issuerUrl: URL;
    try {
      issuerUrl = new URL(issuer);
    } catch {
      return new Response(JSON.stringify({ error: "invalid_issuer_url" }), { status: 400, headers: corsHeaders });
    }
    if (issuerUrl.protocol !== "https:" || isBlockedHost(issuerUrl.hostname)) {
      return new Response(JSON.stringify({ error: "issuer_not_allowed" }), { status: 400, headers: corsHeaders });
    }

    const discoveryUrl = new URL("/.well-known/openid-configuration", issuerUrl);
    const resp = await fetch(discoveryUrl.toString());
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: "discovery_failed", status: resp.status }), { status: 502, headers: corsHeaders });
    }
    const doc = await resp.json();

    const required = ["issuer", "authorization_endpoint", "token_endpoint", "jwks_uri"] as const;
    for (const key of required) {
      if (typeof doc[key] !== "string") {
        return new Response(JSON.stringify({ error: "discovery_document_incomplete", missing: key }), { status: 502, headers: corsHeaders });
      }
    }

    return new Response(
      JSON.stringify({
        issuer: doc.issuer,
        authorization_endpoint: doc.authorization_endpoint,
        token_endpoint: doc.token_endpoint,
        jwks_uri: doc.jwks_uri,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[sso-discover-oidc] error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: corsHeaders });
  }
});
