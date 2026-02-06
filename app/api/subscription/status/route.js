import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ active: false });
  }

  const { data } = await supabase
    .from("subscriptions")
    .select("status,current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  const now = Date.now();
  const active =
    data &&
    (data.status === "active" || data.status === "trialing") &&
    (!data.current_period_end || new Date(data.current_period_end).getTime() > now);

  return Response.json({ active: Boolean(active) });
}
