import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { signWebhookPayload, verifyWebhookSignature } from "./webhook-signing.ts";

const SECRET = "whsec_test_secret_do_not_use_in_prod";
const BODY = JSON.stringify({ id: "evt_1", event: "enrollment", data: { enrollment_id: "abc" } });

Deno.test("valid signature: verifies against the exact body/timestamp/secret it was signed with", async () => {
  const headers = await signWebhookPayload(BODY, SECRET, 1700000000);
  assertEquals(headers["X-Brivia-Timestamp"], "1700000000");
  assertEquals(headers["X-Brivia-Signature"].startsWith("sha256="), true);
  const ok = await verifyWebhookSignature(BODY, SECRET, headers["X-Brivia-Timestamp"], headers["X-Brivia-Signature"]);
  assertEquals(ok, true);
});

Deno.test("tampered body: signature no longer verifies", async () => {
  const headers = await signWebhookPayload(BODY, SECRET, 1700000000);
  const tamperedBody = JSON.stringify({ id: "evt_1", event: "enrollment", data: { enrollment_id: "someone-elses-id" } });
  const ok = await verifyWebhookSignature(tamperedBody, SECRET, headers["X-Brivia-Timestamp"], headers["X-Brivia-Signature"]);
  assertEquals(ok, false);
});

Deno.test("wrong secret: signature does not verify", async () => {
  const headers = await signWebhookPayload(BODY, SECRET, 1700000000);
  const ok = await verifyWebhookSignature(BODY, "a-different-secret", headers["X-Brivia-Timestamp"], headers["X-Brivia-Signature"]);
  assertEquals(ok, false);
});

Deno.test("tampered timestamp (replay with a shifted window): signature does not verify", async () => {
  const headers = await signWebhookPayload(BODY, SECRET, 1700000000);
  const ok = await verifyWebhookSignature(BODY, SECRET, "1700009999", headers["X-Brivia-Signature"]);
  assertEquals(ok, false);
});

Deno.test("same body, different timestamp: produces a different signature (timestamp is bound into the signed content, not decorative)", async () => {
  const a = await signWebhookPayload(BODY, SECRET, 1700000000);
  const b = await signWebhookPayload(BODY, SECRET, 1700000001);
  assertNotEquals(a["X-Brivia-Signature"], b["X-Brivia-Signature"]);
});

Deno.test("deterministic: identical inputs always produce the identical signature (real HMAC, not accidentally salted/randomized)", async () => {
  const a = await signWebhookPayload(BODY, SECRET, 1700000000);
  const b = await signWebhookPayload(BODY, SECRET, 1700000000);
  assertEquals(a["X-Brivia-Signature"], b["X-Brivia-Signature"]);
});
