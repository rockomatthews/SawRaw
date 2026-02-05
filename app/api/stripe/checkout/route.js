export const runtime = "nodejs";

import Stripe from "stripe";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20"
});

async function getUserFromRequest(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user;
}

export async function POST(request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
      return Response.json(
        { error: "Stripe env vars are not set" },
        { status: 500 }
      );
    }

    const user = await getUserFromRequest(request);
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const origin = request.headers.get("origin") || process.env.APP_URL;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
      customer_email: user.email || undefined,
      metadata: { user_id: user.id }
    });

    return Response.json({ url: session.url });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
