import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { getStripeClient } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Not authenticated" }, 401);

    const payload = await req.json().catch(() => ({})) as { quizId?: string };
    if (!payload.quizId) return json({ error: "quizId is required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: content, error: contentError } = await admin
      .from("content")
      .select("id,user_id,source_id,data,is_public")
      .eq("type", "quiz")
      .eq("source_id", payload.quizId)
      .eq("is_public", true)
      .maybeSingle();
    if (contentError || !content) return json({ error: "Public quiz not found" }, 404);
    if (content.user_id === userData.user.id) return json({ error: "Owners already have access" }, 400);

    const quiz = content.data as {
      title?: string;
      monetization?: { enabled?: boolean; priceCents?: number; currency?: string };
    };
    const amount = Math.round(Number(quiz.monetization?.priceCents ?? 0));
    if (!quiz.monetization?.enabled || amount < 100) return json({ error: "Quiz is not monetized" }, 400);

    const { data: previous } = await admin
      .from("quiz_purchases")
      .select("status")
      .eq("quiz_id", payload.quizId)
      .eq("buyer_user_id", userData.user.id)
      .maybeSingle();
    if (previous?.status === "paid") return json({ alreadyPurchased: true, url: `${req.headers.get("origin") ?? "https://brivia.app"}/public/quiz/${payload.quizId}` });

    const origin = req.headers.get("origin") ?? Deno.env.get("APP_ORIGIN") ?? "https://brivia.app";
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: userData.user.email,
      line_items: [{
        price_data: {
          currency: "eur",
          unit_amount: amount,
          product_data: { name: quiz.title || "Quiz Brivia", metadata: { quiz_id: payload.quizId } },
        },
        quantity: 1,
      }],
      success_url: `${origin}/public/quiz/${payload.quizId}?purchase=success`,
      cancel_url: `${origin}/public/quiz/${payload.quizId}?purchase=cancelled`,
      metadata: {
        kind: "quiz_purchase",
        quiz_id: payload.quizId,
        content_id: content.id,
        creator_user_id: content.user_id,
        buyer_user_id: userData.user.id,
      },
    });

    const { error: purchaseError } = await admin.from("quiz_purchases").upsert({
      quiz_id: payload.quizId,
      content_id: content.id,
      creator_user_id: content.user_id,
      buyer_user_id: userData.user.id,
      amount_cents: amount,
      currency: "eur",
      stripe_checkout_session_id: session.id,
      status: "pending",
    }, { onConflict: "quiz_id,buyer_user_id" });
    if (purchaseError) throw purchaseError;

    return json({ url: session.url });
  } catch (error) {
    console.error("[create-quiz-purchase-session]", error);
    return json({ error: "Failed to create quiz checkout" }, 500);
  }
});
