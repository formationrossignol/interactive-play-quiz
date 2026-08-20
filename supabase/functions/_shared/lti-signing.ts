// LTI 1.3 Advantage — outbound signing primitives (foundation for Deep
// Linking LTI-002 and AGS/NRPS LTI-004/LTI-003, none of which are built
// here — this file only provides the two things every one of them needs
// underneath: signing this tool's own JWTs, and exchanging a signed
// client-assertion for a platform access token via client_credentials).
//
// Everything up to this point in the codebase only ever *verified* incoming
// JWTs (`_shared/lti.ts`, `_shared/oidc.ts` — both `jwtVerify`, never
// `SignJWT` outside test fixtures). This is the first production use of
// this tool acting as a JWT *issuer* instead of a relying party — the
// reverse trust direction, so treated with the same rigor as the
// verification side: pure functions, no hidden DB/network access baked in
// (the caller supplies the private key and, for the token-fetch helper,
// does the actual fetch/parsing here but nothing implicit), unit-testable
// with an in-memory keypair (see lti-signing.test.ts).
import { SignJWT, type KeyLike } from "npm:jose@5";

/**
 * Signs an arbitrary claims payload with this tool's own private key,
 * stamping `kid` in the protected header so the platform's key lookup
 * (against the JWKS this tool publishes per registration, see
 * get_lti_tool_jwks()) can find the right public key even across a
 * rotation where multiple keys are simultaneously active. `iat`/`jti` are
 * always set here (never left to the caller) — every signed JWT this tool
 * issues needs a fresh issued-at and a unique id, whether it's a Deep
 * Linking response or a client assertion; a caller forgetting either would
 * be a real bug, not a style choice, so it's not optional.
 */
export async function signLtiJwt(
  claims: Record<string, unknown>,
  privateKey: KeyLike,
  kid: string,
  opts: { expiresIn?: string } = {},
): Promise<string> {
  return await new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime(opts.expiresIn ?? "5m")
    .sign(privateKey);
}

export type LtiServiceTokenErrorReason = "token_request_failed" | "no_access_token_in_response";

export class LtiServiceTokenError extends Error {
  constructor(public reason: LtiServiceTokenErrorReason, message: string) {
    super(message);
  }
}

/**
 * IMS Security Framework's private_key_jwt client_credentials grant: proves
 * this tool controls the private key matching the JWKS the platform admin
 * configured for this registration, without ever sending the key itself —
 * the platform verifies the assertion's signature against that JWKS on its
 * own. `clientId` is this registration's client_id *at that platform*
 * (`lti_registrations.client_id`, assigned by the platform when the org's
 * admin registered this tool there — same value used for LTI Core launch
 * audience checks, reused here as both `iss` and `sub` of the assertion per
 * spec). `scope` is space-separated (AGS/NRPS each need their own specific
 * scope string — this function doesn't know or care which, that's the next
 * task's job).
 */
export async function fetchLtiServiceToken(opts: {
  tokenEndpoint: string;
  clientId: string;
  privateKey: KeyLike;
  kid: string;
  scope: string;
}): Promise<string> {
  const assertion = await signLtiJwt(
    {
      iss: opts.clientId,
      sub: opts.clientId,
      aud: opts.tokenEndpoint,
    },
    opts.privateKey,
    opts.kid,
  );

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
    scope: opts.scope,
  });

  const resp = await fetch(opts.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) {
    throw new LtiServiceTokenError("token_request_failed", `Platform token endpoint returned ${resp.status}`);
  }
  const json = await resp.json().catch(() => null) as { access_token?: unknown } | null;
  if (!json || typeof json.access_token !== "string" || !json.access_token) {
    throw new LtiServiceTokenError("no_access_token_in_response", "Platform token response had no access_token");
  }
  return json.access_token;
}
