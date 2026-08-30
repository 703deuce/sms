import { existsSync, readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { KIMI_FILE_READY_TIMEOUT_MS, KIMI_FILE_UPLOAD_TIMEOUT_MS, KIMI_PROGRESS_HEARTBEAT_MS, MAX_VIDEO_BYTES } from "./config";
import { kimiFetch } from "./kimi-http";
import { log } from "./logger";
import { appendProgressLog, updateProgress } from "./progress";
import { validateMediaFile } from "./path-guards";
import type { KimiMediaDelivery } from "./types";

type UploadCacheEntry = {
  fileId: string;
  uploadedAt: string;
};

const sessionUploadCache = new Map<string, UploadCacheEntry>();

function cacheKey(filePath: string): string {
  const stat = statSync(filePath);
  return `${filePath}:${stat.size}:${stat.mtimeMs}`;
}

function redactSecrets(text: string): string {
  return text.replace(/sk-[A-Za-z0-9_-]{10,}/g, "[REDACTED_API_KEY]");
}

async function fetchJson(
  url: string,
  init: RequestInit,
  apiKey: string,
  options?: { timeoutMs?: number; label?: string; sessionId?: string },
): Promise<unknown> {
  const res = await kimiFetch(url, {
    ...init,
    timeoutMs: options?.timeoutMs ?? KIMI_FILE_UPLOAD_TIMEOUT_MS,
    label: options?.label ?? "Kimi API request",
    sessionId: options?.sessionId,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers || {}),
    },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Kimi API ${res.status}: ${redactSecrets(body.slice(0, 500))}`);
  }
  return JSON.parse(body) as unknown;
}

async function waitForKimiFileReady(
  baseUrl: string,
  apiKey: string,
  fileId: string,
  sessionId?: string,
): Promise<void> {
  const started = Date.now();
  let attempt = 0;
  while (Date.now() - started < KIMI_FILE_READY_TIMEOUT_MS) {
    attempt += 1;
    const json = (await fetchJson(`${baseUrl}/files/${fileId}`, { method: "GET" }, apiKey, {
      timeoutMs: 60_000,
      label: `Kimi file status check (${fileId})`,
      sessionId,
    })) as {
      status?: string;
    };
    const status = (json.status || "processed").toLowerCase();
    if (status === "processed" || status === "ok" || status === "ready" || status === "completed") {
      if (sessionId) {
        updateProgress(sessionId, {
          phase: "generating_ui",
          message: `Video processed by Kimi (file ${fileId}). Starting UI generation…`,
        });
      }
      return;
    }
    if (status === "error" || status === "failed") {
      throw new Error(`Kimi file processing failed for ${fileId}`);
    }
    const elapsedSec = Math.round((Date.now() - started) / 1000);
    if (sessionId && attempt % 2 === 0) {
      updateProgress(sessionId, {
        phase: "processing_video",
        message: `Kimi is processing the video… ${elapsedSec}s (this is normal for multi-minute tutorials)`,
      });
    }
    await new Promise((resolve) => setTimeout(resolve, KIMI_PROGRESS_HEARTBEAT_MS / 3));
  }
  log("video upload", `file ${fileId} status poll timed out after ${Math.round(KIMI_FILE_READY_TIMEOUT_MS / 1000)}s — proceeding with ms:// reference`);
  if (sessionId) {
    appendProgressLog(sessionId, `Video processing poll timed out; continuing with ms://${fileId}`);
  }
}

/**
 * Upload video via Kimi Files API (purpose=video) and return ms:// file id.
 * NEVER base64-embed video bytes into prompt text.
 */
export async function uploadVideoForNativeKimi(input: {
  baseUrl: string;
  apiKey: string;
  filePath: string;
  mimeType: string;
  label: string;
  sessionId?: string;
}): Promise<KimiMediaDelivery> {
  const { kind, mimeType, size } = validateMediaFile(input.filePath);
  if (kind !== "video") {
    throw new Error(`Expected video file for native upload: ${input.filePath}`);
  }

  const maxBytes = MAX_VIDEO_BYTES;
  if (size > maxBytes) {
    throw new Error(
      `Video ${input.filePath} is ${(size / 1024 / 1024).toFixed(1)}MB — exceeds Kimi limit (${(maxBytes / 1024 / 1024).toFixed(0)}MB).`,
    );
  }

  const key = cacheKey(input.filePath);
  const cached = sessionUploadCache.get(key);
  if (cached) {
    log("video delivery", `cache hit ms://${cached.fileId} (${input.label})`);
    return {
      kind: "video",
      label: input.label,
      localPath: input.filePath,
      mimeType,
      bytes: size,
      delivery: "native_ms",
      reference: `ms://${cached.fileId}`,
      kimiFileId: cached.fileId,
    };
  }

  if (!existsSync(input.filePath)) {
    throw new Error(`Video file not found: ${input.filePath}`);
  }

  if (input.sessionId) {
    updateProgress(input.sessionId, {
      phase: "uploading_video",
      message: `Uploading ${basename(input.filePath)} to Kimi (${(size / 1024 / 1024).toFixed(1)} MB)…`,
    });
  }

  const fileBuffer = readFileSync(input.filePath);
  const form = new FormData();
  form.append("purpose", "video");
  form.append("file", new Blob([fileBuffer], { type: input.mimeType }), basename(input.filePath));

  const res = await kimiFetch(`${input.baseUrl}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.apiKey}` },
    body: form,
    timeoutMs: KIMI_FILE_UPLOAD_TIMEOUT_MS,
    label: `Kimi video upload (${basename(input.filePath)})`,
    sessionId: input.sessionId,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Kimi video upload failed ${res.status}: ${redactSecrets(text.slice(0, 500))}`);
  }

  const json = JSON.parse(text) as { id?: string; data?: { id?: string } };
  const fileId = json.id || json.data?.id;
  if (!fileId) throw new Error("Kimi video upload did not return a file id");

  if (input.sessionId) {
    updateProgress(input.sessionId, {
      phase: "processing_video",
      message: `Uploaded to Kimi. Waiting for video processing (file ${fileId})…`,
    });
  }

  await waitForKimiFileReady(input.baseUrl, input.apiKey, fileId, input.sessionId);
  sessionUploadCache.set(key, { fileId, uploadedAt: new Date().toISOString() });

  log(
    "video delivery",
    `native Files API → ms://${fileId} (${(size / 1024 / 1024).toFixed(1)}MB) [${input.label}]`,
  );

  return {
    kind: "video",
    label: input.label,
    localPath: input.filePath,
    mimeType,
    bytes: size,
    delivery: "native_ms",
    reference: `ms://${fileId}`,
    kimiFileId: fileId,
  };
}

/** Screenshots stay as compact data URLs — never used for full reference videos. */
export function imageToDataUrl(filePath: string, mimeType: string): string {
  const b64 = readFileSync(filePath).toString("base64");
  return `data:${mimeType};base64,${b64}`;
}

export function buildImageDataUrlDelivery(input: {
  filePath: string;
  mimeType: string;
  label: string;
}): KimiMediaDelivery {
  const { size } = validateMediaFile(input.filePath);
  return {
    kind: "image",
    label: input.label,
    localPath: input.filePath,
    mimeType: input.mimeType,
    bytes: size,
    delivery: "image_data_url",
    reference: imageToDataUrl(input.filePath, input.mimeType),
  };
}

export function clearKimiUploadCache(): void {
  sessionUploadCache.clear();
}
