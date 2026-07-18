import { createClient } from "npm:@supabase/supabase-js@2";
import { getStripeClient, getStripeCryptoProvider } from "../_shared/stripe.ts";
import { planForSubscriptionStatus } from "../_shared/billing.ts";

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), { status: 400 });
  }

  const body = await req.text();
  const stripe = getStripeClient();

  let event;
  try {
    // constructEventAsync (not constructEvent): Deno has no Node crypto,
    // so verification must go through the SubtleCrypto provider.
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
      undefined,
      getStripeCryptoProvider()
    );
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as { customer: string; subscription: string };
        const { data, error } = await supabaseAdmin
          .from("profiles")
          .update({
            stripe_subscription_id: session.subscription,
            plan: "pro",
            subscription_status: "active",
          })
          .eq("stripe_customer_id", session.customer)
          .select("id");
        if (error) {
          console.error("[stripe-webhook] checkout.session.completed update failed:", error);
          return new Response(JSON.stringify({ error: "Database update failed" }), { status: 500 });
        }
        if (data.length === 0) {
          console.warn(
            "[stripe-webhook] checkout.session.completed: no profile row matched stripe_customer_id=" +
              session.customer
          );
        }
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as { id: string; status: string };
        const { data, error } = await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: subscription.status,
            plan: planForSubscriptionStatus(subscription.status),
          })
          .eq("stripe_subscription_id", subscription.id)
          .select("id");
        if (error) {
          console.error("[stripe-webhook] customer.subscription.updated update failed:", error);
          return new Response(JSON.stringify({ error: "Database update failed" }), { status: 500 });
        }
        if (data.length === 0) {
          console.warn(
            "[stripe-webhook] customer.subscription.updated: no profile row matched stripe_subscription_id=" +
              subscription.id
          );
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as { id: string };
        const { data, error } = await supabaseAdmin
          .from("profiles")
          .update({ plan: "starter", subscription_status: "canceled" })
          .eq("stripe_subscription_id", subscription.id)
          .select("id");
        if (error) {
          console.error("[stripe-webhook] customer.subscription.deleted update failed:", error);
          return new Response(JSON.stringify({ error: "Database update failed" }), { status: 500 });
        }
        if (data.length === 0) {
          console.warn(
            "[stripe-webhook] customer.subscription.deleted: no profile row matched stripe_subscription_id=" +
              subscription.id
          );
        }
        break;
      }
      default:
        // Other event types (invoices, payment methods, etc.) are not
        // relevant to plan state — ignored, not an error.
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] handler error:", err);
    return new Response(JSON.stringify({ error: "Webhook handler failed" }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
