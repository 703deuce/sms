/**
 * Kie.ai API – Nano Banana Pro image generation (headshot app).
 * Set KIE_API_KEY in env. Docs: https://docs.kie.ai/market/google/pro-image-to-image
 */

import { withPipelineRetry } from "@/lib/pipeline-retry";

const KIE_BASE = "https://api.kie.ai";

/** URL returned by upload API when storage is not configured or fails. Do not send to Kie — treat as "no image". */
const UPLOAD_PLACEHOLDER_URL = "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&auto=format&fit=crop&q=80";

function isRealImageUrl(url: string | undefined): boolean {
  if (!url || !url.trim()) return false;
  return url.trim() !== UPLOAD_PLACEHOLDER_URL;
}

export function isKieConfigured(): boolean {
  return Boolean(process.env.KIE_API_KEY);
}

function getAuthHeader(): string {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error("KIE_API_KEY is not set");
  return `Bearer ${key}`;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

const DEFAULT_KIE_MAX_WAIT_MS = envInt("KIE_MAX_WAIT_MS", 0);

export type PhotoAdSize = "square" | "story" | "portrait" | "landscape";
export type NanoBananaImageModel = "nano-banana-pro" | "nano-banana-2";

const ASPECT_RATIO_MAP: Record<PhotoAdSize, string> = {
  square: "1:1",
  story: "9:16",
  portrait: "3:4",
  landscape: "16:9",
};

const NANO_IMAGE_INPUT_MAX = 8;

function pushUniqueImageInput(imageInput: string[], seen: Set<string>, url: string | undefined): void {
  if (!url || !isRealImageUrl(url)) return;
  const t = url.trim();
  if (seen.has(t)) return;
  seen.add(t);
  imageInput.push(t);
}

/** Create a Nano Banana Pro task. Returns taskId. */
export async function createNanoBananaProTask(
  prompt: string,
  size: PhotoAdSize,
  options?: {
    logoUrl?: string;
    productImageUrl?: string;
    /** Extra reference URLs (products, places, extra creator refs, etc.) — appended after product/logo slots. */
    additionalReferenceImageUrls?: string[];
    model?: NanoBananaImageModel;
  }
): Promise<string> {
  const aspectRatio = ASPECT_RATIO_MAP[size] ?? "1:1";
  const seen = new Set<string>();
  const imageInput: string[] = [];
  pushUniqueImageInput(imageInput, seen, options?.productImageUrl);
  pushUniqueImageInput(imageInput, seen, options?.logoUrl);
  for (const u of options?.additionalReferenceImageUrls ?? []) {
    pushUniqueImageInput(imageInput, seen, typeof u === "string" ? u : undefined);
    if (imageInput.length >= NANO_IMAGE_INPUT_MAX) break;
  }
  if (imageInput.length > NANO_IMAGE_INPUT_MAX) imageInput.length = NANO_IMAGE_INPUT_MAX;

  const promptToSend = prompt.slice(0, 10000);
  console.log("[kie][nano-banana-prompt]", "length:", promptToSend.length, "chars");
  console.log("[kie][nano-banana-prompt] --- BEGIN ---\n" + promptToSend + "\n--- END ---");

  const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options?.model ?? "nano-banana-pro",
      input: {
        prompt: promptToSend,
        aspect_ratio: aspectRatio,
        image_input: imageInput.length > 0 ? imageInput : undefined,
        resolution: "2K",
        output_format: "png",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Kie createTask: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { code?: number; data?: { taskId?: string }; msg?: string };
  const taskId = data.data?.taskId;
  if (!taskId) throw new Error(`Kie createTask: no taskId in response ${JSON.stringify(data)}`);
  return taskId;
}

/** Poll task until success or fail. Returns first result URL. */
export async function pollNanoBananaProTask(taskId: string): Promise<string> {
  const intervalMs = envInt("KIE_IMAGE_POLL_INTERVAL_MS", 4000);
  const maxWaitMs = envInt("KIE_IMAGE_MAX_WAIT_MS", DEFAULT_KIE_MAX_WAIT_MS);
  const startedAt = Date.now();

  while (true) {
    const res = await fetch(`${KIE_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      method: "GET",
      headers: { Authorization: getAuthHeader() },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Kie recordInfo: ${res.status} ${err}`);
    }

    const data = (await res.json()) as {
      data?: { state?: string; resultJson?: string; failMsg?: string };
    };
    const state = data.data?.state;

    if (state === "success") {
      const resultJson = data.data?.resultJson;
      if (!resultJson) throw new Error("Kie task success but no resultJson");
      let parsed: { resultUrls?: string[] };
      try {
        parsed = JSON.parse(resultJson) as { resultUrls?: string[] };
      } catch {
        throw new Error("Kie resultJson invalid");
      }
      const url = parsed.resultUrls?.[0];
      if (!url) throw new Error("Kie resultUrls empty");
      console.log("[kie] poll success:", { taskId, resultUrl: url });
      return url;
    }

    if (state === "fail") {
      const msg = data.data?.failMsg ?? "Generation failed";
      console.log("[kie] poll fail:", { taskId, failMsg: msg, fullData: data });
      throw new Error(`Kie task failed: ${msg}`);
    }

    if (state === "cancel" || state === "canceled") {
      throw new Error("Kie task was canceled");
    }

    await new Promise((r) => setTimeout(r, intervalMs));
    if (maxWaitMs > 0 && Date.now() - startedAt > maxWaitMs) {
      throw new Error(`Kie task timed out after ${Math.round(maxWaitMs / 1000)}s`);
    }
  }
}

/** Generate one ad image with Nano Banana Pro (create + poll). Retries on transient Kie failures. */
export async function generateAdImageWithNanoBanana(
  prompt: string,
  size: PhotoAdSize,
  options?: {
    logoUrl?: string;
    productImageUrl?: string;
    additionalReferenceImageUrls?: string[];
    model?: NanoBananaImageModel;
  }
): Promise<string> {
  return withPipelineRetry("kie/nano-banana", async () => {
    const taskId = await createNanoBananaProTask(prompt, size, options);
    return pollNanoBananaProTask(taskId);
  });
}

const NANO_BANANA_EDIT_IMAGE_SIZE: Record<PhotoAdSize, string> = {
  square: "1:1",
  story: "9:16",
  portrait: "3:4",
  landscape: "16:9",
};

/** Create a Nano Banana Edit task. Returns taskId. */
export async function createNanoBananaEditTask(
  imageUrls: string[],
  prompt: string,
  imageSize: PhotoAdSize = "square"
): Promise<string> {
  if (imageUrls.length === 0) throw new Error("At least one image URL required for edit");
  const sizeStr = NANO_BANANA_EDIT_IMAGE_SIZE[imageSize] ?? "1:1";

  const promptToSend = prompt.slice(0, 5000);
  console.log("[kie][nano-banana-edit-prompt]", "length:", promptToSend.length, "chars");
  console.log("[kie][nano-banana-edit-prompt] --- BEGIN ---\n" + promptToSend + "\n--- END ---");

  const body = {
    model: "google/nano-banana-edit",
    input: {
      prompt: promptToSend,
      image_urls: imageUrls.slice(0, 10),
      output_format: "png",
      image_size: sizeStr,
    },
  };

  const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const resText = await res.text();
  console.log("[kie] createTask response:", { status: res.status, body: resText });

  if (!res.ok) {
    throw new Error(`Kie createTask (edit): ${res.status} ${resText}`);
  }

  let data: { code?: number; data?: { taskId?: string }; msg?: string };
  try {
    data = JSON.parse(resText) as typeof data;
  } catch {
    throw new Error(`Kie createTask (edit): invalid JSON ${resText.slice(0, 200)}`);
  }
  const taskId = data.data?.taskId;
  if (!taskId) throw new Error(`Kie createTask (edit): no taskId in response ${JSON.stringify(data)}`);
  return taskId;
}

/** Generate one edited image with Nano Banana Edit (create + poll). */
export async function editAdImageWithNanoBanana(
  imageUrls: string[],
  editPrompt: string,
  imageSize: PhotoAdSize = "square"
): Promise<string> {
  const taskId = await createNanoBananaEditTask(imageUrls, editPrompt, imageSize);
  console.log("[kie] edit task created, polling:", { taskId });
  return pollNanoBananaProTask(taskId);
}

const DEFAULT_KIE_POLL_INTERVAL_MS = envInt("KIE_POLL_INTERVAL_MS", 5000);

/** Sora 2 model: standard or pro. */
export type Sora2Model = "standard" | "pro";

export type Sora2TextToVideoOptions = {
  model?: Sora2Model;
  aspect_ratio?: "portrait" | "landscape";
  n_frames?: "10" | "15";
};

const SORA2_MODEL_MAP: Record<Sora2Model, string> = {
  standard: "sora-2-text-to-video",
  pro: "sora-2-pro-text-to-video",
};

export async function createSora2TextToVideoTask(
  prompt: string,
  options: Sora2TextToVideoOptions = {}
): Promise<string> {
  const { model = "standard", aspect_ratio = "landscape", n_frames = "15" } = options;
  const kieModel = SORA2_MODEL_MAP[model];
  const input: Record<string, unknown> = {
    prompt: prompt.slice(0, 10000),
    aspect_ratio,
    n_frames,
    remove_watermark: true,
  };
  if (kieModel === "sora-2-pro-text-to-video") {
    (input as Record<string, string>)["size"] = "high";
  }
  const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: { Authorization: getAuthHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ model: kieModel, input }),
  });
  if (!res.ok) throw new Error(`Kie createTask (sora-2): ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { code?: number; data?: { taskId?: string }; msg?: string };
  const taskId = data.data?.taskId;
  if (!taskId) throw new Error(`Kie createTask (sora-2): no taskId in response ${JSON.stringify(data)}`);
  return taskId;
}

async function pollKieTask(
  taskId: string,
  options?: { intervalMs?: number; maxWaitMs?: number }
): Promise<string> {
  const intervalMs = options?.intervalMs ?? DEFAULT_KIE_POLL_INTERVAL_MS;
  const maxWaitMs = options?.maxWaitMs ?? DEFAULT_KIE_MAX_WAIT_MS;
  const startedAt = Date.now();
  while (true) {
    const res = await fetch(`${KIE_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      method: "GET",
      headers: { Authorization: getAuthHeader() },
    });
    if (!res.ok) throw new Error(`Kie recordInfo: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as {
      data?: { state?: string; resultJson?: string; failMsg?: string };
    };
    const state = data.data?.state;
    if (state === "success") {
      const resultJson = data.data?.resultJson;
      if (!resultJson) throw new Error("Kie task success but no resultJson");
      let parsed: { resultUrls?: string[] };
      try {
        parsed = JSON.parse(resultJson) as { resultUrls?: string[] };
      } catch {
        throw new Error("Kie resultJson invalid");
      }
      const url = parsed.resultUrls?.[0];
      if (!url) throw new Error("Kie resultUrls empty");
      return url;
    }
    if (state === "fail") {
      throw new Error(`Kie task failed: ${data.data?.failMsg ?? "Generation failed"}`);
    }
    if (state === "cancel" || state === "canceled") throw new Error("Kie task was canceled");
    await new Promise((r) => setTimeout(r, intervalMs));
    if (maxWaitMs > 0 && Date.now() - startedAt > maxWaitMs) {
      throw new Error(`Kie task timed out after ${Math.round(maxWaitMs / 1000)}s`);
    }
  }
}

export async function generateSora2Video(prompt: string, options: Sora2TextToVideoOptions = {}): Promise<string> {
  const taskId = await createSora2TextToVideoTask(prompt, options);
  return pollKieTask(taskId, {
    intervalMs: envInt("KIE_VIDEO_POLL_INTERVAL_MS", DEFAULT_KIE_POLL_INTERVAL_MS),
    maxWaitMs: envInt("KIE_VIDEO_MAX_WAIT_MS", DEFAULT_KIE_MAX_WAIT_MS),
  });
}

export type KlingTextToVideoOptions = {
  duration?: "10" | "15";
  mode?: "std" | "pro";
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  sound?: boolean;
  image_urls?: string[];
};

export async function createKlingTextToVideoTask(
  prompt: string,
  options: KlingTextToVideoOptions = {}
): Promise<string> {
  const { duration = "15", mode = "pro", aspect_ratio = "9:16", sound = true, image_urls } = options;
  const referenceImages = Array.isArray(image_urls)
    ? image_urls
        .filter((u) => typeof u === "string" && /^https?:\/\//.test(u.trim()))
        .map((u) => u.trim())
        .slice(0, 2)
    : [];
  const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: { Authorization: getAuthHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "kling-3.0/video",
      input: {
        mode,
        prompt: prompt.slice(0, 1000),
        sound,
        duration,
        aspect_ratio,
        image_urls: referenceImages.length > 0 ? referenceImages : undefined,
        multi_shots: false,
      },
    }),
  });
  if (!res.ok) throw new Error(`Kie createTask (kling text-to-video): ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { code?: number; data?: { taskId?: string }; msg?: string };
  const taskId = data.data?.taskId;
  if (!taskId) throw new Error(`Kie createTask (kling text-to-video): no taskId in response ${JSON.stringify(data)}`);
  return taskId;
}

