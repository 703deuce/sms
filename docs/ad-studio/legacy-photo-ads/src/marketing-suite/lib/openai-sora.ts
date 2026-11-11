/**
 * OpenAI Sora Videos API – image-to-video via OpenAI directly.
 * Set `OPENAI_API_KEY` in `.env` / Coolify (never commit). Use a **project** key from the API platform (`sk-proj-…`); legacy org keys (`sk-…`) still work.
 * Docs: https://platform.openai.com/docs/api-reference/videos
 * Image must match requested size (width x height); we resize with sharp.
 */

import { getOpenAiApiKeyFromEnv } from "@/lib/openai-api-key";

const OPENAI_BASE = "https://api.openai.com/v1";
const LOG_PREFIX = "[OpenAI Sora]";

export function isOpenAISoraConfigured(): boolean {
  return Boolean(getOpenAiApiKeyFromEnv());
}

function getApiKey(): string {
  const key = getOpenAiApiKeyFromEnv();
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return key;
}

/** OpenAI supports 4, 8, 12 seconds. We map 10 -> 8, 15 -> 12. */
export type OpenAISoraSeconds = "4" | "8" | "12";

/** Size: 720x1280 (portrait), 1280x720 (landscape), etc. */
export type OpenAISoraSize = "720x1280" | "1280x720" | "1024x1792" | "1792x1024";

export type OpenAISoraOptions = {
  model?: "sora-2" | "sora-2-pro";
  seconds?: OpenAISoraSeconds;
  size?: OpenAISoraSize;
};

function mapAspectToSize(aspect: "portrait" | "landscape"): OpenAISoraSize {
  return aspect === "portrait" ? "720x1280" : "1280x720";
}

function mapDurationToSeconds(duration: "10" | "15"): OpenAISoraSeconds {
  return duration === "15" ? "12" : "8";
}

/** Parse "1280x720" -> { width: 1280, height: 720 }. */
function parseSize(size: OpenAISoraSize): { width: number; height: number } {
  const [w, h] = size.split("x").map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h)) throw new Error(`Invalid size: ${size}`);
  return { width: w, height: h };
}

/** Result of resize: buffer and MIME type for the resized image. */
async function resizeImageToSize(
  imageBuffer: Buffer,
  size: OpenAISoraSize,
  contentType: string
): Promise<{ buffer: Buffer; mime: string; ext: string }> {
  const { width, height } = parseSize(size);
  const sharp = (await import("sharp")).default;
  const format = contentType.includes("png") ? "png" : "jpeg";
  const resized = await sharp(imageBuffer)
    .resize(width, height, { fit: "cover", position: "center" })
    .toFormat(format, format === "jpeg" ? { quality: 90 } : {})
    .toBuffer();
  const mime = format === "png" ? "image/png" : "image/jpeg";
  const ext = format;
  console.log(`${LOG_PREFIX} Resized image to ${width}x${height}, output length: ${resized.length}, format: ${format}`);
  return { buffer: resized, mime, ext };
}

/**
 * Create a video job (image-to-video). Returns video id.
 * Image is fetched, resized to match requested size, then sent as input_reference.
 */
