// LTI 1.3 Core — third-party initiated OIDC login (LTI-001).
// The platform (Moodle, Canvas, …) redirects the browser here first, with
// `iss`/`login_hint`/`target_link_uri` identifying who's launching and
// where they want to end up. This mints state+nonce, stores them (see
// 20260811030000_lti_login_state.sql for why a DB row instead of a
// cookie), and bounces the browser on to the platform's own auth endpoint
// — which will POST the actual id_token back to lti-launch.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

function badRequest(reason: string) {
  return new Response(JSON.stringify({ error: reason }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function readParams(req: Request): Promise<Record<string, string>> {
  if (req.method === "GET") {
    return Object.fromEntries(new URL(req.url).searchParams);
  }
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries((await req.formData()) as unknown as Iterable<[string, string]>);
  }
  return await req.json().catch(() => ({}));
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const params = await readParams(req);
    const iss = params.iss;
    const loginHint = params.login_hint;
    const targetLinkUri = params.target_link_uri;
    const clientId = params.client_id;

    if (!iss || !loginHint || !targetLinkUri) {
      return badRequest("missing_required_param");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // A single (issuer, client_id) is assumed to resolve to exactly one
    // active registration — the unique constraint on lti_registrations is
    // (org_id, issuer, client_id), so two *different* orgs registering the
    // same platform+client_id would collide here. Out of scope for a single
    // pass: flagged in VALIDATION-STATUS rather than silently picked.
    let query = supabase.from("lti_registrations").select("*").eq("issuer", iss).eq("status", "active");
    if (clientId) query = query.eq("client_id", clientId);
    const { data: registration, error } = await query.limit(1).maybeSingle();

    if (error || !registration) {
      return badRequest("unknown_registration");
    }

    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("lti_login_states").insert({
      registration_id: registration.id,
      state,
      nonce,
      target_link_uri: targetLinkUri,
      expires_at: expiresAt,
    });
    if (insertError) {
      console.error("[lti-login] failed to persist login state:", insertError);
      return new Response(JSON.stringify({ error: "internal_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/lti-launch`;
    const authUrl = new URL(registration.auth_login_url);
    authUrl.searchParams.set("scope", "openid");
    authUrl.searchParams.set("response_type", "id_token");
    authUrl.searchParams.set("client_id", registration.client_id);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("login_hint", loginHint);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_mode", "form_post");
    authUrl.searchParams.set("nonce", nonce);
    authUrl.searchParams.set("prompt", "none");
    if (params.lti_message_hint) authUrl.searchParams.set("lti_message_hint", params.lti_message_hint);
    if (params.lti_deployment_id) authUrl.searchParams.set("lti_deployment_id", params.lti_deployment_id);

    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: authUrl.toString() },
    });
  } catch (err) {
    console.error("[lti-login] error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
