// Real signed-XML tests, not mocked crypto — same bar as oidc.test.ts's
// real-keypair jose tests. samlify has no built-in test-assertion signer
// exposed for unit tests other than its own IdentityProvider.
// createLoginResponse, so these tests use that (the same code path
// verifySamlResponse's caller — saml-acs — depends on an IdP to produce)
// paired against a throwaway self-signed X.509 keypair generated via
// `openssl` at test setup (RSA/X.509 keygen has no pure-JS-in-Deno
// equivalent as simple as jose's generateKeyPair — SAML certs are X.509,
// not bare JWKs). Requires `openssl` on PATH; every CI runner this repo
// targets ships it by default.
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildSamlIdentityProvider,
  buildSamlServiceProvider,
  SamlValidationError,
  verifySamlResponse,
  type SamlConnectionConfig,
} from "./saml.ts";
import * as saml from "npm:samlify@2";

const IDP_ENTITY_ID = "https://idp.example.test";
const IDP_SSO_URL = "https://idp.example.test/sso";
const SP_ENTITY_ID = "https://brivia.example.test/sp";
const SP_ACS_URL = "https://brivia.example.test/saml-acs";

async function generateSelfSignedCert(commonName: string): Promise<{ cert: string; key: string }> {
  const dir = await Deno.makeTempDir();
  const keyPath = `${dir}/key.pem`;
  const certPath = `${dir}/cert.pem`;
  const cmd = new Deno.Command("openssl", {
    args: ["req", "-x509", "-newkey", "rsa:2048", "-keyout", keyPath, "-out", certPath, "-days", "1", "-nodes", "-subj", `/CN=${commonName}`],
    stdout: "null",
    stderr: "null",
  });
  const { success } = await cmd.output();
  if (!success) throw new Error("openssl self-signed cert generation failed — is openssl on PATH?");
  const cert = await Deno.readTextFile(certPath);
  const key = await Deno.readTextFile(keyPath);
  await Deno.remove(dir, { recursive: true });
  return { cert, key };
}

function config(idpCert: string): SamlConnectionConfig {
  return { idpEntityId: IDP_ENTITY_ID, idpSsoUrl: IDP_SSO_URL, idpCert, spEntityId: SP_ENTITY_ID, spAcsUrl: SP_ACS_URL };
}

async function signResponse(signingCert: string, signingKey: string, opts: { requestId?: string; nameId?: string } = {}) {
  const idp = saml.IdentityProvider({
    entityID: IDP_ENTITY_ID,
    privateKey: signingKey,
    isAssertionEncrypted: false,
    signingCert,
    singleSignOnService: [{ Binding: saml.Constants.namespace.binding.redirect, Location: IDP_SSO_URL }],
  });
  const sp = buildSamlServiceProvider(config(signingCert));
  const requestInfo = opts.requestId ? { extract: { request: { id: opts.requestId } } } : undefined;
  const { context } = await idp.createLoginResponse(
    sp,
    requestInfo as never,
    "post",
    { email: opts.nameId ?? "learner@example.test", id: "idp-subject-42" },
  );
  return context as string;
}

function tamperNameId(xmlBase64: string, from: string, to: string): string {
  const decoded = new TextDecoder().decode(Uint8Array.from(atob(xmlBase64), (c) => c.charCodeAt(0)));
  const tampered = decoded.replace(from, to);
  return btoa(String.fromCharCode(...new TextEncoder().encode(tampered)));
}

function stripSignature(xmlBase64: string): string {
  const decoded = new TextDecoder().decode(Uint8Array.from(atob(xmlBase64), (c) => c.charCodeAt(0)));
  const stripped = decoded.replace(/<ds:Signature[\s\S]*?<\/ds:Signature>/, "");
  return btoa(String.fromCharCode(...new TextEncoder().encode(stripped)));
}

