import { existsSync, readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { KIMI_FILE_READY_TIMEOUT_MS, KIMI_FILE_UPLOAD_TIMEOUT_MS, KIMI_PROGRESS_HEARTBEAT_MS, MAX_VIDEO_BYTES } from "./config";
import {
  invalidateKimiFileCache,
  lookupKimiFileCache,
  saveKimiFileCache,
  sha256Buffer,
  touchKimiFileCacheVerified,
} from "./kimi-file-cache";
import { kimiFetch } from "./kimi-http";
import { markKimiTiming } from "./kimi-timing";
import { log } from "./logger";
import { appendProgressLog, updateProgress } from "./progress";
import { inferMimeType, validateMediaFile } from "./path-guards";
import { fetchUiReferenceBytes } from "./supabase-references";
import type { KimiMediaDelivery, LabeledMedia } from "./types";

const READY_STATUSES = new Set(["ready", "processed", "ok", "completed"]);
const PROCESSING_STATUSES = new Set(["processing", "pending", "uploaded"]);

function redactSecrets(text: string): string {
  return text.replace(/sk-[A-Za-z0-9_-]{10,}/g, "[REDACTED_API_KEY]");
}

type KimiFileObject = {
  id?: string;
  status?: string;
};

async function fetchKimiFile(
  baseUrl: string,
  apiKey: string,
  fileId: string,
  sessionId?: string,
): Promise<KimiFileObject> {
  const res = await kimiFetch(`${baseUrl}/files/${fileId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
    timeoutMs: 60_000,
    label: `Kimi file verify (${fileId})`,
    sessionId,
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Kimi file verify ${res.status}: ${redactSecrets(body.slice(0, 300))}`);
  }
  return JSON.parse(body) as KimiFileObject;
}

function isReadyStatus(status?: string): boolean {
  return READY_STATUSES.has((status || "").toLowerCase());
}

async function waitForKimiFileIfProcessing(
  baseUrl: string,
  apiKey: string,
  fileId: string,
  sessionId?: string,
): Promise<string> {
  const started = Date.now();
  let attempt = 0;
  while (Date.now() - started < KIMI_FILE_READY_TIMEOUT_MS) {
    attempt += 1;
    const json = await fetchKimiFile(baseUrl, apiKey, fileId, sessionId);
    const status = (json.status || "").toLowerCase();
    if (isReadyStatus(status)) return status || "ready";
    if (status === "error" || status === "failed") {
      throw new Error(`Kimi file processing failed for ${fileId}`);
    }
    if (!PROCESSING_STATUSES.has(status) && status) {
      log("video upload", `unknown Kimi file status "${status}" for ${fileId} — proceeding`);
      return status;
    }
    const elapsedSec = Math.round((Date.now() - started) / 1000);
    if (sessionId && attempt % 3 === 0) {
      updateProgress(sessionId, {
        phase: "processing_video",
        message: `Kimi reports video processing… ${elapsedSec}s`,
      });
    }
    await new Promise((resolve) => setTimeout(resolve, KIMI_PROGRESS_HEARTBEAT_MS / 3));
  }
  log("video upload", `file ${fileId} still processing after ${Math.round(KIMI_FILE_READY_TIMEOUT_MS / 1000)}s — proceeding with ms://`);
  if (sessionId) appendProgressLog(sessionId, `Video still processing after poll timeout; continuing with ms://${fileId}`);
  return "processing_timeout";
}

