export const runtime = "nodejs";

import { supabaseAdmin } from "../../../lib/supabaseAdmin";

async function getUserFromRequest(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user;
}

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return Response.json({ active: false });
    }

    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    const active =
      data &&
      (["active", "trialing"].includes(data.status) ||
        (data.current_period_end &&
          new Date(data.current_period_end) > new Date()));

    return Response.json({ active: Boolean(active), status: data?.status || null });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
