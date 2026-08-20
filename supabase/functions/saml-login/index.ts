// SAML SSO — login initiation (INT-001/INT-002). Builds an SP-initiated
// AuthnRequest (HTTP-Redirect binding, unsigned — see _shared/saml.ts's
// header for why) and sends the browser to the IdP's SSO URL. Mirrors
// sso-login/index.ts's shape exactly, including its INT-002 test-mode
// GET-vs-POST split (see that file's header comment for the full reasoning
// — a raw <a href> navigation can't carry an Authorization header, so
// testing a not-yet-active connection has to go through
// supabase.functions.invoke instead).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { createSamlAuthnRequest } from "../_shared/saml.ts";

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
      .eq("protocol", "saml")
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
    const idpEntityId = typeof meta.idp_entity_id === "string" ? meta.idp_entity_id : null;
    const idpSsoUrl = typeof meta.idp_sso_url === "string" ? meta.idp_sso_url : null;
    const idpCert = typeof meta.idp_cert === "string" ? meta.idp_cert : null;
    if (!idpEntityId || !idpSsoUrl || !idpCert) {
      return jsonBody("connection_not_configured");
    }

    const spEntityId = `${Deno.env.get("PUBLIC_APP_URL")}/sso/saml/metadata`;
    const spAcsUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/saml-acs`;

    const { requestId, redirectUrl } = createSamlAuthnRequest({ idpEntityId, idpSsoUrl, idpCert, spEntityId, spAcsUrl });

    const relayState = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase.from("saml_login_states").insert({
      connection_id: connection.id,
      relay_state: relayState,
      request_id: requestId,
      redirect_to: redirectTo,
      expires_at: expiresAt,
    });
    if (insertError) {
      console.error("[saml-login] failed to persist login state:", insertError);
      return jsonBody("internal_error", 500);
    }

    const finalUrl = new URL(redirectUrl);
    finalUrl.searchParams.set("RelayState", relayState);

    if (isPost) {
      return new Response(JSON.stringify({ redirectUrl: finalUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(null, { status: 302, headers: { ...corsHeaders, Location: finalUrl.toString() } });
  } catch (err) {
    console.error("[saml-login] error:", err);
    return jsonBody("internal_error", 500);
  }
});
