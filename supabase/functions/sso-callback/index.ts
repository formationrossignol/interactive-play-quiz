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
import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet } from "npm:jose@5";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { OidcValidationError, verifyOidcIdToken, type OidcRejectReason } from "../_shared/oidc.ts";

function htmlRedirect(location: string) {
  // Same form_post-safe meta-refresh pattern as lti-launch/index.ts — a raw
  // 302 following a cross-site hop is flagged as suspicious by some
  // browsers; this is the conventional workaround.
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
    console.error("[sso-callback] PUBLIC_APP_URL is not configured — falling back to a relative path, which will not resolve for the IdP's browser redirect.");
    return path;
  }
  return new URL(path, base).toString();
}

function jsonError(reason: string, status = 400) {
  return new Response(JSON.stringify({ error: reason }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

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

    const journal = (args: { subject: string | null; rawAttributes: Record<string, unknown> | null; status: "success" | "rejected"; errorReason?: string; userId?: string | null }) =>
      supabase.rpc("record_sso_login", {
        p_connection_id: connection.id,
        p_external_subject: args.subject,
        p_raw_attributes: args.rawAttributes,
        p_user_id: args.userId ?? null,
        p_status: args.status,
        p_error_reason: args.errorReason ?? null,
      });

    if (idpError) {
      await journal({ subject: null, rawAttributes: null, status: "rejected", errorReason: `idp_error:${idpError}` });
      return jsonError(`idp_error:${idpError}`);
    }
    if (!code) {
      await journal({ subject: null, rawAttributes: null, status: "rejected", errorReason: "missing_code" });
      return jsonError("missing_code");
    }

    const meta = (connection.metadata ?? {}) as Record<string, unknown>;
    const issuer = typeof meta.issuer === "string" ? meta.issuer : null;
    const clientId = typeof meta.client_id === "string" ? meta.client_id : null;
    const tokenEndpoint = typeof meta.token_endpoint === "string" ? meta.token_endpoint : null;
    const jwksUri = typeof meta.jwks_uri === "string" ? meta.jwks_uri : null;
    if (!issuer || !clientId || !tokenEndpoint || !jwksUri) {
      await journal({ subject: null, rawAttributes: null, status: "rejected", errorReason: "connection_not_configured" });
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
      await journal({ subject: null, rawAttributes: null, status: "rejected", errorReason: "no_active_secret" });
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
      await journal({ subject: null, rawAttributes: null, status: "rejected", errorReason: lastTokenError ?? "token_exchange_failed" });
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
      await journal({ subject: null, rawAttributes: null, status: "rejected", errorReason: reason });
      return jsonError(reason, 401);
    }

    const { data: existing } = await supabase
      .from("external_identities")
      .select("id, user_id")
      .eq("connection_id", connection.id)
      .eq("external_subject", claims.sub)
      .maybeSingle();

    if (!existing) {
      // Verified, but no linked Brivia account — same "success but unlinked"
      // journaling as lti-launch, never auto-provisioned (see file header).
      await journal({ subject: claims.sub, rawAttributes: claims.rawAttributes, status: "success", userId: null });
      const unlinkedUrl = appUrl(`/sso/unlinked?connection=${connection.id}&target=${encodeURIComponent(loginState.redirect_to)}`);
      return htmlRedirect(unlinkedUrl);
    }

    // Refresh the latest-known snapshot (service_role bypasses RLS; this is
    // the one write path outside link_sso_subject(), scoped to a row this
    // exact verified login just proved the subject controls).
    await supabase.from("external_identities").update({ raw_attributes: claims.rawAttributes }).eq("id", existing.id);

    // INT-004: apply the connection's attribute→role mapping. Additive only
    // — a role a previous login granted but this one's attributes no longer
    // match is left alone; the spec (INT-004) describes mapping roles in,
    // not a full reconciling sync, and revocation-on-mismatch would be a
    // much bigger, separate design decision (what happens to a role granted
    // by a rule that's since been deleted, by a manual admin grant, etc.)
    // not something to infer silently here.
    const { data: resolvedRoles } = await supabase.rpc("_resolve_sso_roles", {
      p_connection_id: connection.id,
      p_attributes: claims.rawAttributes,
    });
    for (const role of (resolvedRoles ?? []) as string[]) {
      await supabase.from("user_org_roles").upsert(
        { org_id: connection.org_id, user_id: existing.user_id, role },
        { onConflict: "user_id,org_id,role", ignoreDuplicates: true },
      );
    }

    const { data: userResult, error: userError } = await supabase.auth.admin.getUserById(existing.user_id);
    if (userError || !userResult?.user?.email) {
      await journal({ subject: claims.sub, rawAttributes: claims.rawAttributes, status: "rejected", errorReason: "linked_user_not_found" });
      return jsonError("linked_user_not_found", 500);
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: userResult.user.email,
      options: { redirectTo: loginState.redirect_to },
    });
    if (linkError || !linkData?.properties?.action_link) {
      await journal({ subject: claims.sub, rawAttributes: claims.rawAttributes, status: "rejected", errorReason: "session_mint_failed" });
      return jsonError("session_mint_failed", 500);
    }

    await journal({ subject: claims.sub, rawAttributes: claims.rawAttributes, status: "success", userId: existing.user_id });
    return htmlRedirect(linkData.properties.action_link);
  } catch (err) {
    console.error("[sso-callback] error:", err);
    return jsonError("internal_error", 500);
  }
});
