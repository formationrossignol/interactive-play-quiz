// Generic bearer-token verification for any inbound integration this app
// exposes REST endpoints for (SCIM: _shared/scim-auth.ts, OneRoster REST
// sync: oneroster-sync/index.ts). Extracted from this session's SCIM build
// (_shared/scim-auth.ts::verifyScimBearerToken, unchanged behavior) so a
// second consumer (OneRoster) doesn't duplicate the same hash+lookup logic
// under a different name — scim-auth.ts now re-exports from here.
//
// SHA-256 of a high-entropy random token is the correct primitive (not a
// password hash like bcrypt/scrypt — this is a machine-generated secret
// being verified by DB lookup, not a human-memorable low-entropy one), and
// the unique index on api_tokens.token_hash makes the lookup a real index
// seek, the standard mitigation for this threat model.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface ApiTokenAuthContext {
  clientId: string;
  orgId: string;
  scopes: string[];
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Parses `Authorization: Bearer <token>`, hashes it, and resolves it
 *  against api_tokens via the service-role-only _verify_api_token() RPC
 *  (20260821050000_scim.sql). Returns null on any failure (missing header,
 *  malformed, unknown/expired/revoked token, revoked client) — callers
 *  respond with a protocol-appropriate 401, never a stack trace or a hint
 *  about which failure mode it was. `supabase` must be a service-role
 *  client. */
export async function verifyApiBearerToken(req: Request, supabase: SupabaseClient): Promise<ApiTokenAuthContext | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) return null;

  const tokenHash = await sha256Hex(match[1]);
  const { data, error } = await supabase.rpc("_verify_api_token", { p_token_hash: tokenHash });
  const row = data?.[0];
  if (error || !row) return null;

  return { clientId: row.client_id, orgId: row.org_id, scopes: row.scopes ?? [] };
}

export function hasApiScope(ctx: ApiTokenAuthContext, scope: string): boolean {
  return ctx.scopes.includes(scope) || ctx.scopes.includes("*");
}
