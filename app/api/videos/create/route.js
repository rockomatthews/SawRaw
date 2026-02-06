import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const ALLOWED_SIZES = new Set(["1280x720", "720x1280"]);
const ALLOWED_SECONDS = new Set(["4", "8", "12"]);

async function isSubscriber(supabase, userId) {
  if (!userId) return false;
  const { data } = await supabase
    .from("subscriptions")
    .select("status,current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return false;
  const now = Date.now();
  return (
    (data.status === "active" || data.status === "trialing") &&
    (!data.current_period_end ||
      new Date(data.current_period_end).getTime() > now)
  );
}

function validateInput({ prompt, size, seconds }) {
  if (!process.env.OPENAI_API_KEY) {
    return "OPENAI_API_KEY is not set";
  }
  if (!prompt || typeof prompt !== "string") {
    return "prompt is required";
  }
  if (!ALLOWED_SIZES.has(size)) {
    return "size must be 1280x720 or 720x1280";
  }
  if (!ALLOWED_SECONDS.has(String(seconds))) {
    return "seconds must be 4, 8, or 12";
  }
  return null;
}

async function createVideo({ prompt, size, seconds, inputReference }) {
  const form = new FormData();
  form.append("model", "sora-2");
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("seconds", String(seconds));
  if (inputReference) {
    form.append("input_reference", inputReference);
  }

  const response = await fetch("https://api.openai.com/v1/videos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: form
  });

  const data = await response.json();
  return { response, data };
}

export async function POST(request) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const userId = user?.id || null;

  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const prompt = form.get("prompt");
      const size = form.get("size") || "1280x720";
      const seconds = form.get("seconds") || "4";
      const inputReferenceUrl = form.get("input_reference_url");
      const inputReferenceFile = form.get("input_reference_file");
      const inputReference = inputReferenceFile || inputReferenceUrl;

      const error = validateInput({ prompt, size, seconds });
      if (error) {
        return Response.json({ error }, { status: 400 });
      }

      const { response, data } = await createVideo({
        prompt,
        size,
        seconds,
        inputReference
      });

      if (!response.ok) {
        return Response.json({ error: data }, { status: response.status });
      }

      const subscriber = await isSubscriber(supabase, userId);
      const watermarkRequired = !subscriber;

      await supabaseAdmin.from("video_jobs").insert({
        video_id: data.id,
        user_id: userId,
        status: data.status,
        prompt,
        size,
        seconds: String(seconds),
        watermark_required: watermarkRequired
      });

      return Response.json({
        id: data.id,
        status: data.status,
        watermark_required: watermarkRequired
      });
    }

    const body = await request.json();
    const {
      prompt,
      size = "1280x720",
      seconds = "4",
      input_reference_url
    } = body || {};

    const error = validateInput({ prompt, size, seconds });
    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    const { response, data } = await createVideo({
      prompt,
      size,
      seconds,
      inputReference: input_reference_url
    });

    if (!response.ok) {
      return Response.json({ error: data }, { status: response.status });
    }

    const subscriber = await isSubscriber(supabase, userId);
    const watermarkRequired = !subscriber;

    await supabaseAdmin.from("video_jobs").insert({
      video_id: data.id,
      user_id: userId,
      status: data.status,
      prompt,
      size,
      seconds: String(seconds),
      watermark_required: watermarkRequired
    });

    return Response.json({
      id: data.id,
      status: data.status,
      watermark_required: watermarkRequired
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
