export type BillingPlan = "starter" | "pro";

// Stripe subscription statuses that still grant Pro access. "past_due"
// stays in this list deliberately — a payment retry in progress is not
// treated as a downgrade (see spec: grace period on payment failure).
const PRO_STATUSES = new Set(["active", "trialing", "past_due"]);

export function planForSubscriptionStatus(status: string): BillingPlan {
  return PRO_STATUSES.has(status) ? "pro" : "starter";
}