export async function generateKlingVideo(prompt: string, options: KlingTextToVideoOptions = {}): Promise<string> {
  const taskId = await createKlingTextToVideoTask(prompt, options);
  return pollKieTask(taskId, {
    intervalMs: envInt("KIE_VIDEO_POLL_INTERVAL_MS", DEFAULT_KIE_POLL_INTERVAL_MS),
    maxWaitMs: envInt("KIE_VIDEO_MAX_WAIT_MS", DEFAULT_KIE_MAX_WAIT_MS),
  });
}

export type Sora2ImageToVideoOptions = {
  aspect_ratio?: "portrait" | "landscape";
  n_frames?: "10" | "15";
};

export async function createSora2ImageToVideoTask(
  imageUrl: string,
  prompt: string,
  options: Sora2ImageToVideoOptions = {}
): Promise<string> {
  const { aspect_ratio = "landscape", n_frames = "10" } = options;
  const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: { Authorization: getAuthHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sora-2-image-to-video",
      input: {
        prompt: prompt.slice(0, 10000),
        image_urls: [imageUrl.trim()],
        aspect_ratio,
        n_frames,
        remove_watermark: true,
      },
    }),
  });
  if (!res.ok) throw new Error(`Kie createTask (sora-2-image-to-video): ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { code?: number; data?: { taskId?: string }; msg?: string };
  const taskId = data.data?.taskId;
  if (!taskId) throw new Error(`Kie createTask (sora-2-image-to-video): no taskId in response ${JSON.stringify(data)}`);
  return taskId;
}

export async function generateSora2ImageToVideo(
  imageUrl: string,
  prompt: string,
  options: Sora2ImageToVideoOptions = {}
): Promise<string> {
  const taskId = await createSora2ImageToVideoTask(imageUrl, prompt, options);
  return pollKieTask(taskId, {
    intervalMs: envInt("KIE_VIDEO_POLL_INTERVAL_MS", DEFAULT_KIE_POLL_INTERVAL_MS),
    maxWaitMs: envInt("KIE_VIDEO_MAX_WAIT_MS", DEFAULT_KIE_MAX_WAIT_MS),
  });
}

export async function createSora2ProImageToVideoTask(
  imageUrl: string,
  prompt: string,
  options: Sora2ImageToVideoOptions & { size?: "standard" | "high" } = {}
): Promise<string> {
  const { aspect_ratio = "landscape", n_frames = "10", size = "standard" } = options;
  const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: { Authorization: getAuthHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sora-2-pro-image-to-video",
      input: {
        prompt: prompt.slice(0, 10000),
        image_urls: [imageUrl.trim()],
        aspect_ratio,
        n_frames: n_frames === "15" ? "15" : "10",
        size,
        remove_watermark: true,
      },
    }),
  });
  if (!res.ok) throw new Error(`Kie createTask (sora-2-pro-image-to-video): ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { code?: number; data?: { taskId?: string }; msg?: string };
  const taskId = data.data?.taskId;
  if (!taskId) throw new Error(`Kie createTask (sora-2-pro-image-to-video): no taskId in response ${JSON.stringify(data)}`);
  return taskId;
}

