import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { planForSubscriptionStatus } from "./billing.ts";

Deno.test("active/trialing/past_due map to pro (grace period on payment failure)", () => {
  assertEquals(planForSubscriptionStatus("active"), "pro");
  assertEquals(planForSubscriptionStatus("trialing"), "pro");
  assertEquals(planForSubscriptionStatus("past_due"), "pro");
});

Deno.test("canceled/unpaid map to starter", () => {
  assertEquals(planForSubscriptionStatus("canceled"), "starter");
  assertEquals(planForSubscriptionStatus("unpaid"), "starter");
});

Deno.test("unrecognized status defaults to starter", () => {
  assertEquals(planForSubscriptionStatus("incomplete_expired"), "starter");
});
