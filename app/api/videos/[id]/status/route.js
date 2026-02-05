export const runtime = "nodejs";

import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

async function getUserFromRequest(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user;
}

export async function GET(request, { params }) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
    }

    const user = await getUserFromRequest(request);
    const videoId = params.id;

    const { data: videoRow } = await supabaseAdmin
      .from("videos")
      .select("user_id")
      .eq("video_id", videoId)
      .maybeSingle();

    if (videoRow?.user_id && user?.id && videoRow.user_id !== user.id) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    const response = await fetch(`https://api.openai.com/v1/videos/${videoId}`, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });
    const data = await response.json();

    if (!response.ok) {
      return Response.json({ error: data }, { status: response.status });
    }

    if (user?.id) {
      await supabaseAdmin
        .from("videos")
        .update({ status: data.status })
        .eq("video_id", videoId)
        .eq("user_id", user.id);
    }

    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
