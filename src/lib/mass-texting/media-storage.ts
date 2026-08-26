import "server-only";

import { getSupabaseAdmin, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  MASS_TEXT_MMS_ALLOWED_TYPES,
  MASS_TEXT_MMS_MAX_BYTES,
} from "@/lib/mass-texting/mms";

const DEFAULT_BUCKET = "mms-media";

let ensuredBucket: string | null = null;

export function resolveMmsMediaBucket(): string {
  return process.env.SUPABASE_MMS_MEDIA_BUCKET?.trim() || DEFAULT_BUCKET;
}

function extensionForMime(mimeType: string, filename?: string) {
  const fromName = filename?.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "gif", "webp"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("webp")) return "webp";
  return "jpg";
}

export async function ensureMmsMediaBucket(bucket = resolveMmsMediaBucket()) {
  if (ensuredBucket === bucket) return bucket;
  const supabase = getSupabaseAdmin();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Storage bucket list failed: ${listError.message}`);
  }
  if (buckets?.some((row) => row.name === bucket)) {
    ensuredBucket = bucket;
    return bucket;
  }
  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: MASS_TEXT_MMS_MAX_BYTES,
    allowedMimeTypes: [...MASS_TEXT_MMS_ALLOWED_TYPES],
  });
  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(`Storage bucket create failed for ${bucket}: ${createError.message}`);
  }
  ensuredBucket = bucket;
  return bucket;
}

export async function uploadMmsImageToStorage(input: {
  workspaceId: string;
  bytes: Buffer;
  mimeType: string;
  filename?: string;
}): Promise<{ storageUrl: string; path: string; bucket: string }> {
  if (!isSupabaseConfigured()) {
    throw new Error("File upload is not configured. Paste a public HTTPS image URL instead.");
  }
  const mime = input.mimeType.toLowerCase();
  if (!MASS_TEXT_MMS_ALLOWED_TYPES.includes(mime as (typeof MASS_TEXT_MMS_ALLOWED_TYPES)[number])) {
    throw new Error("Use a JPG, PNG, GIF, or WebP image.");
  }
  if (input.bytes.length > MASS_TEXT_MMS_MAX_BYTES) {
    throw new Error("Images must be 1.5 MB or smaller for MMS.");
  }

  const bucket = await ensureMmsMediaBucket();
  const ext = extensionForMime(mime, input.filename);
  const now = new Date();
  const path = `${input.workspaceId}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${Date.now()}.${ext}`;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).upload(path, input.bytes, {
    contentType: mime,
    upsert: false,
  });
  if (error) throw new Error(`Image upload failed: ${error.message}`);

  const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  const fallback = `${getSupabaseUrl().replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${path}`;
  return { storageUrl: publicUrl || fallback, path, bucket };
}