export async function generateSora2ProImageToVideo(
  imageUrl: string,
  prompt: string,
  options: Sora2ImageToVideoOptions & { size?: "standard" | "high" } = {}
): Promise<string> {
  const taskId = await createSora2ProImageToVideoTask(imageUrl, prompt, options);
  return pollKieTask(taskId, {
    intervalMs: envInt("KIE_VIDEO_POLL_INTERVAL_MS", DEFAULT_KIE_POLL_INTERVAL_MS),
    maxWaitMs: envInt("KIE_VIDEO_MAX_WAIT_MS", DEFAULT_KIE_MAX_WAIT_MS),
  });
}

export type KlingImageToVideoOptions = {
  duration?: "5" | "10";
  mode?: "std" | "pro";
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  sound?: boolean;
  reference_image_urls?: string[];
};

export async function createKlingImageToVideoTask(
  imageUrl: string,
  prompt: string,
  options: KlingImageToVideoOptions = {}
): Promise<string> {
  const { duration = "5", mode = "pro", aspect_ratio = "16:9", sound = false, reference_image_urls } = options;
  const refs = Array.isArray(reference_image_urls)
    ? reference_image_urls
        .filter((u) => typeof u === "string" && /^https?:\/\//.test(u.trim()))
        .map((u) => u.trim())
        .slice(0, 1)
    : [];
  const imageUrls = [imageUrl.trim(), ...refs].slice(0, 2);
  const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: { Authorization: getAuthHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "kling-3.0/video",
      input: {
        mode,
        prompt: prompt.slice(0, 1000),
        image_urls: imageUrls,
        sound,
        duration,
        aspect_ratio,
        multi_shots: false,
      },
    }),
  });
  if (!res.ok) throw new Error(`Kie createTask (kling image-to-video): ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { code?: number; data?: { taskId?: string }; msg?: string };
  const taskId = data.data?.taskId;
  if (!taskId) throw new Error(`Kie createTask (kling image-to-video): no taskId in response ${JSON.stringify(data)}`);
  return taskId;
}

export async function generateKlingImageToVideo(
  imageUrl: string,
  prompt: string,
  options: KlingImageToVideoOptions = {}
): Promise<string> {
  const taskId = await createKlingImageToVideoTask(imageUrl, prompt, options);
  return pollKieTask(taskId, {
    intervalMs: envInt("KIE_VIDEO_POLL_INTERVAL_MS", DEFAULT_KIE_POLL_INTERVAL_MS),
    maxWaitMs: envInt("KIE_VIDEO_MAX_WAIT_MS", DEFAULT_KIE_MAX_WAIT_MS),
  });
}