export async function createOpenAISoraVideo(
  imageUrl: string,
  prompt: string,
  options: OpenAISoraOptions = {}
): Promise<string> {
  const model = options.model ?? "sora-2";
  const seconds = options.seconds ?? "8";
  const size = options.size ?? "1280x720";

  console.log(`${LOG_PREFIX} Create request: imageUrl=${imageUrl.slice(0, 80)}..., model=${model}, size=${size}, seconds=${seconds}, promptLength=${prompt.length}`);

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) throw new Error(`Failed to fetch image: ${imageRes.status}`);
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
  const contentType = imageRes.headers.get("content-type") ?? "image/png";

  const { buffer: resizedBuffer, mime, ext } = await resizeImageToSize(imageBuffer, size, contentType);

  const form = new FormData();
  form.append("prompt", prompt.slice(0, 4000));
  form.append("model", model);
  form.append("size", size);
  form.append("seconds", seconds);
  form.append(
    "input_reference",
    new Blob([new Uint8Array(resizedBuffer)], { type: mime }),
    `image.${ext}`
  );

  const res = await fetch(`${OPENAI_BASE}/videos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getApiKey()}` },
    body: form,
  });

  const responseText = await res.text();
  if (!res.ok) {
    console.error(`${LOG_PREFIX} Create failed: ${res.status}`, responseText);
    throw new Error(`OpenAI Sora create: ${res.status} ${responseText}`);
  }

  const data = JSON.parse(responseText) as { id?: string; status?: string; error?: { message?: string } };
  const id = data.id;
  if (!id) throw new Error(`OpenAI Sora: no id in response ${responseText}`);
  console.log(`${LOG_PREFIX} Create success: videoId=${id}, status=${data.status ?? "n/a"}`);
  return id;
}

/**
 * Poll video status until completed or failed. Returns final status.
 */
export async function getOpenAISoraVideoStatus(videoId: string): Promise<{ status: string; error?: string }> {
  const res = await fetch(`${OPENAI_BASE}/videos/${videoId}`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });
  if (!res.ok) {
    console.error(`${LOG_PREFIX} Status failed: ${res.status}`, await res.text());
    throw new Error(`OpenAI Sora status: ${res.status}`);
  }
  const data = (await res.json()) as { status?: string; progress?: number; error?: { message?: string } };
  console.log(`${LOG_PREFIX} Status: videoId=${videoId}, status=${data.status}, progress=${data.progress ?? "n/a"}`);
  return {
    status: data.status ?? "unknown",
    error: data.error?.message,
  };
}

/**
 * Fetch the completed video MP4 as a buffer.
 */
export async function getOpenAISoraVideoContent(videoId: string): Promise<Buffer> {
  console.log(`${LOG_PREFIX} Fetching content: videoId=${videoId}`);
  const res = await fetch(`${OPENAI_BASE}/videos/${videoId}/content`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });
  if (!res.ok) {
    console.error(`${LOG_PREFIX} Content failed: ${res.status}`);
    throw new Error(`OpenAI Sora content: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  console.log(`${LOG_PREFIX} Content received: videoId=${videoId}, size=${buffer.length} bytes`);
  return buffer;
}

const DEFAULT_POLL_INTERVAL_MS = 15000;
const DEFAULT_MAX_WAIT_MS = 600000; // 10 min

/**
 * Create image-to-video job, poll until completed, return MP4 buffer.
 */
export async function generateOpenAISoraImageToVideo(
  imageUrl: string,
  prompt: string,
  options: {
    aspect_ratio?: "portrait" | "landscape";
    duration?: "10" | "15";
    seconds?: OpenAISoraSeconds;
    model?: "sora-2" | "sora-2-pro";
  } = {}
): Promise<Buffer> {
  const aspect = options.aspect_ratio ?? "landscape";
  const duration = options.duration ?? "10";
  const size = mapAspectToSize(aspect);
  const seconds = options.seconds ?? mapDurationToSeconds(duration);
  const model = options.model ?? "sora-2";

  console.log(`${LOG_PREFIX} generateOpenAISoraImageToVideo: size=${size}, seconds=${seconds}, model=${model}`);
  const videoId = await createOpenAISoraVideo(imageUrl, prompt, { model, seconds, size });

  const started = Date.now();
  const pollMs = DEFAULT_POLL_INTERVAL_MS;
  const maxWait = DEFAULT_MAX_WAIT_MS;

  while (true) {
    const { status, error } = await getOpenAISoraVideoStatus(videoId);
    if (status === "completed") {
      return getOpenAISoraVideoContent(videoId);
    }
    if (status === "failed") {
      throw new Error(error ?? "OpenAI Sora video generation failed");
    }
    if (Date.now() - started > maxWait) {
      throw new Error("OpenAI Sora video timed out");
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
}
