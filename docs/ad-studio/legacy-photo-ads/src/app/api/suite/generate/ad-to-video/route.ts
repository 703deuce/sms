import { NextRequest, NextResponse } from "next/server";
import { requireSuiteAdmin } from "@/lib/suite-auth";
import { isKieConfigured, generateSora2ImageToVideo, generateSora2ProImageToVideo, generateKlingImageToVideo } from "@/lib/kie";
import { isOpenAISoraConfigured, generateOpenAISoraImageToVideo } from "@/marketing-suite/lib/openai-sora";
import { supabase, isSupabaseConfigured, getSupabaseAdmin } from "@/lib/supabase/client";

const BUCKET = "creatives";

/**
 * POST /api/generate/ad-to-video
 * Body: { imageUrl: string; model?: "sora-2" | "sora-2-pro" | "kling-3" | "openai-sora-2"; duration?: "10" | "15"; prompt?: string; aspect_ratio?: "portrait" | "landscape" }
 * Turns a generated ad image into a video. Kie: Sora 2, Sora 2 Pro, Kling 3. OpenAI: Sora 2 direct (8s or 12s).
 */
export async function POST(request: NextRequest) {
  const _suite = await requireSuiteAdmin(request);
  if (!_suite.ok) return _suite.response;
  const suiteUserId = _suite.uid;
const body = await request.json().catch(() => ({}));
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  const modelRaw = body.model;
  const model =
    modelRaw === "openai-sora-2" ? "openai-sora-2"
    : modelRaw === "kling-3" ? "kling-3"
    : modelRaw === "sora-2-pro" ? "sora-2-pro"
    : "sora-2";
  const duration = body.duration === "15" ? "15" : "10";
  const noText = body.noText !== false; // default true: no on-screen text
  let prompt =
    typeof body.prompt === "string" && body.prompt.trim()
      ? body.prompt.trim().slice(0, 2000)
      : "Smooth, subtle motion. Professional broadcast ad aesthetic. Cinematic, Gentle movement that brings the scene to life.";
  if (noText) {
    prompt = `${prompt} No text, titles, or captions in the video. No on-screen text.`;
  }
  // Sora generates in-video speech; instruct it to finish talking well before the end so audio is never cut off
  const speechEndInstruction =
    duration === "15"
      ? "All spoken dialogue or narration in this video must be complete by 10 seconds. No speech or talking after 10 seconds; only visuals and silence until the end."
      : "All spoken dialogue or narration in this video must be complete by 5 seconds. No speech or talking after 5 seconds; only visuals and silence until the end.";
  prompt = `${prompt} ${speechEndInstruction}`;
  const aspectRatioBody = body.aspect_ratio === "portrait" ? "portrait" : "landscape";

  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
  }

  if (model === "openai-sora-2") {
    if (!isOpenAISoraConfigured()) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set. Set it in .env.local for OpenAI Sora." },
        { status: 503 }
      );
    }
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Supabase is not configured. Required to store the generated video." },
        { status: 503 }
      );
    }
    try {
      const videoBuffer = await generateOpenAISoraImageToVideo(imageUrl, prompt, {
        aspect_ratio: aspectRatioBody,
        duration,
        model: "sora-2",
      });
      const storagePath = `${suiteUserId}/${Date.now()}-ad-to-video-openai-sora.mp4`;
      const uploadOptions = { contentType: "video/mp4" as const, upsert: false as const };
      const admin = getSupabaseAdmin();
      const uploadClient = admin ?? supabase;
      let uploadResult = await uploadClient.storage.from(BUCKET).upload(storagePath, videoBuffer, uploadOptions);
      const err = uploadResult.error as { statusCode?: string; message?: string } | undefined;
      const isBucketMissing = err && (err.statusCode === "404" || err.message?.includes("Bucket not found"));
      if (uploadResult.error && isBucketMissing) {
        const clientForCreate = admin ?? supabase;
        await clientForCreate.storage.createBucket(BUCKET, { public: true });
        uploadResult = await uploadClient.storage.from(BUCKET).upload(storagePath, videoBuffer, uploadOptions);
      }
      const { data, error } = uploadResult;
      if (error) {
        return NextResponse.json({ error: `Upload failed: ${(error as { message?: string }).message ?? error}` }, { status: 502 });
      }
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
      return NextResponse.json({ ok: true, videoUrl: urlData.publicUrl });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "OpenAI Sora generation failed";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  if (!isKieConfigured()) {
    return NextResponse.json(
      { error: "KIE_API_KEY is not set. Set it in .env.local for Kie models." },
      { status: 503 }
    );
  }

  try {
    let videoUrl: string;
    if (model === "kling-3") {
      const klingAspect = aspectRatioBody === "portrait" ? "9:16" : "16:9";
      videoUrl = await generateKlingImageToVideo(imageUrl, prompt, {
        duration: "10",
        mode: "pro",
        aspect_ratio: klingAspect,
        sound: false,
      });
    } else if (model === "sora-2-pro") {
      videoUrl = await generateSora2ProImageToVideo(imageUrl, prompt, {
        n_frames: duration === "15" ? "15" : "10",
        aspect_ratio: aspectRatioBody,
        size: "standard",
      });
    } else {
      videoUrl = await generateSora2ImageToVideo(imageUrl, prompt, {
        n_frames: duration,
        aspect_ratio: aspectRatioBody,
      });
    }
    return NextResponse.json({ ok: true, videoUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ad-to-video generation failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
