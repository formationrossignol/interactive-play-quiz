import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { exportJWK, generateKeyPair, jwtVerify, type KeyLike } from "npm:jose@5";
import { fetchLtiServiceToken, LtiServiceTokenError, signLtiJwt } from "./lti-signing.ts";

async function keypair() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  return { publicKey, privateKey };
}

Deno.test("signLtiJwt: produces a JWT verifiable against the matching public key, with the requested kid and round-tripped claims", async () => {
  const { publicKey, privateKey } = await keypair();
  const token = await signLtiJwt({ iss: "brivia-client-id", sub: "brivia-client-id", aud: "https://platform.example.test/token" }, privateKey, "kid-v1");

  const { payload, protectedHeader } = await jwtVerify(token, publicKey);
  assertEquals(protectedHeader.kid, "kid-v1");
  assertEquals(protectedHeader.alg, "RS256");
  assertEquals(payload.iss, "brivia-client-id");
  assertEquals(payload.sub, "brivia-client-id");
  assertEquals(payload.aud, "https://platform.example.test/token");
  assertEquals(typeof payload.jti, "string");
  assertEquals(typeof payload.iat, "number");
  assertEquals(typeof payload.exp, "number");
});

Deno.test("signLtiJwt: two calls produce different jti (never reused, anti-replay on the platform's side depends on this)", async () => {
  const { privateKey } = await keypair();
  const a = await signLtiJwt({ iss: "x", sub: "x", aud: "y" }, privateKey, "kid-v1");
  const b = await signLtiJwt({ iss: "x", sub: "x", aud: "y" }, privateKey, "kid-v1");
  const { publicKey } = await keypair(); // unused directly; decode without verify instead
  void publicKey;
  const decode = (t: string) => JSON.parse(atob(t.split(".")[1]));
  assertEquals(decode(a).jti === decode(b).jti, false);
});

Deno.test("signLtiJwt: a token signed by a DIFFERENT key does not verify against this key's public half (proves this isn't a no-op)", async () => {
  const { privateKey } = await keypair();
  const attacker = await keypair();
  const token = await signLtiJwt({ iss: "x", sub: "x", aud: "y" }, privateKey, "kid-v1");
  await assertRejects(() => jwtVerify(token, attacker.publicKey));
});

Deno.test("fetchLtiServiceToken: sends a well-formed client_credentials + private_key_jwt request and returns the access_token on success", async () => {
  const { publicKey, privateKey } = await keypair();
  const jwk = await exportJWK(publicKey);

  let capturedBody: URLSearchParams | null = null;
  const server = Deno.serve({ port: 0 }, async (req) => {
    capturedBody = new URLSearchParams(await req.text());
    return new Response(JSON.stringify({ access_token: "svc-token-abc123" }), { headers: { "Content-Type": "application/json" } });
  });
  const port = (server.addr as Deno.NetAddr).port;
  const tokenEndpoint = `http://127.0.0.1:${port}/token`;

  try {
    const token = await fetchLtiServiceToken({
      tokenEndpoint,
      clientId: "brivia-client-id",
      privateKey,
      kid: "kid-v1",
      scope: "https://purl.imsglobal.org/spec/lti-ags/scope/score",
    });
    assertEquals(token, "svc-token-abc123");

    assertEquals(capturedBody!.get("grant_type"), "client_credentials");
    assertEquals(capturedBody!.get("client_assertion_type"), "urn:ietf:params:oauth:client-assertion-type:jwt-bearer");
    assertEquals(capturedBody!.get("scope"), "https://purl.imsglobal.org/spec/lti-ags/scope/score");

    const assertion = capturedBody!.get("client_assertion")!;
    const { payload, protectedHeader } = await jwtVerify(assertion, publicKey);
    assertEquals(protectedHeader.kid, "kid-v1");
    assertEquals(payload.iss, "brivia-client-id");
    assertEquals(payload.sub, "brivia-client-id");
    assertEquals(payload.aud, tokenEndpoint);
    void jwk;
  } finally {
    await server.shutdown();
  }
});

Deno.test("fetchLtiServiceToken: platform returning non-2xx is rejected with token_request_failed, not silently swallowed", async () => {
  const { privateKey } = await keypair();
  const server = Deno.serve({ port: 0 }, () => new Response("nope", { status: 401 }));
  const port = (server.addr as Deno.NetAddr).port;
  try {
    const err = await assertRejects(
      () => fetchLtiServiceToken({ tokenEndpoint: `http://127.0.0.1:${port}/token`, clientId: "x", privateKey, kid: "kid-v1", scope: "s" }),
      LtiServiceTokenError,
    );
    assertEquals((err as LtiServiceTokenError).reason, "token_request_failed");
  } finally {
    await server.shutdown();
  }
});

Deno.test("fetchLtiServiceToken: a 200 response missing access_token is rejected with no_access_token_in_response, not returned as undefined", async () => {
  const { privateKey } = await keypair();
  const server = Deno.serve({ port: 0 }, () => new Response(JSON.stringify({ token_type: "Bearer" }), { headers: { "Content-Type": "application/json" } }));
  const port = (server.addr as Deno.NetAddr).port;
  try {
    const err = await assertRejects(
      () => fetchLtiServiceToken({ tokenEndpoint: `http://127.0.0.1:${port}/token`, clientId: "x", privateKey, kid: "kid-v1", scope: "s" }),
      LtiServiceTokenError,
    );
    assertEquals((err as LtiServiceTokenError).reason, "no_access_token_in_response");
  } finally {
    await server.shutdown();
  }
});
