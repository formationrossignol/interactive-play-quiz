// API-003 — webhook signing. HMAC-SHA256 via native Web Crypto (no new npm
// dependency — this runtime's crypto.subtle is already proven this session,
// see _shared/api-token-auth.ts's sha256Hex; pulling in an unverified npm
// hashing package for this would be an unnecessary risk this codebase's
// established discipline argues against). Signs `${timestamp}.${rawBody}`
// (Stripe/GitHub-style construction — signing the timestamp alongside the
// body, not the body alone, is what lets a receiver reject a replayed-but-
// still-validly-signed payload sent long after the fact by also enforcing a
// timestamp-freshness window on their own end). Delivered as two headers:
// `X-Brivia-Timestamp` (unix seconds, plain) and `X-Brivia-Signature`
// (`sha256=<hex>`), naming chosen to be unambiguous about which app/
// algorithm produced it rather than a bare unlabeled hex string.

export interface SignedWebhookHeaders {
  "X-Brivia-Timestamp": string;
  "X-Brivia-Signature": string;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toHex(mac);
}

/** Takes the secret as plaintext (already decrypted by the caller via
 *  _decrypt_webhook_secret, service_role only) and the exact raw body string
 *  that will be sent, so signature verification on the receiving end can
 *  never diverge from what was actually transmitted (signing a re-serialized
 *  object instead of the literal sent bytes is a classic webhook-signing
 *  bug — this function takes the string, not the object). */
export async function signWebhookPayload(rawBody: string, secret: string, timestamp: number = Math.floor(Date.now() / 1000)): Promise<SignedWebhookHeaders> {
  const signedContent = `${timestamp}.${rawBody}`;
  const signatureHex = await hmacSha256Hex(secret, signedContent);
  return {
    "X-Brivia-Timestamp": String(timestamp),
    "X-Brivia-Signature": `sha256=${signatureHex}`,
  };
}

/** For tests / a future receiver-side reference implementation — recomputes
 *  and compares in constant time. Not used by dispatch-webhooks itself
 *  (this app only ever signs, it doesn't receive its own webhooks), kept
 *  alongside the signer so the two can never drift into incompatible
 *  constructions. */
export async function verifyWebhookSignature(rawBody: string, secret: string, timestamp: string, signature: string): Promise<boolean> {
  const expected = (await signWebhookPayload(rawBody, secret, Number(timestamp)))["X-Brivia-Signature"];
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
