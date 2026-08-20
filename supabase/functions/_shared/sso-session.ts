// Shared post-verification sequence for every SSO protocol (OIDC's
// sso-callback, SAML's saml-acs): once a protocol-specific verifier has
// produced a trusted (subject, rawAttributes) pair, what happens next is
// identical regardless of how it got there — look up external_identities,
// send an unrecognized subject to /sso/unlinked (INT-003, never
// auto-provision), otherwise apply the connection's role mapping (INT-004)
// and mint a real session. Extracted from sso-callback/index.ts's original
// post-verification block (behavior-preserving) so a fix here can't
// silently apply to only one protocol and not the other.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { appUrl } from "./sso-http.ts";

export type SsoSessionResult =
  | { kind: "unlinked"; redirectUrl: string }
  | { kind: "session"; actionLink: string }
  | { kind: "error"; reason: string };

function journal(
  supabase: SupabaseClient,
  connectionId: string,
  args: { subject: string | null; rawAttributes: Record<string, unknown> | null; status: "success" | "rejected"; errorReason?: string; userId?: string | null },
) {
  return supabase.rpc("record_sso_login", {
    p_connection_id: connectionId,
    p_external_subject: args.subject,
    p_raw_attributes: args.rawAttributes,
    p_user_id: args.userId ?? null,
    p_status: args.status,
    p_error_reason: args.errorReason ?? null,
  });
}

/**
 * `supabase` must be a service-role client — this does an RLS-bypassing
 * write to `external_identities.raw_attributes` and to `user_org_roles`
 * scoped to a row/subject this exact verified login just proved control of.
 */
export async function resolveSsoLoginAndMintSession(
  supabase: SupabaseClient,
  connection: { id: string; org_id: string },
  subject: string,
  rawAttributes: Record<string, unknown>,
  redirectTo: string,
): Promise<SsoSessionResult> {
  const { data: existing } = await supabase
    .from("external_identities")
    .select("id, user_id")
    .eq("connection_id", connection.id)
    .eq("external_subject", subject)
    .maybeSingle();

  if (!existing) {
    // Verified, but no linked Brivia account — never auto-provisioned
    // (INT-003), admin resolves it at /sso/unlinked.
    await journal(supabase, connection.id, { subject, rawAttributes, status: "success", userId: null });
    const redirectUrl = appUrl(`/sso/unlinked?connection=${connection.id}&target=${encodeURIComponent(redirectTo)}`);
    return { kind: "unlinked", redirectUrl };
  }

  // Refresh the latest-known snapshot.
  await supabase.from("external_identities").update({ raw_attributes: rawAttributes }).eq("id", existing.id);

  // INT-004: additive only — see sso-callback's original comment on why
  // role revocation-on-mismatch is a separate, bigger design decision not
  // inferred here.
  const { data: resolvedRoles } = await supabase.rpc("_resolve_sso_roles", {
    p_connection_id: connection.id,
    p_attributes: rawAttributes,
  });
  for (const role of (resolvedRoles ?? []) as string[]) {
    await supabase.from("user_org_roles").upsert(
      { org_id: connection.org_id, user_id: existing.user_id, role },
      { onConflict: "user_id,org_id,role", ignoreDuplicates: true },
    );
  }

  const { data: userResult, error: userError } = await supabase.auth.admin.getUserById(existing.user_id);
  if (userError || !userResult?.user?.email) {
    await journal(supabase, connection.id, { subject, rawAttributes, status: "rejected", errorReason: "linked_user_not_found" });
    return { kind: "error", reason: "linked_user_not_found" };
  }

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: userResult.user.email,
    options: { redirectTo },
  });
  if (linkError || !linkData?.properties?.action_link) {
    await journal(supabase, connection.id, { subject, rawAttributes, status: "rejected", errorReason: "session_mint_failed" });
    return { kind: "error", reason: "session_mint_failed" };
  }

  await journal(supabase, connection.id, { subject, rawAttributes, status: "success", userId: existing.user_id });
  return { kind: "session", actionLink: linkData.properties.action_link };
}

/** Journals a rejection that happened before subject/attributes were ever
 *  established (bad code, expired state, verification failure, etc) —
 *  exported so protocol-specific callers don't need their own copy of the
 *  RPC-calling shape for this one case. */
export function journalRejected(supabase: SupabaseClient, connectionId: string, errorReason: string) {
  return journal(supabase, connectionId, { subject: null, rawAttributes: null, status: "rejected", errorReason });
}