async function uploadBytesToKimi(input: {
  baseUrl: string;
  apiKey: string;
  bytes: Buffer;
  filename: string;
  mimeType: string;
  sessionId?: string;
}): Promise<{ fileId: string; status: string; uploadMs: number }> {
  const uploadStarted = Date.now();
  if (input.sessionId) {
    updateProgress(input.sessionId, {
      phase: "uploading_video",
      message: `Uploading ${input.filename} to Kimi (${(input.bytes.length / 1024 / 1024).toFixed(1)} MB)…`,
    });
  }

  const form = new FormData();
  form.append("purpose", "video");
  form.append("file", new Blob([input.bytes], { type: input.mimeType }), input.filename);

  const maxUploadRetries = Number(process.env.KIMI_VIDEO_UPLOAD_RETRIES || 6);
  let lastError = "";

  for (let attempt = 0; attempt <= maxUploadRetries; attempt += 1) {
    const res = await kimiFetch(`${input.baseUrl}/files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${input.apiKey}` },
      body: form,
      timeoutMs: KIMI_FILE_UPLOAD_TIMEOUT_MS,
      label: `Kimi video upload (${input.filename})`,
      sessionId: input.sessionId,
      maxRetries: 2,
    });
    const text = await res.text();
    if (res.ok) {
      const json = JSON.parse(text) as KimiFileObject & { data?: KimiFileObject };
      const fileId = json.id || json.data?.id;
      if (!fileId) throw new Error("Kimi video upload did not return a file id");

      const uploadMs = Date.now() - uploadStarted;
      const status = (json.status || "ready").toLowerCase();
      if (input.sessionId) {
        markKimiTiming(input.sessionId, "videoUploadCompleteMs", uploadMs);
        markKimiTiming(input.sessionId, "kimiFileId", fileId);
        appendProgressLog(input.sessionId, `kimi_upload_completed_ms=${uploadMs} kimi_file_status=${status} file_id=${fileId}`);
      }

      return { fileId, status, uploadMs };
    }

    lastError = `Kimi video upload failed ${res.status}: ${redactSecrets(text.slice(0, 500))}`;
    const isRateLimited = res.status === 429 || /rate limit|too many requests/i.test(text);
    if (isRateLimited && attempt < maxUploadRetries) {
      const waitSec = Math.min(180, 30 * (attempt + 1));
      const line = `${lastError} — backing off ${waitSec}s (attempt ${attempt + 1}/${maxUploadRetries})`;
      if (input.sessionId) appendProgressLog(input.sessionId, line);
      else console.warn(`[ui-agent] ${line}`);
      await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
      continue;
    }
    throw new Error(lastError);
  }

  throw new Error(lastError || "Kimi video upload failed");
}

function deliveryFromFileId(
  media: LabeledMedia,
  fileId: string,
  bytes: number,
  fromCache: boolean,
): KimiMediaDelivery {
  return {
    kind: "video",
    label: media.label,
    localPath: media.path,
    mimeType: media.mimeType,
    bytes,
    delivery: "native_ms",
    reference: `ms://${fileId}`,
    kimiFileId: fileId,
    fromCache,
  };
}

async function resolveVideoBytes(media: LabeledMedia, sessionId?: string): Promise<{ bytes: Buffer; filename: string }> {
  if (media.supabase) {
    if (sessionId) {
      markKimiTiming(sessionId, "supabaseDownloadStartedMs");
      appendProgressLog(sessionId, "supabase_download_started");
    }
    const bytes = await fetchUiReferenceBytes({
      bucket: media.supabase.bucket,
      path: media.supabase.path,
    });
    if (sessionId) {
      markKimiTiming(sessionId, "supabaseDownloadCompletedMs");
      appendProgressLog(sessionId, `supabase_download_completed_ms=${Date.now()}`);
    }
    return { bytes, filename: basename(media.supabase.path) };
  }

  const { kind, mimeType, size } = validateMediaFile(media.path);
  if (kind !== "video") throw new Error(`Expected video: ${media.path}`);
  if (size > MAX_VIDEO_BYTES) {
    throw new Error(`Video exceeds Kimi limit (${(MAX_VIDEO_BYTES / 1024 / 1024).toFixed(0)}MB)`);
  }
  if (!existsSync(media.path)) throw new Error(`Video file not found: ${media.path}`);
  return { bytes: readFileSync(media.path), filename: basename(media.path) };
}

