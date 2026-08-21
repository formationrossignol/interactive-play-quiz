// Generic per-organization OIDC relying-party verification (spec 04, INT-001
// to INT-004). Pure, no DB/network access beyond the caller-supplied
// `getKey` (a remote JWKS), so it can be unit-tested with an in-memory
// keypair — same shape as _shared/lti.ts, which this deliberately mirrors:
// LTI 1.3 login IS an OIDC login, so the same rigor applies here, explicit
// and testable rather than "signature valid" alone.
//
// Acceptance (docs/product-specs/2026-08-10-lms-program/04-interoperability-identity.md):
// "Validation stricte issuer, audience, nonce, state, timestamp et
// signature." — every one of those is a distinct, separately-thrown reason
// below; state itself is checked by the caller (sso-callback), which deletes
// the login-state row before this function ever runs, so a replayed state
// can never reach verification at all.
import { jwtVerify, type JWTVerifyGetKey } from "npm:jose@5";

export type OidcRejectReason =
  | "bad_signature_or_claims"
  | "nonce_mismatch"
  | "missing_subject";

export class OidcValidationError extends Error {
  constructor(public reason: OidcRejectReason, message: string) {
    super(message);
  }
}

export interface OidcIdTokenClaims {
  sub: string;
  email: string | null;
  name: string | null;
  rawAttributes: Record<string, unknown>;
}

/**
 * Verifies signature (via `getKey`), issuer, audience and expiry (jose
 * handles all four from `jwtVerify`'s options — none of these are optional,
 * a caller that forgets to pass `issuer`/`audience` would silently accept a
 * token meant for a different client or platform), then the nonce anti-
 * replay check. Returns the full claim set as `rawAttributes` too, for
 * INT-004's attribute→role mapping — never trims claims down before the
 * caller has had a chance to map them.
 */
export async function verifyOidcIdToken(
  idToken: string,
  getKey: JWTVerifyGetKey,
  opts: { issuer: string; audience: string; expectedNonce: string },
): Promise<OidcIdTokenClaims> {
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, getKey, {
      issuer: opts.issuer,
      audience: opts.audience,
    }));
  } catch (err) {
    throw new OidcValidationError(
      "bad_signature_or_claims",
      `ID token verification failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (payload.nonce !== opts.expectedNonce) {
    throw new OidcValidationError("nonce_mismatch", "id_token nonce does not match the one issued at login");
  }

  const sub = typeof payload.sub === "string" ? payload.sub : "";
  if (!sub) {
    throw new OidcValidationError("missing_subject", "id_token has no sub claim");
  }

  return {
    sub,
    email: typeof payload.email === "string" ? payload.email : null,
    name: typeof payload.name === "string" ? payload.name : null,
    rawAttributes: payload as Record<string, unknown>,
  };
}
