// Generic OIDC SSO — authorization-code callback (INT-001/INT-003/INT-004).
// The IdP redirects the browser back here with `code`+`state` after the
// user authenticates at sso-login's authorization_endpoint redirect.
// Exchanges the code for an id_token (server-side, client_secret never
// touches the browser), verifies it for real (_shared/oidc.ts — signature,
// issuer, audience, nonce), then either signs an already-linked user in or
// sends them to /sso/unlinked for admin resolution.
//
// INT-003 is followed literally, same posture as lti-launch: a verified but
// unrecognized `sub` does NOT get an auto-provisioned account. There is no
// tested pattern for that in this codebase (lti-launch's own header comment
// says the same) — building one blind here would be exactly the kind of
// unverified auth code this project's guidelines warn against.
//
// Post-verification (existing-account lookup → unlinked redirect or role
// mapping + session mint) lives in _shared/sso-session.ts, shared with
// saml-acs — a fix there now applies to both protocols, not just this one.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet } from "npm:jose@5";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { OidcValidationError, verifyOidcIdToken, type OidcRejectReason } from "../_shared/oidc.ts";
import { htmlRedirect, jsonError } from "../_shared/sso-http.ts";
import { journalRejected, resolveSsoLoginAndMintSession } from "../_shared/sso-session.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);
    const idpError = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!state) {
      return jsonError("missing_state");
    }

    // Single-use: delete on read so a replayed state can never validate a
    // second time, same pattern as lti_login_states.
    const { data: loginState, error: stateError } = await supabase
      .from("sso_login_states")
      .delete()
      .eq("state", state)
      .select("*")
      .maybeSingle();

    if (stateError || !loginState || new Date(loginState.expires_at) < new Date()) {
      // No connection_id to attribute this to reliably — nothing to journal,
      // same as lti-launch's identical case.
      return jsonError("invalid_or_expired_state");
    }

    const { data: connection, error: connectionError } = await supabase
      .from("identity_connections")
      .select("*")
      .eq("id", loginState.connection_id)
      .maybeSingle();
    if (connectionError || !connection) {
      return jsonError("unknown_connection");
    }

    if (idpError) {
      await journalRejected(supabase, connection.id, `idp_error:${idpError}`);
      return jsonError(`idp_error:${idpError}`);
    }
    if (!code) {
      await journalRejected(supabase, connection.id, "missing_code");
      return jsonError("missing_code");
    }

    const meta = (connection.metadata ?? {}) as Record<string, unknown>;
    const issuer = typeof meta.issuer === "string" ? meta.issuer : null;
    const clientId = typeof meta.client_id === "string" ? meta.client_id : null;
    const tokenEndpoint = typeof meta.token_endpoint === "string" ? meta.token_endpoint : null;
    const jwksUri = typeof meta.jwks_uri === "string" ? meta.jwks_uri : null;
    if (!issuer || !clientId || !tokenEndpoint || !jwksUri) {
      await journalRejected(supabase, connection.id, "connection_not_configured");
      return jsonError("connection_not_configured", 500);
    }

    // Overlap-window rotation (INT-005): try the current secret first, fall
    // back to any other still-active one if the IdP rejects it as an
    // invalid_client — the two only genuinely differ once an admin has
    // rotated and the IdP itself now expects the newer value.
    const { data: secrets } = await supabase
      .from("identity_client_secrets")
      .select("id")
      .eq("connection_id", connection.id)
      .eq("is_active", true)
      .order("version", { ascending: false });

    if (!secrets || secrets.length === 0) {
      await journalRejected(supabase, connection.id, "no_active_secret");
      return jsonError("connection_not_configured", 500);
    }

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/sso-callback`;
    let tokenResponse: { id_token?: string } | null = null;
    let lastTokenError: string | null = null;

    for (const secretRow of secrets) {
      const { data: plaintext } = await supabase.rpc("_decrypt_identity_client_secret", { p_id: secretRow.id });
      if (typeof plaintext !== "string" || !plaintext) continue;

      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: plaintext,
        code_verifier: loginState.code_verifier,
      });
      const resp = await fetch(tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (resp.ok) {
        tokenResponse = await resp.json();
        break;
      }
      lastTokenError = `token_endpoint_${resp.status}`;
    }

    if (!tokenResponse?.id_token) {
      await journalRejected(supabase, connection.id, lastTokenError ?? "token_exchange_failed");
      return jsonError("token_exchange_failed", 401);
    }

    let claims;
    try {
      const jwks = createRemoteJWKSet(new URL(jwksUri));
      claims = await verifyOidcIdToken(tokenResponse.id_token, jwks, {
        issuer,
        audience: clientId,
        expectedNonce: loginState.nonce,
      });
    } catch (err) {
      const reason: OidcRejectReason = err instanceof OidcValidationError ? err.reason : "bad_signature_or_claims";
      await journalRejected(supabase, connection.id, reason);
      return jsonError(reason, 401);
    }

    const result = await resolveSsoLoginAndMintSession(supabase, connection, claims.sub, claims.rawAttributes, loginState.redirect_to);
    if (result.kind === "unlinked") return htmlRedirect(result.redirectUrl);
    if (result.kind === "error") return jsonError(result.reason, 500);
    return htmlRedirect(result.actionLink);
  } catch (err) {
    console.error("[sso-callback] error:", err);
    return jsonError("internal_error", 500);
  }
});
