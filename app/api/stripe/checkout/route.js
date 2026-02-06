import { stripe } from "@/lib/stripe";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!process.env.STRIPE_PRICE_ID) {
    return Response.json(
      { error: "STRIPE_PRICE_ID is not set" },
      { status: 500 }
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${siteUrl}?checkout=success`,
    cancel_url: `${siteUrl}?checkout=cancel`,
    customer_email: user.email,
    metadata: {
      user_id: user.id
    }
  });

  return Response.json({ url: session.url });
}
