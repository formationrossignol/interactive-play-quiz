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
const DEEP_LINKING_SETTINGS_CLAIM = "https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings";
// LTI-004 (AGS): the resource_link claim identifies *this specific placed
// link* (stable across every relaunch of it — the anchor lti_resource_links
// keys on), distinct from context (the course) and deployment_id (shared by
// every link in one platform install). The AGS endpoint claim is whatever
// the platform decided to grant for *this* link+launch — scopes, and
// optionally a ready-made lineitem URL or a lineitems collection URL. Both
// are extracted-if-present, never required: a launch with no AGS claim at
// all (grading not enabled for this placement) is still a perfectly valid
// resource-link launch.
const RESOURCE_LINK_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/resource_link";
const AGS_ENDPOINT_CLAIM = "https://purl.imsglobal.org/spec/lti-ags/claim/endpoint";

// LTI-002: a launch is either a normal resource-link launch or a
// Deep Linking request — both are legitimate *incoming* launches this tool
// must accept. Nothing else is: in particular `LtiDeepLinkingResponse` (the
// message type *this* tool sends back, never receives) must stay rejected —
// accepting it would mean trusting a platform to "launch" this tool with a
// message shape whose whole purpose is to originate from the tool itself.
const ACCEPTED_MESSAGE_TYPES = new Set(["LtiResourceLinkRequest", "LtiDeepLinkingRequest"]);

export type LtiRejectReason =
  | "bad_signature_or_claims"
  | "nonce_mismatch"
  | "missing_deployment_id"
  | "not_resource_link_request"
  | "unsupported_lti_version"
  | "missing_deep_linking_settings";

export class LtiValidationError extends Error {
  constructor(public reason: LtiRejectReason, message: string) {
    super(message);
  }
}

export interface LtiDeepLinkingSettings {
  deepLinkReturnUrl: string;
  acceptTypes: string[];
  data: string | null;
}

export interface LtiAgsEndpoint {
  scopes: string[];
  lineItemUrl: string | null;
  lineItemsUrl: string | null;
}

export interface LtiLaunchClaims {
  sub: string;
  email: string | null;
  name: string | null;
  deploymentId: string;
  contextExternalId: string | null;
  roles: string[];
  messageType: "LtiResourceLinkRequest" | "LtiDeepLinkingRequest";
  deepLinkingSettings: LtiDeepLinkingSettings | null;
  resourceLinkId: string | null;
  resourceLinkTitle: string | null;
  agsEndpoint: LtiAgsEndpoint | null;
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
  const messageType = payload[MESSAGE_TYPE_CLAIM];
  if (typeof messageType !== "string" || !ACCEPTED_MESSAGE_TYPES.has(messageType)) {
    throw new LtiValidationError("not_resource_link_request", `Unsupported message type: ${String(messageType)}`);
  }
  const deploymentId = payload[DEPLOYMENT_ID_CLAIM];
  if (typeof deploymentId !== "string" || !deploymentId) {
    throw new LtiValidationError("missing_deployment_id", "id_token is missing the LTI deployment_id claim");
  }

  let deepLinkingSettings: LtiDeepLinkingSettings | null = null;
  if (messageType === "LtiDeepLinkingRequest") {
    const raw = payload[DEEP_LINKING_SETTINGS_CLAIM] as
      | { deep_link_return_url?: unknown; accept_types?: unknown; data?: unknown }
      | undefined;
    if (!raw || typeof raw.deep_link_return_url !== "string" || !raw.deep_link_return_url) {
      throw new LtiValidationError(
        "missing_deep_linking_settings",
        "LtiDeepLinkingRequest is missing a usable deep_linking_settings claim (no deep_link_return_url)",
      );
    }
    deepLinkingSettings = {
      deepLinkReturnUrl: raw.deep_link_return_url,
      acceptTypes: Array.isArray(raw.accept_types) ? raw.accept_types.filter((t): t is string => typeof t === "string") : [],
      // `data` must be echoed back verbatim in the response if the platform
      // sent one — never invent a replacement, never drop it silently.
      data: typeof raw.data === "string" ? raw.data : null,
    };
  }

  const context = payload[CONTEXT_CLAIM] as { id?: string } | undefined;
  const roles = Array.isArray(payload[ROLES_CLAIM]) ? (payload[ROLES_CLAIM] as string[]) : [];

  const resourceLink = payload[RESOURCE_LINK_CLAIM] as { id?: unknown; title?: unknown } | undefined;
  const resourceLinkId = typeof resourceLink?.id === "string" ? resourceLink.id : null;
  const resourceLinkTitle = typeof resourceLink?.title === "string" ? resourceLink.title : null;

  const rawAgs = payload[AGS_ENDPOINT_CLAIM] as
    | { scope?: unknown; lineitem?: unknown; lineitems?: unknown }
    | undefined;
  const agsEndpoint: LtiAgsEndpoint | null = rawAgs
    ? {
        scopes: Array.isArray(rawAgs.scope) ? rawAgs.scope.filter((s): s is string => typeof s === "string") : [],
        lineItemUrl: typeof rawAgs.lineitem === "string" ? rawAgs.lineitem : null,
        lineItemsUrl: typeof rawAgs.lineitems === "string" ? rawAgs.lineitems : null,
      }
    : null;

  return {
    sub: String(payload.sub ?? ""),
    email: typeof payload.email === "string" ? payload.email : null,
    name: typeof payload.name === "string" ? payload.name : null,
    deploymentId,
    contextExternalId: context?.id ?? null,
    roles,
    messageType: messageType as "LtiResourceLinkRequest" | "LtiDeepLinkingRequest",
    deepLinkingSettings,
    resourceLinkId,
    resourceLinkTitle,
    agsEndpoint,
  };
}
