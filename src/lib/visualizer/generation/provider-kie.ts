import "server-only";

import {
  getKieApiKey,
  isVisualizerKieMockMode,
  KIE_JOBS_API_BASE,
  KIE_UPLOAD_API_BASE,
  resolveVisualizerKieModel,
  resolveVisualizerKieOutputFormat,
  resolveVisualizerKieResolution,
} from "@/lib/visualizer/generation/kie-config";

export type KieGenerationInput = {
  workspaceId: string;
  prompt: string;
  roomImage: Buffer;
  roomMime: string;
  referenceImages: Array<{ bytes: Buffer; mime: string; label?: string }>;
  existingTaskId?: string;
};

export type KieGenerationResult = {
  imageBytes: Buffer;
  mimeType: string;
  model: string;
  taskId: string;
};

type KieApiEnvelope<T> = {
  code: number;
  msg: string;
  data?: T;
};

type KieTaskRecord = {
  taskId: string;
  state: string;
  failCode?: string;
  failMsg?: string;
  resultJson?: string;
};

function mimeToExt(mime: string | undefined) {
  const m = mime?.toLowerCase() ?? "";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  return "jpg";
}

async function kieJsonPost<T>(url: string, body: unknown): Promise<KieApiEnvelope<T>> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getKieApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as KieApiEnvelope<T>;
  if (json.code !== 200) {
    throw new Error(json.msg || `KIE request failed (${json.code})`);
  }
  return json;
}

async function kieJsonGet<T>(url: string): Promise<KieApiEnvelope<T>> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getKieApiKey()}` },
  });
  const json = (await res.json()) as KieApiEnvelope<T>;
  if (json.code !== 200) {
    throw new Error(json.msg || `KIE request failed (${json.code})`);
  }
  return json;
}

async function uploadBytesToKie(input: {
  bytes: Buffer;
  mime: string;
  workspaceId: string;
  label: string;
}): Promise<string> {
  const ext = mimeToExt(input.mime);
  const base64Data = `data:${input.mime};base64,${input.bytes.toString("base64")}`;
  const pathSegment = `visualizer-${input.workspaceId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const json = await kieJsonPost<{ downloadUrl?: string; fileUrl?: string }>(
    `${KIE_UPLOAD_API_BASE}/api/file-base64-upload`,
    {
      base64Data,
      uploadPath: pathSegment,
      fileName: `${input.label}-${Date.now()}.${ext}`,
    },
  );
  const url = json.data?.downloadUrl || json.data?.fileUrl;
  if (!url) throw new Error("KIE file upload did not return a download URL.");
  return url;
}

async function createKieTask(input: {
  prompt: string;
  imageUrls: string[];
}): Promise<string> {
  const model = resolveVisualizerKieModel();
  const json = await kieJsonPost<{ taskId: string }>(`${KIE_JOBS_API_BASE}/api/v1/jobs/createTask`, {
    model,
    input: {
      prompt: input.prompt,
      image_input: input.imageUrls,
      aspect_ratio: "auto",
      resolution: resolveVisualizerKieResolution(),
      output_format: resolveVisualizerKieOutputFormat(),
    },
  });
  const taskId = json.data?.taskId;
  if (!taskId) throw new Error("KIE createTask did not return taskId.");
  return taskId;
}

async function pollKieTask(taskId: string): Promise<KieTaskRecord> {
  const deadline = Date.now() + 12 * 60_000;
  let delayMs = 2500;
  while (Date.now() < deadline) {
    const json = await kieJsonGet<KieTaskRecord>(
      `${KIE_JOBS_API_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    );
    const record = json.data;
    if (!record) throw new Error("KIE recordInfo returned no data.");
    const state = record.state?.toLowerCase();
    if (state === "success") return record;
    if (state === "fail") {
      throw new Error(record.failMsg || record.failCode || "KIE generation failed.");
    }
    await new Promise((r) => setTimeout(r, delayMs));
    delayMs = Math.min(delayMs * 1.25, 15_000);
  }
  throw new Error("KIE generation timed out while waiting for results.");
}

function parseResultImageUrl(resultJson: string | undefined): string {
  if (!resultJson) throw new Error("KIE success response missing resultJson.");
  let parsed: { resultUrls?: string[] };
  try {
    parsed = JSON.parse(resultJson) as { resultUrls?: string[] };
  } catch {
    throw new Error("KIE resultJson was not valid JSON.");
  }
  const url = parsed.resultUrls?.[0];
  if (!url) throw new Error("KIE resultJson did not include resultUrls.");
  return url;
}

async function downloadImage(url: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download generated image (${res.status}).`);
  const mimeType = res.headers.get("content-type") || "image/png";
  return { bytes: Buffer.from(await res.arrayBuffer()), mimeType };
}

export async function runKieBathroomGeneration(input: KieGenerationInput): Promise<KieGenerationResult> {
  const model = resolveVisualizerKieModel();

  if (isVisualizerKieMockMode()) {
    return {
      imageBytes: input.roomImage,
      mimeType: input.roomMime,
      model: `${model}:mock`,
      taskId: input.existingTaskId || `mock_${Date.now()}`,
    };
  }

  let taskId = input.existingTaskId;
  if (!taskId) {
    const imageUrls: string[] = [];
    imageUrls.push(
      await uploadBytesToKie({
        bytes: input.roomImage,
        mime: input.roomMime,
        workspaceId: input.workspaceId,
        label: "room",
      }),
    );
    for (let i = 0; i < input.referenceImages.length; i++) {
      const ref = input.referenceImages[i];
      imageUrls.push(
        await uploadBytesToKie({
          bytes: ref.bytes,
          mime: ref.mime,
          workspaceId: input.workspaceId,
          label: ref.label || `material-${i + 1}`,
        }),
      );
    }
    taskId = await createKieTask({ prompt: input.prompt, imageUrls });
  }

  const record = await pollKieTask(taskId);
  const resultUrl = parseResultImageUrl(record.resultJson);
  const downloaded = await downloadImage(resultUrl);

  return {
    imageBytes: downloaded.bytes,
    mimeType: downloaded.mimeType,
    model,
    taskId,
  };
}
