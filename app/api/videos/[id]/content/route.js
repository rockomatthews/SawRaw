export const runtime = "nodejs";

import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

async function getUserFromRequest(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user;
}

async function isSubscribed(userId) {
  if (!userId) return false;
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return false;
  if (["active", "trialing"].includes(data.status)) return true;
  if (data.current_period_end && new Date(data.current_period_end) > new Date()) {
    return true;
  }
  return false;
}

function runWatermark(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const draw = "drawtext=text='Continuity Studio':fontcolor=white@0.6:fontsize=28:x=w-tw-24:y=h-th-24:box=1:boxcolor=black@0.35:boxborderw=12";
    const args = [
      "-y",
      "-i",
      inputPath,
      "-vf",
      draw,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-c:a",
      "copy",
      outputPath
    ];

    const ffmpeg = spawn(ffmpegPath, args);
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
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

    const subscribed = await isSubscribed(user?.id);

    const response = await fetch(
      `https://api.openai.com/v1/videos/${videoId}/content`,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    if (!response.ok) {
      const data = await response.json();
      return Response.json({ error: data }, { status: response.status });
    }

    const tempDir = "/tmp";
    const inputPath = path.join(tempDir, `${videoId}-source.mp4`);
    const outputPath = path.join(tempDir, `${videoId}-watermarked.mp4`);

    await pipeline(response.body, fs.createWriteStream(inputPath));

    if (!subscribed) {
      await runWatermark(inputPath, outputPath);
      const watermarkedStream = fs.createReadStream(outputPath);
      return new Response(watermarkedStream, {
        headers: {
          "Content-Type": "video/mp4",
          "Cache-Control": "no-store"
        }
      });
    }

    const cleanStream = fs.createReadStream(inputPath);
    return new Response(cleanStream, {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
