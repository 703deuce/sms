import "server-only";

import { getSupabaseAdmin, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  VISUALIZER_ALLOWED_MIME,
  VISUALIZER_BUCKET,
  VISUALIZER_MAX_UPLOAD_BYTES,
} from "@/lib/visualizer/constants";

let ensuredBucket: string | null = null;

function storageLog(step: string, data?: Record<string, unknown>) {
  if (data && Object.keys(data).length > 0) {
    console.log("[visualizer:storage]", step, JSON.stringify(data));
  } else {
    console.log("[visualizer:storage]", step);
  }
}

/** Mobile browsers often send empty or generic MIME types for camera/gallery picks. */
export function normalizeVisualizerUploadMime(mimeType: string, filename?: string): string {
  const mime = (mimeType || "").trim().toLowerCase();
  if (VISUALIZER_ALLOWED_MIME.has(mime)) return mime;
  const ext = filename?.split(".").pop()?.toLowerCase();
  if (ext === "heic" || ext === "heif") return "image/heic";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (!mime || mime === "application/octet-stream") return "image/jpeg";
  return mime;
}

function extensionForMime(mimeType: string, filename?: string) {
  const fromName = filename?.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("heic") || mimeType.includes("heif")) return "heic";
  return "jpg";
}

export async function ensureVisualizerBucket(bucket = VISUALIZER_BUCKET) {
  if (ensuredBucket === bucket) {
    storageLog("ensureBucket:cache-hit", { bucket });
    return bucket;
  }
  const supabase = getSupabaseAdmin();
  storageLog("ensureBucket:list-start", { bucket });
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    storageLog("ensureBucket:list-failed", { message: listError.message });
    throw new Error(`Storage bucket list failed: ${listError.message}`);
  }
  if (buckets?.some((row) => row.name === bucket)) {
    storageLog("ensureBucket:exists", { bucket });
    ensuredBucket = bucket;
    return bucket;
  }
  storageLog("ensureBucket:creating", { bucket });
  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: VISUALIZER_MAX_UPLOAD_BYTES,
  });
  if (createError && !/already exists/i.test(createError.message)) {
    storageLog("ensureBucket:create-failed", { message: createError.message });
    throw new Error(`Storage bucket create failed for ${bucket}: ${createError.message}`);
  }
  storageLog("ensureBucket:created-or-exists", { bucket, createMessage: createError?.message });
  // Brief pause so Supabase can finish provisioning before first object upload.
  await new Promise((r) => setTimeout(r, 400));
  const { data: bucketsAfter } = await supabase.storage.listBuckets();
  if (!bucketsAfter?.some((row) => row.name === bucket)) {
    storageLog("ensureBucket:not-visible-yet", { bucket });
    throw new Error(
      "Storage bucket is still being created. Wait a moment and try uploading again.",
    );
  }
  ensuredBucket = bucket;
  return bucket;
}

export async function uploadVisualizerBytes(input: {
  workspaceId: string;
  bytes: Buffer;
  mimeType: string;
  filename?: string;
  folder: "rooms" | "materials" | "generated" | "thumbnails";
}): Promise<{ path: string; bucket: string }> {
  storageLog("upload:start", {
    workspaceId: input.workspaceId,
    folder: input.folder,
    byteSize: input.bytes.length,
    mimeType: input.mimeType,
    filename: input.filename,
  });
  if (!isSupabaseConfigured()) {
    throw new Error("Image storage is not configured. Set Supabase storage for Visualizer uploads.");
  }
  const mime = normalizeVisualizerUploadMime(input.mimeType, input.filename);
  if (!VISUALIZER_ALLOWED_MIME.has(mime)) {
    storageLog("upload:rejected-mime", { mime, filename: input.filename });
    throw new Error("Use a JPG, PNG, WebP, or HEIC image.");
  }
  if (input.bytes.length > VISUALIZER_MAX_UPLOAD_BYTES) {
    throw new Error("Images must be 12 MB or smaller.");
  }
  const bucket = await ensureVisualizerBucket();
  const ext = extensionForMime(mime, input.filename);
  const now = new Date();
  const path = `${input.workspaceId}/${input.folder}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const supabase = getSupabaseAdmin();
  storageLog("upload:supabase-object", { bucket, path, mime });
  let lastError: string | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await supabase.storage.from(bucket).upload(path, input.bytes, {
      contentType: mime,
      upsert: false,
    });
    if (!error) {
      storageLog("upload:ok", { bucket, path, attempt });
      return { path, bucket };
    }
    lastError = error.message;
    storageLog("upload:attempt-failed", { attempt, message: error.message });
    if (attempt === 1 && /bucket/i.test(error.message)) {
      ensuredBucket = null;
      await ensureVisualizerBucket(bucket);
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  throw new Error(`Image upload failed: ${lastError || "unknown"}`);
}

export async function downloadVisualizerObject(bucket: string, path: string): Promise<Buffer> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`Could not download image: ${error?.message || "missing"}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function getVisualizerSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(`Could not sign image URL: ${error?.message || "missing"}`);
  }
  return data.signedUrl;
}

export function getVisualizerPublicUrl(bucket: string, path: string): string {
  const base = getSupabaseUrl().replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
