import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { getStripeClient } from "../_shared/stripe.ts";

// Monthly-equivalent factor per Stripe recurring interval, so a mix of
// monthly/yearly/weekly subscriptions still sums into one comparable MRR
// figure instead of silently under/over-counting non-monthly plans.
const MONTHLY_FACTOR: Record<string, number> = {
  day: 30,
  week: 4.345,
  month: 1,
  year: 1 / 12,
};

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: callerProfile, error: callerError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();
    if (callerError || callerProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Not an admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Plan distribution + total account count come straight from our own
    // DB — cheap and always in sync. Only the € revenue figure needs a live
    // Stripe read, since profiles doesn't store subscription amounts.
    const { data: planCounts, error: profilesError } = await supabaseAdmin
      .rpc("_admin_profile_plan_counts_service");
    if (profilesError) throw profilesError;
    const planBreakdown = { starter: 0, pro: 0, entreprise: 0 } as Record<string, number>;
    let totalUsers = 0;
    for (const row of planCounts ?? []) {
      const plan = (row as { plan?: string }).plan ?? "starter";
      const count = Number((row as { user_count?: number | string }).user_count ?? 0);
      planBreakdown[plan] = count;
      totalUsers += count;
    }

    const stripe = getStripeClient();
    let mrrCents = 0;
    let currency = "eur";
    let activeSubscriptions = 0;
    let startingAfter: string | undefined;
    // Stripe caps list results at 100/page — walk every page so MRR isn't
    // silently truncated once the customer base outgrows one page.
    for (;;) {
      const page = await stripe.subscriptions.list({
        status: "active",
        limit: 100,
        starting_after: startingAfter,
        expand: ["data.items.data.price"],
      });
      for (const sub of page.data) {
        activeSubscriptions += 1;
        for (const item of sub.items.data) {
          const price = item.price;
          if (!price?.unit_amount || !price.recurring) continue;
          currency = price.currency;
          const factor = MONTHLY_FACTOR[price.recurring.interval] ?? 1;
          mrrCents += price.unit_amount * (item.quantity ?? 1) * factor / (price.recurring.interval_count || 1);
        }
      }
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data[page.data.length - 1].id;
    }

    return new Response(
      JSON.stringify({
        mrr: Math.round(mrrCents) / 100,
        currency,
        activeSubscriptions,
        totalUsers,
        planBreakdown,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[admin-revenue-summary] error:", err);
    return new Response(JSON.stringify({ error: "Failed to load revenue summary" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