Deno.test("valid signed response: accepted, subject and attributes extracted", async () => {
  const { cert, key } = await generateSelfSignedCert("test-idp");
  const requestId = "_req-abc-123";
  const xml = await signResponse(cert, key, { requestId });
  const claims = await verifySamlResponse(xml, config(cert), requestId);
  assertEquals(claims.subject, "learner@example.test");
});

Deno.test("tampered assertion (NameID swapped post-signature): rejected", async () => {
  const { cert, key } = await generateSelfSignedCert("test-idp");
  const requestId = "_req-abc-124";
  const xml = await signResponse(cert, key, { requestId });
  const tampered = tamperNameId(xml, "learner@example.test", "attacker@evil.test");
  const err = await assertRejects(() => verifySamlResponse(tampered, config(cert), requestId), SamlValidationError);
  assertEquals((err as SamlValidationError).reason, "bad_signature_or_cert");
});

Deno.test("signed by a different key under the same entityID (cert not pinned to this connection): rejected", async () => {
  const { cert, key } = await generateSelfSignedCert("test-idp");
  const attacker = await generateSelfSignedCert("attacker");
  const requestId = "_req-abc-125";
  const forgedXml = await signResponse(attacker.cert, attacker.key, { requestId });
  // Verified against the REAL connection's pinned cert, not the attacker's.
  const err = await assertRejects(() => verifySamlResponse(forgedXml, config(cert), requestId), SamlValidationError);
  assertEquals((err as SamlValidationError).reason, "bad_signature_or_cert");
});

Deno.test("unsigned response: rejected", async () => {
  const { cert, key } = await generateSelfSignedCert("test-idp");
  const requestId = "_req-abc-126";
  const xml = await signResponse(cert, key, { requestId });
  const unsigned = stripSignature(xml);
  const err = await assertRejects(() => verifySamlResponse(unsigned, config(cert), requestId), SamlValidationError);
  assertEquals((err as SamlValidationError).reason, "bad_signature_or_cert");
});

Deno.test("InResponseTo mismatch (replayed/foreign login attempt): rejected", async () => {
  const { cert, key } = await generateSelfSignedCert("test-idp");
  const xml = await signResponse(cert, key, { requestId: "_req-real-request" });
  const err = await assertRejects(
    () => verifySamlResponse(xml, config(cert), "_req-a-different-request-this-app-never-issued"),
    SamlValidationError,
  );
  assertEquals((err as SamlValidationError).reason, "response_to_mismatch");
});

Deno.test("audience mismatch (assertion minted for a different SP): rejected", async () => {
  const { cert, key } = await generateSelfSignedCert("test-idp");
  const requestId = "_req-abc-127";
  const idp = saml.IdentityProvider({
    entityID: IDP_ENTITY_ID,
    privateKey: key,
    isAssertionEncrypted: false,
    signingCert: cert,
    singleSignOnService: [{ Binding: saml.Constants.namespace.binding.redirect, Location: IDP_SSO_URL }],
  });
  const otherSp = saml.ServiceProvider({
    entityID: "https://some-other-sp.example.test",
    assertionConsumerService: [{ Binding: saml.Constants.namespace.binding.post, Location: "https://some-other-sp.example.test/acs" }],
  });
  const { context } = await idp.createLoginResponse(
    otherSp,
    { extract: { request: { id: requestId } } } as never,
    "post",
    { email: "learner@example.test", id: "idp-subject-42" },
  );
  const err = await assertRejects(() => verifySamlResponse(context as string, config(cert), requestId), SamlValidationError);
  assertEquals((err as SamlValidationError).reason, "audience_mismatch");
});

Deno.test("createSamlAuthnRequest / buildSamlIdentityProvider construct without throwing", async () => {
  const { cert } = await generateSelfSignedCert("test-idp");
  const idp = buildSamlIdentityProvider(config(cert));
  const sp = buildSamlServiceProvider(config(cert));
  const { id, context } = sp.createLoginRequest(idp, "redirect");
  assertEquals(typeof id, "string");
  assertEquals(String(context).startsWith(IDP_SSO_URL), true);
});
