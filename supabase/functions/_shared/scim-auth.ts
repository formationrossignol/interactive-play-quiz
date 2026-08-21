// SCIM 2.0 (spec 04, SCM-002) — bearer-token verification. This is a new
// pattern for this codebase: every other integration built this session
// (SSO/LTI/OIDC) verifies a signed JWT; SCIM verifies a static opaque token
// an external IdP presents on every request, by SHA-256 hash lookup against
// api_tokens.token_hash (_verify_api_token(), service_role only,
// 20260821050000_scim.sql). SHA-256 of a high-entropy random token is the
// correct primitive here (not a password hash like bcrypt/scrypt — this
// isn't a human-memorable low-entropy secret vulnerable to offline
// guessing), and a unique index on token_hash makes the lookup itself a
// real index seek, not a linear scan — the standard mitigation against
// timing concerns for this exact threat model.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface ScimAuthContext {
  clientId: string;
  orgId: string;
  scopes: string[];
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Parses `Authorization: Bearer <token>`, hashes it, and resolves it
 *  against api_tokens via the service-role-only _verify_api_token() RPC.
 *  Returns null on any failure (missing header, malformed, unknown/expired/
 *  revoked token, revoked client) — callers respond with a SCIM-shaped 401,
 *  never a stack trace or a hint about which failure mode it was (an
 *  attacker probing for valid-but-expired vs entirely-unknown tokens gets
 *  no signal either way). `supabase` must be a service-role client. */
export async function verifyScimBearerToken(req: Request, supabase: SupabaseClient): Promise<ScimAuthContext | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) return null;

  const tokenHash = await sha256Hex(match[1]);
  const { data, error } = await supabase.rpc("_verify_api_token", { p_token_hash: tokenHash });
  const row = data?.[0];
  if (error || !row) return null;

  return { clientId: row.client_id, orgId: row.org_id, scopes: row.scopes ?? [] };
}

export function hasScimScope(ctx: ScimAuthContext, scope: string): boolean {
  return ctx.scopes.includes(scope) || ctx.scopes.includes("*");
}