async function tryCachedKimiFile(input: {
  media: LabeledMedia;
  baseUrl: string;
  apiKey: string;
  sessionId?: string;
}): Promise<KimiMediaDelivery | null> {
  const supabase = input.media.supabase;
  if (!supabase) return null;

  const cached = lookupKimiFileCache({
    bucket: supabase.bucket,
    path: supabase.path,
  });
  if (!cached) return null;

  try {
    const remote = await fetchKimiFile(input.baseUrl, input.apiKey, cached.kimi.fileId, input.sessionId);
    if (!isReadyStatus(remote.status) && remote.status) {
      invalidateKimiFileCache(supabase.bucket, supabase.path);
      return null;
    }
    touchKimiFileCacheVerified(supabase.bucket, supabase.path);
    if (input.sessionId) {
      markKimiTiming(input.sessionId, "videoUploadCompleteMs", 0);
      markKimiTiming(input.sessionId, "kimiFileId", cached.kimi.fileId);
      markKimiTiming(input.sessionId, "kimiFileFromCache", true);
      appendProgressLog(
        input.sessionId,
        `kimi_file_cache_hit file_id=${cached.kimi.fileId} (skip Supabase download + Kimi upload)`,
      );
      updateProgress(input.sessionId, {
        phase: "generating_ui",
        message: `Video ready (cached ms://${cached.kimi.fileId}) ✓`,
      });
    }
    log("video delivery", `persistent cache hit ms://${cached.kimi.fileId} (${supabase.referenceName})`);
    return deliveryFromFileId(input.media, cached.kimi.fileId, cached.size, true);
  } catch {
    invalidateKimiFileCache(supabase.bucket, supabase.path);
    return null;
  }
}

/**
 * Primary Kimi video path: POST /v1/files → ms://file_id.
 * Reuses persisted file IDs per Supabase reference. Skips polling when status=ready.
 */
export async function deliverVideoForKimi(input: {
  baseUrl: string;
  apiKey: string;
  media: LabeledMedia;
  sessionId?: string;
}): Promise<KimiMediaDelivery> {
  const cachedDelivery = await tryCachedKimiFile({
    media: input.media,
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    sessionId: input.sessionId,
  });
  if (cachedDelivery) return cachedDelivery;

  const { bytes, filename } = await resolveVideoBytes(input.media, input.sessionId);
  if (bytes.length > MAX_VIDEO_BYTES) {
    throw new Error(`Video is ${(bytes.length / 1024 / 1024).toFixed(1)}MB — exceeds Kimi limit`);
  }

  const { fileId, status, uploadMs } = await uploadBytesToKimi({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    bytes,
    filename,
    mimeType: input.media.mimeType || inferMimeType(filename, "video"),
    sessionId: input.sessionId,
  });

  let finalStatus = status;
  if (!isReadyStatus(status)) {
    if (input.sessionId) {
      updateProgress(input.sessionId, {
        phase: "processing_video",
        message: `Kimi file status=${status}; checking until ready…`,
      });
    }
    finalStatus = await waitForKimiFileIfProcessing(input.baseUrl, input.apiKey, fileId, input.sessionId);
  } else if (input.sessionId) {
    updateProgress(input.sessionId, {
      phase: "generating_ui",
      message: `Video ready (${uploadMs}ms upload) ✓`,
    });
    appendProgressLog(input.sessionId, `video_ready immediate status=ready upload_ms=${uploadMs}`);
  }

  if (input.media.supabase) {
    saveKimiFileCache({
      referenceName: input.media.supabase.referenceName,
      supabaseBucket: input.media.supabase.bucket,
      supabasePath: input.media.supabase.path,
      size: bytes.length,
      sha256: sha256Buffer(bytes),
      kimi: {
        fileId,
        uri: `ms://${fileId}`,
        status: finalStatus,
        uploadedAt: new Date().toISOString(),
        lastVerifiedAt: new Date().toISOString(),
      },
    });
  }

  if (input.sessionId) {
    markKimiTiming(input.sessionId, "kimiFileId", fileId);
    markKimiTiming(input.sessionId, "kimiFileFromCache", false);
  }

  log("video delivery", `POST /v1/files → ms://${fileId} (${(bytes.length / 1024 / 1024).toFixed(1)}MB, ${uploadMs}ms) [${input.media.label}]`);

  return deliveryFromFileId(input.media, fileId, bytes.length, false);
}

/** @deprecated Use deliverVideoForKimi */
export async function uploadVideoForNativeKimi(input: {
  baseUrl: string;
  apiKey: string;
  filePath: string;
  mimeType: string;
  label: string;
  sessionId?: string;
}): Promise<KimiMediaDelivery> {
  return deliverVideoForKimi({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    media: {
      label: input.label,
      purpose: "Reference video",
      path: input.filePath,
      kind: "video",
      mimeType: input.mimeType,
    },
    sessionId: input.sessionId,
  });
}

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
  // session-scoped cache removed — persistent cache in kimi-file-cache.ts
}
