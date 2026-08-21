// SCIM 2.0 (spec 04, SCM-002) — bearer-token verification. Thin SCIM-named
// wrapper over _shared/api-token-auth.ts's generic implementation
// (extracted during OneRoster's build, this session, so a second consumer
// of the same hash+lookup primitive doesn't duplicate it) — behavior is
// unchanged from this function's original shape, existing scim-auth.test.ts
// still exercises the same logic through the same exported names.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { hasApiScope, verifyApiBearerToken, type ApiTokenAuthContext } from "./api-token-auth.ts";

export type ScimAuthContext = ApiTokenAuthContext;

export async function verifyScimBearerToken(req: Request, supabase: SupabaseClient): Promise<ScimAuthContext | null> {
  return verifyApiBearerToken(req, supabase);
}

export function hasScimScope(ctx: ScimAuthContext, scope: string): boolean {
  return hasApiScope(ctx, scope);
}
