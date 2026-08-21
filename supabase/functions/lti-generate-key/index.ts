// Admin action: generate this tool's own RSA signing keypair for one LTI
// registration (foundation for Deep Linking LTI-002 and AGS/NRPS
// LTI-004/LTI-003 — closes the gap the original foundation commit left open:
// lti_tool_keys/get_lti_tool_jwks()/_decrypt_lti_tool_key() all existed with
// no way to ever create the first row).
//
// JWT-verified by default (no verify_jwt=false override in config.toml,
// same posture as sso-discover-oidc) — this must run as the caller's own
// session, not service_role, because generate_lti_tool_key() resolves
// `auth.uid()` for both its admin check (has_org_role) and `created_by`.
// The private key never leaves this function in plaintext except in the one
// RPC call that immediately vault-encrypts it (mirrors create_identity_
// client_secret()'s exact trust boundary for OIDC's client_secret) — it is
// never logged, never returned to the caller in the response.
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateKeyPair, exportJWK, exportPKCS8 } from "npm:jose@5";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

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

    const { registration_id: registrationId } = await req.json().catch(() => ({}));
    if (typeof registrationId !== "string" || !registrationId) {
      return new Response(JSON.stringify({ error: "missing_registration_id" }), { status: 400, headers: corsHeaders });
    }

    const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
    const kid = crypto.randomUUID();
    const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: "RS256", use: "sig" };
    const privateKeyPkcs8 = await exportPKCS8(privateKey);

    // Admin check + vault encryption + row insert all happen inside this one
    // RPC (generate_lti_tool_key, 20260821010000_lti_tool_signing_keys.sql)
    // — called through callerClient (not service_role) so auth.uid() there
    // resolves to the real caller, not null/service-role.
    const { data: keyId, error } = await callerClient.rpc("generate_lti_tool_key", {
      p_registration_id: registrationId,
      p_kid: kid,
      p_public_jwk: publicJwk,
      p_private_key_pkcs8: privateKeyPkcs8,
    });

    if (error) {
      // "Not authorized" (not an admin of this registration's org) is the
      // expected rejection shape here — surfaced as 403 rather than a bare
      // 500, everything else (unexpected DB error) stays a 500.
      const status = error.message?.includes("Not authorized") ? 403 : 500;
      return new Response(JSON.stringify({ error: error.message ?? "generate_key_failed" }), { status, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ id: keyId, kid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[lti-generate-key] error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: corsHeaders });
  }
});
