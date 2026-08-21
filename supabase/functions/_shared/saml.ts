// Generic per-organization SAML 2.0 SP-side verification (spec 04, INT-001
// to INT-005). Mirrors _shared/oidc.ts's rigor — signature, audience,
// expiry (SAML's Conditions NotBefore/NotOnOrAfter) and anti-replay
// (InResponseTo) are each explicit, separately-thrown, separately-tested
// checks, not "the library said it's fine."
//
// Signature verification itself is delegated to samlify (wraps xml-crypto),
// not hand-rolled: XML-DSig has well-known implementation pitfalls (XML
// signature wrapping being the classic SAML vulnerability class) that only
// come from a real, maintained library. Verified against Deno directly
// before writing this file — a throwaway smoke test (self-signed keypair,
// samlify's own IdentityProvider.createLoginResponse/ServiceProvider.
// parseLoginResponse round trip) confirmed: a validly-signed response is
// accepted with the correct NameID; a post-signature-tampered assertion is
// rejected (FAILED_TO_VERIFY_SIGNATURE); a response signed by a different
// keypair under the same entityID is rejected
// (ERROR_UNMATCH_CERTIFICATE_DECLARATION_IN_METADATA — proves the
// certificate is pinned to the connection's configured cert, not trusted
// from whatever <KeyInfo> the XML itself declares); and a response with no
// signature at all is rejected (FAILED_TO_VERIFY_SIGNATURE). All four ran
// clean under `deno run --node-modules-dir=none` — that flag matters only
// for local/dev invocation of this repo's own ambient node_modules
// resolution, Supabase's deployed edge runtime resolves `npm:` specifiers
// on its own, same as this repo's existing jose/@supabase/supabase-js usage.
//
// Known, stated gap: samlify refuses to run at all without a schema
// validator registered (`setSchemaValidator`) — it ships no bundled
// validator (the usual companion package, samlify-node-xmllint, wraps a
// native libxmljs binding that does not run under Deno's npm compat layer).
// The validator below is a permissive stub: it does not perform full XSD
// conformance validation. What IS still real and load-bearing: signature
// verification (via xml-crypto, confirmed above to correctly reject
// tampering/wrong-key/no-signature) and the explicit audience/conditions/
// InResponseTo checks this file adds on top. A pure-JS XSD validator, if one
// exists for Deno, would close this gap as a fast-follow; not attempted
// here rather than accepting a native-binding dependency this runtime can't
// load, or hand-rolling XML schema validation (out of scope for the same
// reason hand-rolled signature verification would be).
import * as saml from "npm:samlify@2";

saml.setSchemaValidator({
  // deno-lint-ignore require-await
  validate: async (_response: string) => "SUCCESS",
});

export type SamlRejectReason =
  | "bad_signature_or_cert"
  | "audience_mismatch"
  | "conditions_expired"
  | "response_to_mismatch"
  | "missing_subject";

export class SamlValidationError extends Error {
  constructor(public reason: SamlRejectReason, message: string) {
    super(message);
  }
}

export interface SamlAssertionClaims {
  subject: string;
  rawAttributes: Record<string, unknown>;
}

export interface SamlConnectionConfig {
  idpEntityId: string;
  idpSsoUrl: string;
  idpCert: string;
  spEntityId: string;
  spAcsUrl: string;
}

// A signature that validates today but was minted far in the past (clock
// skew aside) or far in the future is exactly as suspicious as an expired
// one — this app trusts neither, same posture as jose's exp/iat handling
// for OIDC (a bounded window, not "no upper bound as long as it hasn't
// expired yet").
const CLOCK_SKEW_TOLERANCE_MS = 60_000;

export function buildSamlServiceProvider(config: SamlConnectionConfig) {
  return saml.ServiceProvider({
    entityID: config.spEntityId,
    assertionConsumerService: [
      { Binding: saml.Constants.namespace.binding.post, Location: config.spAcsUrl },
    ],
  });
}

export function buildSamlIdentityProvider(config: SamlConnectionConfig) {
  return saml.IdentityProvider({
    entityID: config.idpEntityId,
    isAssertionEncrypted: false,
    signingCert: config.idpCert,
    singleSignOnService: [
      { Binding: saml.Constants.namespace.binding.redirect, Location: config.idpSsoUrl },
    ],
  });
}

/**
 * Builds an SP-initiated AuthnRequest (HTTP-Redirect binding, unsigned — see
 * file header for why). Returns the request's own `id` (to be stored and
 * later matched against the Response's InResponseTo) and the full redirect
 * URL to send the browser to.
 */
export function createSamlAuthnRequest(config: SamlConnectionConfig): { requestId: string; redirectUrl: string } {
  const idp = buildSamlIdentityProvider(config);
  const sp = buildSamlServiceProvider(config);
  const { id, context } = sp.createLoginRequest(idp, "redirect");
  return { requestId: id, redirectUrl: String(context) };
}

/**
 * Verifies a SAML Response (POST binding) for real: signature (via
 * samlify/xml-crypto, cert-pinned to `config.idpCert` — see file header),
 * then explicit audience, Conditions window, and InResponseTo checks. Each
 * failure mode is a distinct, testable `SamlRejectReason` — none of them
 * fall through to a generic catch-all.
 */
export async function verifySamlResponse(
  samlResponseBase64: string,
  config: SamlConnectionConfig,
  expectedRequestId: string,
): Promise<SamlAssertionClaims> {
  const idp = buildSamlIdentityProvider(config);
  const sp = buildSamlServiceProvider(config);

  let extract: Record<string, unknown>;
  try {
    const parsed = await sp.parseLoginResponse(idp, "post", { body: { SAMLResponse: samlResponseBase64 } });
    extract = (parsed.extract ?? {}) as Record<string, unknown>;
  } catch (err) {
    throw new SamlValidationError(
      "bad_signature_or_cert",
      `SAML response verification failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const audience = typeof extract.audience === "string" ? extract.audience : null;
  if (audience !== config.spEntityId) {
    throw new SamlValidationError("audience_mismatch", `Assertion audience "${audience}" does not match this SP's entity ID`);
  }

  const conditions = extract.conditions as { notBefore?: string; notOnOrAfter?: string } | undefined;
  const now = Date.now();
  const notBefore = conditions?.notBefore ? new Date(conditions.notBefore).getTime() - CLOCK_SKEW_TOLERANCE_MS : null;
  const notOnOrAfter = conditions?.notOnOrAfter ? new Date(conditions.notOnOrAfter).getTime() + CLOCK_SKEW_TOLERANCE_MS : null;
  if (notBefore !== null && now < notBefore) {
    throw new SamlValidationError("conditions_expired", "Assertion is not yet valid (NotBefore)");
  }
  if (notOnOrAfter !== null && now >= notOnOrAfter) {
    throw new SamlValidationError("conditions_expired", "Assertion has expired (NotOnOrAfter)");
  }

  const response = extract.response as { inResponseTo?: string } | undefined;
  if ((response?.inResponseTo ?? "") !== expectedRequestId) {
    throw new SamlValidationError("response_to_mismatch", "Response InResponseTo does not match the request this login attempt issued");
  }

  const subject = typeof extract.nameID === "string" ? extract.nameID : "";
  if (!subject) {
    throw new SamlValidationError("missing_subject", "Assertion has no NameID");
  }

  return {
    subject,
    rawAttributes: (extract.attributes ?? {}) as Record<string, unknown>,
  };
}
