// Public JWKS document for a single LTI registration — this tool's own
// public key(s), for the platform to verify Deep Linking responses / AGS/
// NRPS client assertions this tool signs (LTI-002/003/004, none built yet —
// this is the foundation those tasks build on). No auth: a JWKS is public
// key material by definition, this is the exact reverse of what
// `lti_registrations.jwks_url` already does for the platform's own key,
// fetched today by `lti-launch`/`lti-test-connection`.
//
// Parameterized by registration_id (path segment) rather than one tool-wide
// document — see 20260821010000_lti_tool_signing_keys.sql's header for why
// each registration gets its own keypair.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const url = new URL(req.url);
    const registrationId = url.searchParams.get("registration_id") ?? url.pathname.split("/").filter(Boolean).pop();
    if (!registrationId) {
      return new Response(JSON.stringify({ error: "missing_registration_id" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.rpc("get_lti_tool_jwks", { p_registration_id: registrationId });
    if (error) {
      console.error("[lti-jwks] error:", error);
      return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify(data ?? { keys: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    console.error("[lti-jwks] error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: corsHeaders });
  }
});
