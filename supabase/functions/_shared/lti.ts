// LTI 1.3 Core (LTI-001) launch validation — pure, no DB/network access, so
// it can be unit-tested with an in-memory keypair (see lti.test.ts) and
// reused as-is by supabase/functions/lti-launch, which supplies the real
// remote JWKS.
//
// Acceptance (docs/product-specs/2026-08-10-lms-program/04-interoperability-identity.md):
// "Un JWT expiré, mauvais nonce ou mauvais deployment est rejeté et
// journalisé" — every failure here throws a LtiValidationError carrying a
// stable `reason` code the caller writes verbatim into lti_launches.error_reason.
import { jwtVerify, type JWTVerifyGetKey } from "npm:jose@5";

const DEPLOYMENT_ID_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/deployment_id";
const MESSAGE_TYPE_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/message_type";
const VERSION_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/version";
const ROLES_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/roles";
const CONTEXT_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/context";

export type LtiRejectReason =
  | "bad_signature_or_claims"
  | "nonce_mismatch"
  | "missing_deployment_id"
  | "not_resource_link_request"
  | "unsupported_lti_version";

export class LtiValidationError extends Error {
  constructor(public reason: LtiRejectReason, message: string) {
    super(message);
  }
}

export interface LtiLaunchClaims {
  sub: string;
  email: string | null;
  name: string | null;
  deploymentId: string;
  contextExternalId: string | null;
  roles: string[];
}

/**
 * Verifies signature (via `getKey`), issuer, audience and expiry (jose
 * handles all four from `jwtVerify`'s options), then the LTI-specific
 * claims: nonce (anti-replay, matched against the value minted at login),
 * message type, version and the presence of a deployment_id. Never trusts
 * the token's own claim of validity — every check here is something a
 * forged or replayed token could otherwise fake.
 */
export async function verifyLtiLaunch(
  idToken: string,
  getKey: JWTVerifyGetKey,
  opts: { issuer: string; audience: string; expectedNonce: string },
): Promise<LtiLaunchClaims> {
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, getKey, {
      issuer: opts.issuer,
      audience: opts.audience,
    }));
  } catch (err) {
    throw new LtiValidationError("bad_signature_or_claims", `JWT verification failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (payload.nonce !== opts.expectedNonce) {
    throw new LtiValidationError("nonce_mismatch", "id_token nonce does not match the one issued at login");
  }
  if (payload[VERSION_CLAIM] !== "1.3.0") {
    throw new LtiValidationError("unsupported_lti_version", `Unsupported LTI version claim: ${String(payload[VERSION_CLAIM])}`);
  }
  if (payload[MESSAGE_TYPE_CLAIM] !== "LtiResourceLinkRequest") {
    throw new LtiValidationError("not_resource_link_request", `Unsupported message type: ${String(payload[MESSAGE_TYPE_CLAIM])}`);
  }
  const deploymentId = payload[DEPLOYMENT_ID_CLAIM];
  if (typeof deploymentId !== "string" || !deploymentId) {
    throw new LtiValidationError("missing_deployment_id", "id_token is missing the LTI deployment_id claim");
  }

  const context = payload[CONTEXT_CLAIM] as { id?: string } | undefined;
  const roles = Array.isArray(payload[ROLES_CLAIM]) ? (payload[ROLES_CLAIM] as string[]) : [];

  return {
    sub: String(payload.sub ?? ""),
    email: typeof payload.email === "string" ? payload.email : null,
    name: typeof payload.name === "string" ? payload.name : null,
    deploymentId,
    contextExternalId: context?.id ?? null,
    roles,
  };
}
