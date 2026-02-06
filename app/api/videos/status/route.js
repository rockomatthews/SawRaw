import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import ffmpegPath from "ffmpeg-static";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const BUCKET = "continuity-videos";

async function retrieveVideo(videoId) {
  const response = await fetch(`https://api.openai.com/v1/videos/${videoId}`, {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    }
  });
  const data = await response.json();
  return { response, data };
}

async function downloadVideoContent(videoId) {
  const response = await fetch(
    `https://api.openai.com/v1/videos/${videoId}/content`,
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      }
    }
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to download video content");
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function resolveWatermarkFile() {
  if (process.env.WATERMARK_IMAGE_URL) {
    const response = await fetch(process.env.WATERMARK_IMAGE_URL);
    if (!response.ok) {
      throw new Error("Failed to download watermark image");
    }
    const arrayBuffer = await response.arrayBuffer();
    const filePath = path.join("/tmp", "watermark.png");
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));
    return filePath;
  }

  throw new Error("WATERMARK_IMAGE_URL is not set");
}

async function applyWatermark(inputPath, outputPath) {
  const watermarkPath = await resolveWatermarkFile();
  const args = [
    "-y",
    "-i",
    inputPath,
    "-i",
    watermarkPath,
    "-filter_complex",
    "overlay=W-w-24:H-h-24",
    "-codec:a",
    "copy",
    "-codec:v",
    "libx264",
    "-preset",
    "veryfast",
    outputPath
  ];

  await execFileAsync(ffmpegPath, args);
}

async function uploadToSupabase(filePath, key) {
  const fileBuffer = await fs.readFile(filePath);
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(key, fileBuffer, {
      upsert: true,
      contentType: "video/mp4",
      cacheControl: "3600"
    });

  if (error) {
    throw new Error(error.message || "Failed to upload video");
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(key);
  return data.publicUrl;
}

export async function GET(request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OPENAI_API_KEY is not set" },
      { status: 500 }
    );
  }

  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("id");

  if (!videoId) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const { data: job } = await supabaseAdmin
    .from("video_jobs")
    .select("*")
    .eq("video_id", videoId)
    .maybeSingle();

  if (job && job.user_id && user?.id !== job.user_id) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { response, data } = await retrieveVideo(videoId);
  if (!response.ok) {
    return Response.json({ error: data }, { status: response.status });
  }

  const status = data.status;
  if (status !== "completed") {
    if (job) {
      await supabaseAdmin
        .from("video_jobs")
        .update({ status })
        .eq("video_id", videoId);
    }
    return Response.json({ id: videoId, status });
  }

  if (job?.output_url) {
    return Response.json({
      id: videoId,
      status: "completed",
      output_url: job.output_url
    });
  }

  const tempInput = path.join("/tmp", `${videoId}-input.mp4`);
  const tempOutput = path.join("/tmp", `${videoId}-output.mp4`);
  const content = await downloadVideoContent(videoId);
  await fs.writeFile(tempInput, content);

  let outputPath = tempInput;
  const watermarkRequired = job ? job.watermark_required : true;
  if (watermarkRequired) {
    await applyWatermark(tempInput, tempOutput);
    outputPath = tempOutput;
  }

  const ownerPath = job?.user_id ? job.user_id : "anon";
  const key = `${ownerPath}/${videoId}.mp4`;
  const publicUrl = await uploadToSupabase(outputPath, key);

  await supabaseAdmin
    .from("video_jobs")
    .update({
      status: "completed",
      output_url: publicUrl
    })
    .eq("video_id", videoId);

  return Response.json({
    id: videoId,
    status: "completed",
    output_url: publicUrl
  });
}
