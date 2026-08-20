// SAML SSO — Assertion Consumer Service (INT-001/INT-003/INT-004). The IdP
// POSTs `SAMLResponse` (+`RelayState`) here after the user authenticates at
// saml-login's redirect. Verifies the response for real (_shared/saml.ts —
// signature, audience, Conditions window, InResponseTo), then either signs
// an already-linked user in or sends them to /sso/unlinked for admin
// resolution (_shared/sso-session.ts, shared with sso-callback's OIDC path
// — see that file's header).
//
// RelayState is SAML's analog of OIDC's `state`: an opaque token this app
// minted at saml-login and stores server-side (saml_login_states), looked
// up here to recover which connection/redirect_to this response belongs to,
// and deleted on read so a replayed RelayState can never validate twice —
// same shape as sso_login_states.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { SamlValidationError, verifySamlResponse, type SamlRejectReason } from "../_shared/saml.ts";
import { htmlRedirect, jsonError } from "../_shared/sso-http.ts";
import { journalRejected, resolveSsoLoginAndMintSession } from "../_shared/sso-session.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonError("method_not_allowed", 405);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let samlResponse: string | null = null;
    let relayState: string | null = null;
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      samlResponse = typeof form.get("SAMLResponse") === "string" ? (form.get("SAMLResponse") as string) : null;
      relayState = typeof form.get("RelayState") === "string" ? (form.get("RelayState") as string) : null;
    } else {
      const body = await req.json().catch(() => ({}));
      samlResponse = typeof body.SAMLResponse === "string" ? body.SAMLResponse : null;
      relayState = typeof body.RelayState === "string" ? body.RelayState : null;
    }

    if (!relayState) {
      return jsonError("missing_relay_state");
    }

    // Single-use: delete on read, same pattern as sso_login_states.
    const { data: loginState, error: stateError } = await supabase
      .from("saml_login_states")
      .delete()
      .eq("relay_state", relayState)
      .select("*")
      .maybeSingle();

    if (stateError || !loginState || new Date(loginState.expires_at) < new Date()) {
      // No connection_id to attribute this to reliably — nothing to journal,
      // same as sso-callback's identical case.
      return jsonError("invalid_or_expired_relay_state");
    }

    const { data: connection, error: connectionError } = await supabase
      .from("identity_connections")
      .select("*")
      .eq("id", loginState.connection_id)
      .maybeSingle();
    if (connectionError || !connection) {
      return jsonError("unknown_connection");
    }

    if (!samlResponse) {
      await journalRejected(supabase, connection.id, "missing_saml_response");
      return jsonError("missing_saml_response");
    }

    const meta = (connection.metadata ?? {}) as Record<string, unknown>;
    const idpEntityId = typeof meta.idp_entity_id === "string" ? meta.idp_entity_id : null;
    const idpSsoUrl = typeof meta.idp_sso_url === "string" ? meta.idp_sso_url : null;
    const idpCert = typeof meta.idp_cert === "string" ? meta.idp_cert : null;
    if (!idpEntityId || !idpSsoUrl || !idpCert) {
      await journalRejected(supabase, connection.id, "connection_not_configured");
      return jsonError("connection_not_configured", 500);
    }

    const spEntityId = `${Deno.env.get("PUBLIC_APP_URL")}/sso/saml/metadata`;
    const spAcsUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/saml-acs`;

    let claims;
    try {
      claims = await verifySamlResponse(
        samlResponse,
        { idpEntityId, idpSsoUrl, idpCert, spEntityId, spAcsUrl },
        loginState.request_id,
      );
    } catch (err) {
      const reason: SamlRejectReason = err instanceof SamlValidationError ? err.reason : "bad_signature_or_cert";
      await journalRejected(supabase, connection.id, reason);
      return jsonError(reason, 401);
    }

    const result = await resolveSsoLoginAndMintSession(supabase, connection, claims.subject, claims.rawAttributes, loginState.redirect_to);
    if (result.kind === "unlinked") return htmlRedirect(result.redirectUrl);
    if (result.kind === "error") return jsonError(result.reason, 500);
    return htmlRedirect(result.actionLink);
  } catch (err) {
    console.error("[saml-acs] error:", err);
    return jsonError("internal_error", 500);
  }
});
