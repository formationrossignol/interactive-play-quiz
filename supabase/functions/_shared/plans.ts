// Deno-side mirror of apps/app/src/lib/plans.ts's exam-relevant constants.
// Small and rarely-changing enough that duplicating rather than sharing a
// module across the app/functions runtime boundary (npm vs Deno resolution)
// is the pragmatic choice — keep the two in sync by hand if either changes.
export type Plan = "starter" | "pro" | "entreprise";

export const EXAM_CAP: Record<Plan, number | null> = {
  starter: 5,
  pro: null,
  entreprise: null,
};

export const AUDIENCE_CAP: Record<Plan, number | null> = {
  starter: 20,
  pro: 200,
  entreprise: null,
};

export function normalizePlan(plan: unknown): Plan {
  return plan === "pro" || plan === "entreprise" ? plan : "starter";
}
