import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { headers } from "next/headers";

export const runtime = "nodejs";

export async function POST(request) {
  const sig = headers().get("stripe-signature");
  const body = await request.text();

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json(
      { error: "STRIPE_WEBHOOK_SECRET is not set" },
      { status: 500 }
    );
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.user_id;
    if (userId) {
      await supabaseAdmin.from("subscriptions").upsert({
        user_id: userId,
        status: "active",
        price_id: session.metadata?.price_id || null,
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        current_period_end: session.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : null
      });
    }
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object;
    const status = subscription.status;
    const customerId = subscription.customer;
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;

    await supabaseAdmin
      .from("subscriptions")
      .update({
        status,
        stripe_subscription_id: subscription.id,
        current_period_end: currentPeriodEnd,
        price_id: subscription.items?.data?.[0]?.price?.id || null
      })
      .eq("stripe_customer_id", customerId);
  }

  return Response.json({ received: true });
}
