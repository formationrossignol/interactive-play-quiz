import { supabase } from "@/lib/supabase";

export async function hasPurchasedQuiz(quizId: string, userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("quiz_purchases")
    .select("id", { count: "exact", head: true })
    .eq("quiz_id", quizId)
    .eq("buyer_user_id", userId)
    .eq("status", "paid");
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Checkout redirects can beat the Stripe webhook by a few seconds. Poll the
 *  authoritative purchase row instead of flashing a paid-but-still-locked UI. */
export async function waitForQuizPurchase(quizId: string, userId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await hasPurchasedQuiz(quizId, userId)) return true;
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
  return false;
}

export async function startQuizPurchase(quizId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("create-quiz-purchase-session", {
    body: { quizId },
  });
  if (error || !data?.url) throw new Error("Impossible de préparer le paiement.");
  window.location.href = String(data.url);
}
