// Small HTTP helpers shared by every SSO edge function (OIDC's sso-login/
// sso-callback and SAML's saml-login/saml-acs) — extracted verbatim from
// sso-callback/index.ts (behavior-preserving, not a rewrite) so a fix here
// benefits both protocols instead of drifting between two copies.
import { corsHeaders } from "./cors.ts";

export function htmlRedirect(location: string): Response {
  // form_post-safe meta-refresh — a raw 302 following a cross-site hop is
  // flagged as suspicious by some browsers; this is the conventional
  // workaround (same pattern lti-launch/index.ts already used).
  return new Response(
    `<!doctype html><html><head><meta http-equiv="refresh" content="0;url=${location}"></head>` +
      `<body><script>location.replace(${JSON.stringify(location)})</script>` +
      `<p>Redirection… <a href="${location}">Continuer</a></p></body></html>`,
    { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } },
  );
}

export function appUrl(path: string): string {
  const base = Deno.env.get("PUBLIC_APP_URL");
  if (!base) {
    console.error("[sso] PUBLIC_APP_URL is not configured — falling back to a relative path, which will not resolve for the IdP's browser redirect.");
    return path;
  }
  return new URL(path, base).toString();
}

export function jsonError(reason: string, status = 400): Response {
  return new Response(JSON.stringify({ error: reason }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
