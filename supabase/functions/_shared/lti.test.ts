import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { SignJWT, generateKeyPair, type KeyLike } from "npm:jose@5";
import { LtiValidationError, verifyLtiLaunch } from "./lti.ts";

const ISSUER = "https://platform.example.test";
const AUDIENCE = "brivia-tool-client-id";
const NONCE = "test-nonce-abc123";
const DEPLOYMENT_ID = "deployment-1";

async function keypair() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  return { publicKey, privateKey };
}

function fixedKey(publicKey: KeyLike) {
  return () => Promise.resolve(publicKey);
}

function signValidToken(privateKey: KeyLike, overrides: Record<string, unknown> = {}) {
  return new SignJWT({
    sub: "user-42",
    email: "learner@example.test",
    name: "Ada Lovelace",
    nonce: NONCE,
    "https://purl.imsglobal.org/spec/lti/claim/deployment_id": DEPLOYMENT_ID,
    "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiResourceLinkRequest",
    "https://purl.imsglobal.org/spec/lti/claim/version": "1.3.0",
    "https://purl.imsglobal.org/spec/lti/claim/context": { id: "course-101" },
    "https://purl.imsglobal.org/spec/lti/claim/roles": ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"],
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

Deno.test("valid launch: accepted, claims extracted", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await signValidToken(privateKey);
  const claims = await verifyLtiLaunch(token, fixedKey(publicKey), { issuer: ISSUER, audience: AUDIENCE, expectedNonce: NONCE });
  assertEquals(claims.sub, "user-42");
  assertEquals(claims.email, "learner@example.test");
  assertEquals(claims.deploymentId, DEPLOYMENT_ID);
  assertEquals(claims.contextExternalId, "course-101");
  assertEquals(claims.roles, ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"]);
  assertEquals(claims.messageType, "LtiResourceLinkRequest");
  assertEquals(claims.deepLinkingSettings, null);
});

// LTI-002: regression guard — the message-type gate must widen to accept
// LtiDeepLinkingRequest without weakening what it does for the existing
// resource-link path above (still exact-matched, still the only two
// accepted values).
Deno.test("valid Deep Linking request: accepted, deep_linking_settings extracted", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await signValidToken(privateKey, {
    "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiDeepLinkingRequest",
    "https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings": {
      deep_link_return_url: "https://platform.example.test/deep-link/return",
      accept_types: ["ltiResourceLink"],
      data: "platform-opaque-token-xyz",
    },
  });
  const claims = await verifyLtiLaunch(token, fixedKey(publicKey), { issuer: ISSUER, audience: AUDIENCE, expectedNonce: NONCE });
  assertEquals(claims.messageType, "LtiDeepLinkingRequest");
  assertEquals(claims.deepLinkingSettings?.deepLinkReturnUrl, "https://platform.example.test/deep-link/return");
  assertEquals(claims.deepLinkingSettings?.acceptTypes, ["ltiResourceLink"]);
  assertEquals(claims.deepLinkingSettings?.data, "platform-opaque-token-xyz");
});

Deno.test("Deep Linking request without deep_linking_settings: rejected (not silently treated as a resource-link launch)", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await signValidToken(privateKey, {
    "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiDeepLinkingRequest",
  });
  const err = await assertRejects(
    () => verifyLtiLaunch(token, fixedKey(publicKey), { issuer: ISSUER, audience: AUDIENCE, expectedNonce: NONCE }),
    LtiValidationError,
  );
  assertEquals((err as LtiValidationError).reason, "missing_deep_linking_settings");
});

Deno.test("Deep Linking request with deep_linking_settings but no deep_link_return_url: rejected", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await signValidToken(privateKey, {
    "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiDeepLinkingRequest",
    "https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings": { accept_types: ["ltiResourceLink"] },
  });
  const err = await assertRejects(
    () => verifyLtiLaunch(token, fixedKey(publicKey), { issuer: ISSUER, audience: AUDIENCE, expectedNonce: NONCE }),
    LtiValidationError,
  );
  assertEquals((err as LtiValidationError).reason, "missing_deep_linking_settings");
});

Deno.test("expired token: rejected", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await new SignJWT({
    sub: "user-42",
    nonce: NONCE,
    "https://purl.imsglobal.org/spec/lti/claim/deployment_id": DEPLOYMENT_ID,
    "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiResourceLinkRequest",
    "https://purl.imsglobal.org/spec/lti/claim/version": "1.3.0",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
    .sign(privateKey);

  const err = await assertRejects(
    () => verifyLtiLaunch(token, fixedKey(publicKey), { issuer: ISSUER, audience: AUDIENCE, expectedNonce: NONCE }),
    LtiValidationError,
  );
  assertEquals((err as LtiValidationError).reason, "bad_signature_or_claims");
});

Deno.test("wrong issuer: rejected", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await signValidToken(privateKey);
  const err = await assertRejects(
    () => verifyLtiLaunch(token, fixedKey(publicKey), { issuer: "https://not-the-real-platform.test", audience: AUDIENCE, expectedNonce: NONCE }),
    LtiValidationError,
  );
  assertEquals((err as LtiValidationError).reason, "bad_signature_or_claims");
});

