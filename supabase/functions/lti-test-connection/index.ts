// LTI-006 "test de connexion" — reachability/shape check for a
// registration's jwks_url, callable from the admin UI before activating a
// registration. Read-only: nothing is persisted here (lti_launches only
// journals real launches, see lti-launch/index.ts) — this is a pre-flight
// sanity check, not a launch attempt.
//
// Authorization is delegated to RLS: the select below runs with the
// caller's own JWT (not service role), so it only succeeds if
// lti_registrations_admin (has_org_role(org_id, ['admin'])) allows it —
// no separate role check needed here.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const { registrationId } = await req.json();
    if (!registrationId) return json({ ok: false, reason: "missing_registration_id" }, 400);

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: registration, error } = await userClient
      .from("lti_registrations")
      .select("jwks_url")
      .eq("id", registrationId)
      .maybeSingle();
    if (error || !registration) return json({ ok: false, reason: "not_authorized_or_not_found" }, 403);

    let response: Response;
    try {
      response = await fetch(registration.jwks_url, { signal: AbortSignal.timeout(8000) });
    } catch {
      return json({ ok: false, reason: "unreachable" });
    }
    if (!response.ok) return json({ ok: false, reason: `http_${response.status}` });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return json({ ok: false, reason: "invalid_json" });
    }
    const keys = (body as { keys?: unknown[] } | null)?.keys;
    if (!Array.isArray(keys) || keys.length === 0) return json({ ok: false, reason: "no_keys" });

    return json({ ok: true, keyCount: keys.length });
  } catch (err) {
    console.error("[lti-test-connection]", err);
    return json({ ok: false, reason: "internal_error" }, 500);
  }
});
