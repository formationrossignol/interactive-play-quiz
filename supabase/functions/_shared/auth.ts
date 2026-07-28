// verify_jwt = true (the default for every function in config.toml except
// stripe-webhook) means the platform gateway has already validated the
// Authorization bearer token's signature and expiry before our code ever
// runs — so decoding the JWT payload here to read `sub` is safe and avoids
// an extra network round-trip to GoTrue that `auth.getUser()` would cost.
export function getCallerUserId(req: Request): string | null {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length);
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/").padEnd(parts[1].length + ((4 - (parts[1].length % 4)) % 4), "="));
    const payload = JSON.parse(payloadJson) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
