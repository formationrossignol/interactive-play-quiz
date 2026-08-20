// LTI-002 — Deep Linking response. The picker page (/lti/deep-link) calls
// this once the staff member has picked a piece of content: builds a signed
// DeepLinkingResponse JWT and returns it as JSON `{jwt, actionUrl}` — the
// page itself then builds and auto-submits the actual POST form to the
// platform. This function can't return the form directly and let the
// browser follow it via a raw navigation: it must run authenticated (see
// below), and only supabase.functions.invoke() attaches the caller's JWT
// automatically — a bare top-level navigation can't carry an Authorization
// header, the same constraint sso-login's test-mode POST-vs-GET split
// already had to work around for OIDC.
//
// JWT-verified by default (no verify_jwt=false in config.toml) — runs as the
// caller's own session, because consume_lti_deep_linking_session() checks
// auth.uid() = session.user_id. The `content` row is read through a client
// carrying the caller's own JWT too (not service_role), so RLS enforces
// ownership on its own rather than this function re-implementing that check.
//
// Content-type reality check (see 20260821020000_lti_deep_linking.sql's
// header): only `course` content has a direct, session-less, id-addressable
// viewing route (/course/:courseId) in this app today. quiz/poll/exam are
// entirely game-code/join-code/live-session based and have no "one learner,
// one piece of content, direct launch" destination to point content_items[].
// url at — deep-linking those types is not attempted here, the picker page
// only offers courses. This function itself doesn't hardcode that
// restriction (it signs whatever content row it's given), the UI does.
import { createClient } from "npm:@supabase/supabase-js@2";
import { importPKCS8 } from "npm:jose@5";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { signLtiJwt } from "../_shared/lti-signing.ts";

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

    const { session_id: sessionId, content_id: contentId } = await req.json().catch(() => ({}));
    if (typeof sessionId !== "string" || typeof contentId !== "string") {
      return new Response(JSON.stringify({ error: "missing_required_param" }), { status: 400, headers: corsHeaders });
    }

    // Single-use: consume_lti_deep_linking_session() deletes on read and
    // checks auth.uid() = user_id internally (called via callerClient, not
    // service_role, so auth.uid() resolves to the real caller).
    const { data: sessionRows, error: sessionError } = await callerClient.rpc("consume_lti_deep_linking_session", {
      p_session_id: sessionId,
    });
    const session = sessionRows?.[0];
    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "invalid_or_expired_session" }), { status: 400, headers: corsHeaders });
    }

    // RLS (content_owner policy) enforces this belongs to the caller — no
    // manual ownership check needed, callerClient carries their own JWT.
    const { data: content, error: contentError } = await callerClient
      .from("content")
      .select("id, type, data")
      .eq("id", contentId)
      .maybeSingle();
    if (contentError || !content) {
      return new Response(JSON.stringify({ error: "content_not_found" }), { status: 404, headers: corsHeaders });
    }

    const { data: registration, error: registrationError } = await serviceClient
      .from("lti_registrations")
      .select("id, issuer, client_id")
      .eq("id", session.registration_id)
      .maybeSingle();
    if (registrationError || !registration) {
      return new Response(JSON.stringify({ error: "unknown_registration" }), { status: 400, headers: corsHeaders });
    }

    // Signing needs one active key for this registration — see
    // 20260821010000_lti_tool_signing_keys.sql / lti-generate-key. A
    // registration with zero active keys cannot sign a Deep Linking
    // response at all; this must fail clearly, not silently, since there is
    // nothing "unsigned" this protocol can fall back to.
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

    const title = typeof content.data?.title === "string" ? content.data.title : `Contenu Brivia (${content.type})`;
    const resourceLinkUrl = `${Deno.env.get("PUBLIC_APP_URL")}/lti/resource-link?content_id=${content.id}&content_type=${content.type}`;

    const claims: Record<string, unknown> = {
      iss: registration.client_id,
      aud: registration.issuer,
      "https://purl.imsglobal.org/spec/lti/claim/deployment_id": session.deployment_id,
      "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiDeepLinkingResponse",
      "https://purl.imsglobal.org/spec/lti/claim/version": "1.3.0",
      "https://purl.imsglobal.org/spec/lti-dl/claim/content_items": [
        { type: "ltiResourceLink", url: resourceLinkUrl, title },
      ],
    };
    // Only echo `data` if the platform actually sent one — inventing an
    // empty string would be a lie about what was received.
    if (session.platform_data) {
      claims["https://purl.imsglobal.org/spec/lti-dl/claim/data"] = session.platform_data;
    }

    const jwt = await signLtiJwt(claims, privateKey, keyRow.kid, { expiresIn: "5m" });
    return new Response(JSON.stringify({ jwt, actionUrl: session.deep_link_return_url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[lti-deep-linking-response] error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: corsHeaders });
  }
});
