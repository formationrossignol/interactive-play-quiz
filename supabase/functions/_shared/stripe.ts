import Stripe from "npm:stripe@17";

let cachedCryptoProvider:
  | ReturnType<typeof Stripe.createSubtleCryptoProvider>
  | null = null;

export function getStripeClient(): Stripe {
  return new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

// Signature verification needs async SubtleCrypto in Deno (Stripe's
// default constructEvent verifier uses Node's sync crypto, unavailable
// here) — see stripe-webhook/index.ts's use of constructEventAsync.
export function getStripeCryptoProvider() {
  if (!cachedCryptoProvider) {
    cachedCryptoProvider = Stripe.createSubtleCryptoProvider();
  }
  return cachedCryptoProvider;
}