Deno.test("wrong audience: rejected", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await signValidToken(privateKey);
  const err = await assertRejects(
    () => verifyLtiLaunch(token, fixedKey(publicKey), { issuer: ISSUER, audience: "some-other-client-id", expectedNonce: NONCE }),
    LtiValidationError,
  );
  assertEquals((err as LtiValidationError).reason, "bad_signature_or_claims");
});

Deno.test("wrong nonce (replay from a different login): rejected", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await signValidToken(privateKey);
  const err = await assertRejects(
    () => verifyLtiLaunch(token, fixedKey(publicKey), { issuer: ISSUER, audience: AUDIENCE, expectedNonce: "a-different-nonce" }),
    LtiValidationError,
  );
  assertEquals((err as LtiValidationError).reason, "nonce_mismatch");
});

Deno.test("signed by the wrong key: rejected", async () => {
  const { privateKey } = await keypair();
  const attacker = await keypair();
  const token = await signValidToken(privateKey);
  const err = await assertRejects(
    () => verifyLtiLaunch(token, fixedKey(attacker.publicKey), { issuer: ISSUER, audience: AUDIENCE, expectedNonce: NONCE }),
    LtiValidationError,
  );
  assertEquals((err as LtiValidationError).reason, "bad_signature_or_claims");
});

Deno.test("missing deployment_id: rejected", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await signValidToken(privateKey, { "https://purl.imsglobal.org/spec/lti/claim/deployment_id": undefined });
  const err = await assertRejects(
    () => verifyLtiLaunch(token, fixedKey(publicKey), { issuer: ISSUER, audience: AUDIENCE, expectedNonce: NONCE }),
    LtiValidationError,
  );
  assertEquals((err as LtiValidationError).reason, "missing_deployment_id");
});

Deno.test("wrong message type (e.g. a Deep Linking response, not a core launch): rejected", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await signValidToken(privateKey, { "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiDeepLinkingResponse" });
  const err = await assertRejects(
    () => verifyLtiLaunch(token, fixedKey(publicKey), { issuer: ISSUER, audience: AUDIENCE, expectedNonce: NONCE }),
    LtiValidationError,
  );
  assertEquals((err as LtiValidationError).reason, "not_resource_link_request");
});

Deno.test("unsupported LTI version: rejected", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await signValidToken(privateKey, { "https://purl.imsglobal.org/spec/lti/claim/version": "1.1.0" });
  const err = await assertRejects(
    () => verifyLtiLaunch(token, fixedKey(publicKey), { issuer: ISSUER, audience: AUDIENCE, expectedNonce: NONCE }),
    LtiValidationError,
  );
  assertEquals((err as LtiValidationError).reason, "unsupported_lti_version");
});

Deno.test("replaying the exact same valid token twice: both verify (replay defense is the state row's single-use delete, done by the caller, not this function)", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await signValidToken(privateKey);
  const first = await verifyLtiLaunch(token, fixedKey(publicKey), { issuer: ISSUER, audience: AUDIENCE, expectedNonce: NONCE });
  const second = await verifyLtiLaunch(token, fixedKey(publicKey), { issuer: ISSUER, audience: AUDIENCE, expectedNonce: NONCE });
  assertEquals(first.sub, second.sub);
});

// LTI-004 (AGS): resource_link + AGS endpoint claim extraction.
Deno.test("resource_link and AGS endpoint claims: extracted when present", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await signValidToken(privateKey, {
    "https://purl.imsglobal.org/spec/lti/claim/resource_link": { id: "link-77", title: "Chapitre 3" },
    "https://purl.imsglobal.org/spec/lti-ags/claim/endpoint": {
      scope: [
        "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
        "https://purl.imsglobal.org/spec/lti-ags/scope/score",
      ],
      lineitem: "https://platform.example.test/ags/lineitems/1",
      lineitems: "https://platform.example.test/ags/lineitems",
    },
  });
  const claims = await verifyLtiLaunch(token, fixedKey(publicKey), { issuer: ISSUER, audience: AUDIENCE, expectedNonce: NONCE });
  assertEquals(claims.resourceLinkId, "link-77");
  assertEquals(claims.resourceLinkTitle, "Chapitre 3");
  assertEquals(claims.agsEndpoint?.scopes, [
    "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
    "https://purl.imsglobal.org/spec/lti-ags/scope/score",
  ]);
  assertEquals(claims.agsEndpoint?.lineItemUrl, "https://platform.example.test/ags/lineitems/1");
  assertEquals(claims.agsEndpoint?.lineItemsUrl, "https://platform.example.test/ags/lineitems");
});

Deno.test("no AGS endpoint claim: agsEndpoint is null, not an empty-but-present object (grading not enabled for this placement is a real, valid state)", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await signValidToken(privateKey);
  const claims = await verifyLtiLaunch(token, fixedKey(publicKey), { issuer: ISSUER, audience: AUDIENCE, expectedNonce: NONCE });
  assertEquals(claims.agsEndpoint, null);
  assertEquals(claims.resourceLinkId, null);
});
