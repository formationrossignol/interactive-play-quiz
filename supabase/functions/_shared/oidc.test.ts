import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { SignJWT, generateKeyPair, type KeyLike } from "npm:jose@5";
import { OidcValidationError, verifyOidcIdToken } from "./oidc.ts";

const ISSUER = "https://idp.example.test";
const AUDIENCE = "brivia-oidc-client-id";
const NONCE = "test-nonce-xyz789";

async function keypair() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  return { publicKey, privateKey };
}

function fixedKey(publicKey: KeyLike) {
  return () => Promise.resolve(publicKey);
}

function signValidToken(privateKey: KeyLike, overrides: Record<string, unknown> = {}) {
  return new SignJWT({
    sub: "idp-subject-42",
    email: "learner@example.test",
    name: "Ada Lovelace",
    groups: ["staff", "lms-admin"],
    nonce: NONCE,
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

Deno.test("valid id_token: accepted, claims extracted including raw attributes for mapping", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await signValidToken(privateKey);
  const claims = await verifyOidcIdToken(token, fixedKey(publicKey), { issuer: ISSUER, audience: AUDIENCE, expectedNonce: NONCE });
  assertEquals(claims.sub, "idp-subject-42");
  assertEquals(claims.email, "learner@example.test");
  assertEquals(claims.name, "Ada Lovelace");
  assertEquals(claims.rawAttributes.groups, ["staff", "lms-admin"]);
});

Deno.test("expired token: rejected", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await new SignJWT({ sub: "idp-subject-42", nonce: NONCE })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
    .sign(privateKey);

  const err = await assertRejects(
    () => verifyOidcIdToken(token, fixedKey(publicKey), { issuer: ISSUER, audience: AUDIENCE, expectedNonce: NONCE }),
    OidcValidationError,
  );
  assertEquals((err as OidcValidationError).reason, "bad_signature_or_claims");
});

Deno.test("wrong issuer: rejected", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await signValidToken(privateKey);
  const err = await assertRejects(
    () => verifyOidcIdToken(token, fixedKey(publicKey), { issuer: "https://not-the-real-idp.test", audience: AUDIENCE, expectedNonce: NONCE }),
    OidcValidationError,
  );
  assertEquals((err as OidcValidationError).reason, "bad_signature_or_claims");
});

Deno.test("wrong audience (id_token minted for a different client): rejected", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await signValidToken(privateKey);
  const err = await assertRejects(
    () => verifyOidcIdToken(token, fixedKey(publicKey), { issuer: ISSUER, audience: "some-other-client-id", expectedNonce: NONCE }),
    OidcValidationError,
  );
  assertEquals((err as OidcValidationError).reason, "bad_signature_or_claims");
});

Deno.test("wrong nonce (replay from a different login attempt): rejected", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await signValidToken(privateKey);
  const err = await assertRejects(
    () => verifyOidcIdToken(token, fixedKey(publicKey), { issuer: ISSUER, audience: AUDIENCE, expectedNonce: "a-different-nonce" }),
    OidcValidationError,
  );
  assertEquals((err as OidcValidationError).reason, "nonce_mismatch");
});

Deno.test("signed by the wrong key (not actually the IdP): rejected", async () => {
  const { privateKey } = await keypair();
  const attacker = await keypair();
  const token = await signValidToken(privateKey);
  const err = await assertRejects(
    () => verifyOidcIdToken(token, fixedKey(attacker.publicKey), { issuer: ISSUER, audience: AUDIENCE, expectedNonce: NONCE }),
    OidcValidationError,
  );
  assertEquals((err as OidcValidationError).reason, "bad_signature_or_claims");
});

Deno.test("missing sub claim: rejected", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await signValidToken(privateKey, { sub: undefined });
  const err = await assertRejects(
    () => verifyOidcIdToken(token, fixedKey(publicKey), { issuer: ISSUER, audience: AUDIENCE, expectedNonce: NONCE }),
    OidcValidationError,
  );
  assertEquals((err as OidcValidationError).reason, "missing_subject");
});
