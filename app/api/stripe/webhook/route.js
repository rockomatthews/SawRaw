export const runtime = "nodejs";

import Stripe from "stripe";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20"
});

async function upsertSubscription({ userId, status, periodEnd, customerId }) {
  if (!userId) return;
  await supabaseAdmin.from("subscriptions").upsert({
    user_id: userId,
    status,
    current_period_end: periodEnd,
    stripe_customer_id: customerId
  });
}

export async function POST(request) {
  try {
    const signature = request.headers.get("stripe-signature");
    const rawBody = await request.text();

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return Response.json(
        { error: "STRIPE_WEBHOOK_SECRET not set" },
        { status: 500 }
      );
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return Response.json({ error: err.message }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const customerId = session.customer;
      await upsertSubscription({
        userId,
        status: "active",
        periodEnd: null,
        customerId
      });
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.created"
    ) {
      const subscription = event.data.object;
      await upsertSubscription({
        userId: subscription.metadata?.user_id,
        status: subscription.status,
        periodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        customerId: subscription.customer
      });
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      await upsertSubscription({
        userId: subscription.metadata?.user_id,
        status: "canceled",
        periodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        customerId: subscription.customer
      });
    }

    return Response.json({ received: true });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
