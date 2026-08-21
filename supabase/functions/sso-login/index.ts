// Generic OIDC SSO — login initiation (INT-001/INT-002).
// Mints state+nonce+PKCE, stores them server-side (see
// 20260815040000_sso_oidc.sql's sso_login_states — same "DB row, not a
// cookie" reasoning as lti_login_states: the IdP's redirect back is a
// cross-site hop), then sends the browser on to the IdP's
// authorization_endpoint.
//
// Two distinct entry points, not one — INT-002's test mode is why:
//
// - GET (raw top-level navigation, e.g. an <a href> on the login page —
//   there is no Brivia session yet, so no header can be attached). Only
//   'active' connections may use this: the real, unauthenticated production
//   path.
// - POST (via supabase.functions.invoke from an already-authenticated admin
//   tab, which attaches the caller's Authorization header automatically —
//   a raw GET navigation structurally cannot carry a header, so testing a
//   'testing' connection has to go through invoke instead). Only 'testing'
//   connections may use this, and only when the caller's own JWT resolves to
//   this exact connection's `created_by` — otherwise a connection an admin
//   is still configuring could be used to sign in ordinary org members
//   before it's verified working. Returns JSON `{redirectUrl}` rather than a
//   302 (invoke() already consumed the response; the client does
//   `window.location.href = redirectUrl` itself for the actual hop to the
//   IdP, which is not this project's own origin).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = base64url(verifierBytes);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const jsonBody = (reason: string, status = 400) =>
    new Response(JSON.stringify({ error: reason }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const isPost = req.method === "POST";
    let connectionId: string | null;
    let redirectTo: string | null;

    if (isPost) {
      const body = await req.json().catch(() => ({}));
      connectionId = typeof body.connection_id === "string" ? body.connection_id : null;
      redirectTo = typeof body.redirect_to === "string" ? body.redirect_to : null;
    } else {
      const url = new URL(req.url);
      connectionId = url.searchParams.get("connection_id");
      redirectTo = url.searchParams.get("redirect_to");
    }
    if (!connectionId || !redirectTo) {
      return jsonBody("missing_required_param");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: connection, error } = await supabase
      .from("identity_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("protocol", "oidc")
      .maybeSingle();
    if (error || !connection) {
      return jsonBody("unknown_connection");
    }

    if (isPost) {
      if (connection.status !== "testing") {
        return jsonBody("post_only_for_testing_connections");
      }
      const authHeader = req.headers.get("Authorization");
      const token = authHeader?.match(/^Bearer (.+)$/)?.[1];
      if (!token) {
        return jsonBody("test_mode_requires_admin_session", 401);
      }
      const { data: callerData, error: callerError } = await supabase.auth.getUser(token);
      if (callerError || !callerData?.user || callerData.user.id !== connection.created_by) {
        return jsonBody("test_mode_requires_connection_owner", 403);
      }
    } else if (connection.status !== "active") {
      return jsonBody("connection_not_active");
    }

    const meta = (connection.metadata ?? {}) as Record<string, unknown>;
    const issuer = typeof meta.issuer === "string" ? meta.issuer : null;
    const clientId = typeof meta.client_id === "string" ? meta.client_id : null;
    const authorizationEndpoint = typeof meta.authorization_endpoint === "string" ? meta.authorization_endpoint : null;
    if (!issuer || !clientId || !authorizationEndpoint) {
      return jsonBody("connection_not_configured");
    }

    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    const { verifier, challenge } = await pkcePair();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("sso_login_states").insert({
      connection_id: connection.id,
      state,
      nonce,
      code_verifier: verifier,
      redirect_to: redirectTo,
      expires_at: expiresAt,
    });
    if (insertError) {
      console.error("[sso-login] failed to persist login state:", insertError);
      return jsonBody("internal_error", 500);
    }

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/sso-callback`;
    const scope = typeof meta.scope === "string" ? meta.scope : "openid email profile";
    const authUrl = new URL(authorizationEndpoint);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("nonce", nonce);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    if (isPost) {
      return new Response(JSON.stringify({ redirectUrl: authUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(null, { status: 302, headers: { ...corsHeaders, Location: authUrl.toString() } });
  } catch (err) {
    console.error("[sso-login] error:", err);
    return jsonBody("internal_error", 500);
  }
});
