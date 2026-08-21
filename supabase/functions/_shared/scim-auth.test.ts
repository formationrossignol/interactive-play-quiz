import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { hasScimScope, verifyScimBearerToken } from "./scim-auth.ts";

function fakeReq(authHeader: string | null): Request {
  const headers = new Headers();
  if (authHeader !== null) headers.set("Authorization", authHeader);
  return new Request("https://x.test/scim-users", { headers });
}

// A minimal stand-in for the pieces verifyScimBearerToken actually calls —
// real crypto.subtle.digest runs for real (this test does not mock hashing
// itself), only the DB round-trip is stubbed, so this proves the hashing +
// header-parsing logic end to end, not just wiring.
function fakeSupabase(expectedHash: string | null, row: { client_id: string; org_id: string; scopes: string[] } | null) {
  let rpcCalled = false;
  return {
    client: {
      rpc: (fn: string, args: { p_token_hash: string }) => {
        rpcCalled = true;
        assertEquals(fn, "_verify_api_token");
        if (expectedHash !== null) assertEquals(args.p_token_hash, expectedHash);
        return Promise.resolve({ data: row ? [row] : [], error: null });
      },
      // deno-lint-ignore no-explicit-any
    } as any,
    wasRpcCalled: () => rpcCalled,
  };
}

Deno.test("missing Authorization header: rejected without ever calling the DB", async () => {
  const { client, wasRpcCalled } = fakeSupabase(null, null);
  const ctx = await verifyScimBearerToken(fakeReq(null), client);
  assertEquals(ctx, null);
  assertEquals(wasRpcCalled(), false);
});

Deno.test("malformed Authorization header (not 'Bearer <token>'): rejected without calling the DB", async () => {
  const { client, wasRpcCalled } = fakeSupabase(null, null);
  const ctx = await verifyScimBearerToken(fakeReq("Basic dXNlcjpwYXNz"), client);
  assertEquals(ctx, null);
  assertEquals(wasRpcCalled(), false);
});

Deno.test("valid bearer token: resolved to its client/org/scopes context", async () => {
  const { client } = fakeSupabase(null, { client_id: "c1", org_id: "o1", scopes: ["users:read"] });
  const ctx = await verifyScimBearerToken(fakeReq("Bearer test-token-abc123"), client);
  assertEquals(ctx?.clientId, "c1");
  assertEquals(ctx?.orgId, "o1");
  assertEquals(ctx?.scopes, ["users:read"]);
});

Deno.test("hash cross-check: verifyScimBearerToken hashes the raw token with real SHA-256, matching an independently computed digest", async () => {
  const token = "test-token-abc123";
  const independentDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const independentHex = Array.from(new Uint8Array(independentDigest)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const { client } = fakeSupabase(independentHex, { client_id: "c1", org_id: "o1", scopes: [] });
  const ctx = await verifyScimBearerToken(fakeReq(`Bearer ${token}`), client);
  assertEquals(ctx?.clientId, "c1");
});

Deno.test("unknown/expired/revoked token (RPC returns no row): rejected", async () => {
  const { client } = fakeSupabase(null, null);
  const ctx = await verifyScimBearerToken(fakeReq("Bearer whatever"), client);
  assertEquals(ctx, null);
});

Deno.test("hasScimScope: exact scope match", () => {
  assertEquals(hasScimScope({ clientId: "c", orgId: "o", scopes: ["users:read"] }, "users:read"), true);
  assertEquals(hasScimScope({ clientId: "c", orgId: "o", scopes: ["users:read"] }, "users:write"), false);
});

Deno.test("hasScimScope: wildcard scope grants everything", () => {
  assertEquals(hasScimScope({ clientId: "c", orgId: "o", scopes: ["*"] }, "anything:at-all"), true);
});
