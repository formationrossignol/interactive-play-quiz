// LTI 1.3 Core — launch endpoint (LTI-001/LTI-005/LTI-006).
// The platform POSTs `id_token` (a signed JWT) + `state` here after
// lti-login redirected the browser to its auth endpoint. Validates the
// token for real (signature via the registration's own JWKS, issuer,
// audience, nonce, deployment — see _shared/lti.ts, unit-tested against a
// generated keypair in lti.test.ts), then either signs the already-linked
// user in, or sends an unlinked launch to an explanatory page.
//
// LTI-005 is followed literally: "un lancement ne crée jamais une
// organisation implicitement" — extended here to *never silently create a
// Brivia account either*. An unrecognized `sub` does not get an
// auto-provisioned account; there is no tested, reviewable pattern for
// that in this codebase yet (see VALIDATION-STATUS.md §04), so building it
// blind would be exactly the kind of unverified auth code the project
// guidelines warn against. Every rejection, linked or not, is journaled via
// record_lti_launch() (LTI-006).
import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet } from "npm:jose@5";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { LtiValidationError, verifyLtiLaunch, type LtiRejectReason } from "../_shared/lti.ts";

function htmlRedirect(location: string) {
  // form_post landings often get flagged by browsers as suspicious for a
  // raw 302 following a cross-site POST; a same-document meta-refresh /
  // JS redirect is the conventional, more reliable way LTI tools finish
  // this hop. Falls back to a visible link if JS/meta-refresh is blocked.
  return new Response(
    `<!doctype html><html><head><meta http-equiv="refresh" content="0;url=${location}"></head>` +
      `<body><script>location.replace(${JSON.stringify(location)})</script>` +
      `<p>Redirection… <a href="${location}">Continuer</a></p></body></html>`,
    { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } },
  );
}

function appUrl(path: string): string {
  const base = Deno.env.get("PUBLIC_APP_URL");
  if (!base) {
    console.error("[lti-launch] PUBLIC_APP_URL is not configured — falling back to a relative path, which will not resolve for the platform's browser redirect.");
    return path;
  }
  return new URL(path, base).toString();
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const form = await req.formData();
    const idToken = form.get("id_token");
    const state = form.get("state");
    if (typeof idToken !== "string" || typeof state !== "string") {
      return new Response(JSON.stringify({ error: "invalid_payload" }), { status: 400, headers: corsHeaders });
    }

    // Single-use: delete on read so a replayed state can never validate a
    // second time even if the id_token itself were somehow replayed too.
    const { data: loginState, error: stateError } = await supabase
      .from("lti_login_states")
      .delete()
      .eq("state", state)
      .select("*")
      .maybeSingle();

    if (stateError || !loginState || new Date(loginState.expires_at) < new Date()) {
      // No registration_id to attribute this to — nothing to journal.
      return new Response(JSON.stringify({ error: "invalid_or_expired_state" }), { status: 400, headers: corsHeaders });
    }

    const { data: registration, error: registrationError } = await supabase
      .from("lti_registrations").select("*").eq("id", loginState.registration_id).maybeSingle();
    if (registrationError || !registration) {
      return new Response(JSON.stringify({ error: "unknown_registration" }), { status: 400, headers: corsHeaders });
    }

    const journal = (args: { deploymentId: string | null; subject: string | null; status: "success" | "rejected"; errorReason?: string; userId?: string | null }) =>
      supabase.rpc("record_lti_launch", {
        p_registration_id: registration.id,
        p_deployment_id: args.deploymentId,
        p_subject: args.subject,
        p_nonce: loginState.nonce,
        p_user_id: args.userId ?? null,
        p_status: args.status,
        p_error_reason: args.errorReason ?? null,
      });

    let claims;
    try {
      const jwks = createRemoteJWKSet(new URL(registration.jwks_url));
      claims = await verifyLtiLaunch(idToken, jwks, {
        issuer: registration.issuer,
        audience: registration.client_id,
        expectedNonce: loginState.nonce,
      });
    } catch (err) {
      const reason: LtiRejectReason = err instanceof LtiValidationError ? err.reason : "bad_signature_or_claims";
      await journal({ deploymentId: null, subject: null, status: "rejected", errorReason: reason });
      return new Response(JSON.stringify({ error: reason }), { status: 401, headers: corsHeaders });
    }

    const { data: deployment } = await supabase
      .from("lti_deployments")
      .select("*")
      .eq("registration_id", registration.id)
      .eq("deployment_id", claims.deploymentId)
      .maybeSingle();

    if (!deployment) {
      await journal({ deploymentId: claims.deploymentId, subject: claims.sub, status: "rejected", errorReason: "unknown_deployment" });
      return new Response(JSON.stringify({ error: "unknown_deployment" }), { status: 403, headers: corsHeaders });
    }

    // external_mappings.external_id is globally unique per (system,
    // object_type) — a bare `sub` is only unique *within one issuer*, so it
    // is namespaced by registration_id here to avoid two different
    // platforms' subjects colliding in this shared table.
    const externalId = `${registration.id}:${claims.sub}`;
    const { data: mapping } = await supabase
      .from("external_mappings")
      .select("internal_id")
      .eq("system", "lti")
      .eq("object_type", "user")
      .eq("external_id", externalId)
      .maybeSingle();

    if (!mapping) {
      await journal({ deploymentId: claims.deploymentId, subject: claims.sub, status: "success", userId: null });
      const unlinkedUrl = appUrl(`/lti/unlinked?registration=${registration.id}&target=${encodeURIComponent(loginState.target_link_uri)}`);
      return htmlRedirect(unlinkedUrl);
    }

    const { data: userResult, error: userError } = await supabase.auth.admin.getUserById(mapping.internal_id);
    if (userError || !userResult?.user?.email) {
      await journal({ deploymentId: claims.deploymentId, subject: claims.sub, status: "rejected", errorReason: "linked_user_not_found" });
      return new Response(JSON.stringify({ error: "linked_user_not_found" }), { status: 500, headers: corsHeaders });
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: userResult.user.email,
      options: { redirectTo: loginState.target_link_uri },
    });
    if (linkError || !linkData?.properties?.action_link) {
      await journal({ deploymentId: claims.deploymentId, subject: claims.sub, status: "rejected", errorReason: "session_mint_failed" });
      return new Response(JSON.stringify({ error: "session_mint_failed" }), { status: 500, headers: corsHeaders });
    }

    await journal({ deploymentId: claims.deploymentId, subject: claims.sub, status: "success", userId: mapping.internal_id });
    return htmlRedirect(linkData.properties.action_link);
  } catch (err) {
    console.error("[lti-launch] error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: corsHeaders });
  }
});
