import "server-only";

import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  KIMI_IMAGE_MIME_TYPES,
  KIMI_MAX_IMAGE_BYTES,
  KIMI_MAX_VIDEO_BYTES,
  KIMI_VIDEO_MIME_TYPES,
} from "@/lib/ui-agent/reference-limits";

const DEFAULT_BUCKET = "ui-references";
export const UI_REFERENCES_MANIFEST_PATH = "manifest/references.json";

const VIDEO_TYPES = new Set<string>(KIMI_VIDEO_MIME_TYPES);
const IMAGE_TYPES = new Set<string>(KIMI_IMAGE_MIME_TYPES);

let ensuredBucket: string | null = null;

export function resolveUiReferencesBucket(): string {
  return process.env.SUPABASE_UI_REFERENCES_BUCKET?.trim() || DEFAULT_BUCKET;
}

export function isUiReferenceStorageConfigured(): boolean {
  return isSupabaseConfigured();
}

function assertMime(mimeType: string, kind: "video" | "image") {
  const mime = mimeType.toLowerCase();
  if (kind === "video" && !VIDEO_TYPES.has(mime)) {
    throw new Error("Video must be MP4, MOV, or WebM.");
  }
  if (kind === "image" && !IMAGE_TYPES.has(mime)) {
    throw new Error("Image must be PNG, JPG, or WebP.");
  }
}

export async function ensureUiReferencesBucket(bucket = resolveUiReferencesBucket()) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured for UI reference storage.");
  }
  if (ensuredBucket === bucket) return bucket;

  const supabase = getSupabaseAdmin();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`Storage bucket list failed: ${listError.message}`);

  if (!buckets?.some((row) => row.name === bucket)) {
    const { error: createError } = await supabase.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: KIMI_MAX_VIDEO_BYTES,
    });
    if (createError && !/already exists/i.test(createError.message)) {
      throw new Error(`Storage bucket create failed for ${bucket}: ${createError.message}`);
    }
  }

  ensuredBucket = bucket;
  return bucket;
}

export async function uploadUiReferenceToStorage(input: {
  name: string;
  kind: "video" | "image";
  bytes: Buffer;
  mimeType: string;
  filename?: string;
}): Promise<{ bucket: string; path: string }> {
  assertMime(input.mimeType, input.kind);
  const max = input.kind === "video" ? KIMI_MAX_VIDEO_BYTES : KIMI_MAX_IMAGE_BYTES;
  if (input.bytes.length > max) {
    throw new Error(`File exceeds ${input.kind === "video" ? "100MB" : "20MB"} limit.`);
  }

  const bucket = await ensureUiReferencesBucket();
  const ext = input.filename?.split(".").pop()?.toLowerCase() || (input.kind === "video" ? "mp4" : "png");
  const folder = input.kind === "video" ? "videos" : "images";
  const objectPath = `${folder}/${input.name}.${ext}`;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).upload(objectPath, input.bytes, {
    contentType: input.mimeType,
    upsert: true,
  });
  if (error) throw new Error(`UI reference upload failed: ${error.message}`);

  return { bucket, path: objectPath };
}

export async function createUiReferenceSignedUpload(input: {
  name: string;
  kind: "video" | "image";
  mimeType: string;
  filename?: string;
}): Promise<{ bucket: string; path: string; token: string; signedUrl: string | null }> {
  assertMime(input.mimeType, input.kind);
  const bucket = await ensureUiReferencesBucket();
  const ext = input.filename?.split(".").pop()?.toLowerCase() || (input.kind === "video" ? "mp4" : "png");
  const folder = input.kind === "video" ? "videos" : "images";
  const objectPath = `${folder}/${input.name}.${ext}`;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(objectPath, {
    upsert: true,
  });
  if (error || !data?.token) {
    throw new Error(`Signed upload URL failed: ${error?.message || "missing token"}`);
  }

  return {
    bucket,
    path: objectPath,
    token: data.token,
    signedUrl: data.signedUrl || null,
  };
}

export async function verifyUiReferenceObjectExists(input: {
  bucket: string;
  path: string;
}): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const folder = input.path.includes("/") ? input.path.slice(0, input.path.lastIndexOf("/")) : "";
  const filename = input.path.split("/").pop() || input.path;
  const { data, error } = await supabase.storage.from(input.bucket).list(folder, {
    limit: 100,
    search: filename,
  });
  if (error || !data?.length) return false;
  return data.some((row) => {
    const candidate = folder ? `${folder}/${row.name}` : row.name;
    return candidate === input.path;
  });
}

export async function readUiReferencesManifestFromStorage(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const bucket = resolveUiReferencesBucket();
    const bytes = await downloadUiReferenceFromStorage({ bucket, path: UI_REFERENCES_MANIFEST_PATH });
    return bytes.toString("utf8");
  } catch {
    return null;
  }
}

export async function writeUiReferencesManifestToStorage(json: string): Promise<void> {
  const bucket = await ensureUiReferencesBucket();
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).upload(UI_REFERENCES_MANIFEST_PATH, Buffer.from(json, "utf8"), {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw new Error(`Manifest save failed: ${error.message}`);
}

export async function downloadUiReferenceFromStorage(input: {
  bucket: string;
  path: string;
}): Promise<Buffer> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(input.bucket).download(input.path);
  if (error || !data) throw new Error(`UI reference download failed: ${error?.message || "missing object"}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteUiReferenceFromStorage(input: { bucket: string; path: string }): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(input.bucket).remove([input.path]);
  if (error) throw new Error(`UI reference delete failed: ${error.message}`);
}

export async function createUiReferenceSignedUrl(input: {
  bucket: string;
  path: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(input.bucket)
    .createSignedUrl(input.path, input.expiresInSeconds ?? 3600);
  if (error || !data?.signedUrl) {
    throw new Error(`Signed URL failed: ${error?.message || "unknown"}`);
  }
  return data.signedUrl;
}
