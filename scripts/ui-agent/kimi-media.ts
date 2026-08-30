import { existsSync, readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { MAX_VIDEO_BYTES } from "./config";
import { log } from "./logger";
import { validateMediaFile } from "./path-guards";
import type { KimiMediaDelivery } from "./types";

type UploadCacheEntry = {
  fileId: string;
  uploadedAt: string;
};

const sessionUploadCache = new Map<string, UploadCacheEntry>();

function resolveMaxVideoBytes(): number {
  const fromEnv = process.env.KIMI_MAX_VIDEO_BYTES?.trim();
  if (fromEnv && /^\d+$/.test(fromEnv)) return Number(fromEnv);
  return MAX_VIDEO_BYTES;
}

function cacheKey(filePath: string): string {
  const stat = statSync(filePath);
  return `${filePath}:${stat.size}:${stat.mtimeMs}`;
}

function redactSecrets(text: string): string {
  return text.replace(/sk-[A-Za-z0-9_-]{10,}/g, "[REDACTED_API_KEY]");
}

async function fetchJson(url: string, init: RequestInit, apiKey: string): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
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

async function waitForKimiFileReady(baseUrl: string, apiKey: string, fileId: string): Promise<void> {
  const maxAttempts = 30;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const json = (await fetchJson(`${baseUrl}/files/${fileId}`, { method: "GET" }, apiKey)) as {
      status?: string;
      id?: string;
    };
    const status = (json.status || "processed").toLowerCase();
    if (status === "processed" || status === "ok" || status === "ready" || status === "completed") {
      return;
    }
    if (status === "error" || status === "failed") {
      throw new Error(`Kimi file processing failed for ${fileId}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  log("video upload", `file ${fileId} status poll timed out — proceeding with ms:// reference`);
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
}): Promise<KimiMediaDelivery> {
  const { kind, mimeType, size } = validateMediaFile(input.filePath);
  if (kind !== "video") {
    throw new Error(`Expected video file for native upload: ${input.filePath}`);
  }

  const maxBytes = resolveMaxVideoBytes();
  if (size > maxBytes) {
    throw new Error(
      `Video ${input.filePath} is ${(size / 1024 / 1024).toFixed(1)}MB — exceeds Kimi limit (${(maxBytes / 1024 / 1024).toFixed(0)}MB). ` +
        `Set KIMI_MAX_VIDEO_BYTES if your endpoint allows a higher cap.`,
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

  const fileBuffer = readFileSync(input.filePath);
  const form = new FormData();
  form.append("purpose", "video");
  form.append("file", new Blob([fileBuffer], { type: input.mimeType }), basename(input.filePath));

  const res = await fetch(`${input.baseUrl}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.apiKey}` },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Kimi video upload failed ${res.status}: ${redactSecrets(text.slice(0, 500))}`);
  }

  const json = JSON.parse(text) as { id?: string; data?: { id?: string } };
  const fileId = json.id || json.data?.id;
  if (!fileId) throw new Error("Kimi video upload did not return a file id");

  await waitForKimiFileReady(input.baseUrl, input.apiKey, fileId);
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
