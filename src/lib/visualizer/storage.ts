import "server-only";

import { getSupabaseAdmin, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  VISUALIZER_ALLOWED_MIME,
  VISUALIZER_BUCKET,
  VISUALIZER_MAX_UPLOAD_BYTES,
} from "@/lib/visualizer/constants";

let ensuredBucket: string | null = null;

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
  if (ensuredBucket === bucket) return bucket;
  const supabase = getSupabaseAdmin();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`Storage bucket list failed: ${listError.message}`);
  if (buckets?.some((row) => row.name === bucket)) {
    ensuredBucket = bucket;
    return bucket;
  }
  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: VISUALIZER_MAX_UPLOAD_BYTES,
  });
  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(`Storage bucket create failed for ${bucket}: ${createError.message}`);
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
  if (!isSupabaseConfigured()) {
    throw new Error("Image storage is not configured. Set Supabase storage for Visualizer uploads.");
  }
  const mime = input.mimeType.toLowerCase();
  if (!VISUALIZER_ALLOWED_MIME.has(mime)) {
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
  const { error } = await supabase.storage.from(bucket).upload(path, input.bytes, {
    contentType: mime,
    upsert: false,
  });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  return { path, bucket };
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
