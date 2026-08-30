import "server-only";

import { access, copyFile, mkdir, readFile, rename } from "fs/promises";
import path from "path";
import { getSupabaseAdmin, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/admin";
import { atomicWriteFile } from "@/lib/fs/atomic-write";

const DEFAULT_BUCKET = "voicemail-greetings";
const ACTIVE_OBJECT = "active.mp3";

let ensuredBucket: string | null = null;

export function resolveVoicemailGreetingBucket(): string {
  return process.env.SUPABASE_VOICEMAIL_GREETINGS_BUCKET?.trim() || DEFAULT_BUCKET;
}

export function voicemailGreetingsDiskRoot(): string {
  return (
    process.env.VOICEMAIL_GREETINGS_DIR?.trim() ||
    path.join(process.cwd(), "public", "voicemail")
  );
}

function objectPath(greetingToken: string): string {
  return `${greetingToken}/${ACTIVE_OBJECT}`;
}

function diskDir(greetingToken: string): string {
  return path.join(voicemailGreetingsDiskRoot(), greetingToken);
}

function diskActivePath(greetingToken: string): string {
  return path.join(diskDir(greetingToken), ACTIVE_OBJECT);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureVoicemailGreetingBucket(
  bucket = resolveVoicemailGreetingBucket(),
): Promise<string> {
  if (!isSupabaseConfigured()) return bucket;
  if (ensuredBucket === bucket) return bucket;

  const supabase = getSupabaseAdmin();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`Storage bucket list failed: ${listError.message}`);

  if (buckets?.some((row) => row.name === bucket)) {
    ensuredBucket = bucket;
    return bucket;
  }

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/webm"],
  });
  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(`Storage bucket create failed for ${bucket}: ${createError.message}`);
  }
  ensuredBucket = bucket;
  return bucket;
}

/** Durable public URL — stable forever; object content replaced on Save. */
export function resolveDurableVoicemailActivePublicUrl(greetingToken: string): string | null {
  if (!isSupabaseConfigured()) return null;
  const bucket = resolveVoicemailGreetingBucket();
  const base = getSupabaseUrl().replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${bucket}/${objectPath(greetingToken)}`;
}

export function resolveLocalVoicemailActivePublicUrl(
  greetingToken: string,
  appBaseUrl: string,
): string {
  const base = appBaseUrl.replace(/\/$/, "");
  return `${base}/voicemail/${greetingToken}/${ACTIVE_OBJECT}`;
}

/**
 * Atomic replace of active.mp3 — Supabase upsert when configured, else local disk swap.
 */
export async function writeVoicemailActiveMp3(input: {
  greetingToken: string;
  bytes: Buffer;
}): Promise<{ storage: "supabase" | "disk"; publicUrl: string }> {
  if (input.bytes.length < 256) {
    throw new Error(`voicemail greeting too small (${input.bytes.length} bytes)`);
  }

  if (isSupabaseConfigured()) {
    const bucket = await ensureVoicemailGreetingBucket();
    const supabase = getSupabaseAdmin();
    const objPath = objectPath(input.greetingToken);
    const archivePath = `${input.greetingToken}/archive-${Date.now()}.mp3`;

    const { data: existing } = await supabase.storage.from(bucket).download(objPath);
    if (existing) {
      const archiveBytes = Buffer.from(await existing.arrayBuffer());
      await supabase.storage.from(bucket).upload(archivePath, archiveBytes, {
        contentType: "audio/mpeg",
        upsert: true,
      });
    }

    const { error } = await supabase.storage.from(bucket).upload(objPath, input.bytes, {
      contentType: "audio/mpeg",
      upsert: true,
      cacheControl: "0",
    });
    if (error) throw new Error(`Voicemail upload failed: ${error.message}`);

    const publicUrl = resolveDurableVoicemailActivePublicUrl(input.greetingToken);
    if (!publicUrl) throw new Error("Voicemail public URL unavailable");
    return { storage: "supabase", publicUrl };
  }

  const dir = diskDir(input.greetingToken);
  await mkdir(dir, { recursive: true });
  const activePath = diskActivePath(input.greetingToken);
  const tmpPath = path.join(dir, "new.tmp");

  await atomicWriteFile(tmpPath, input.bytes);
  if (await fileExists(activePath)) {
    await copyFile(activePath, path.join(dir, `archive-${Date.now()}.mp3`));
    await rename(activePath, path.join(dir, "previous.mp3"));
  }
  await rename(tmpPath, activePath);

  const { resolveStableVoicemailGreetingPlayUrl } = await import("./voicemail-active-greeting");
  return {
    storage: "disk",
    publicUrl: resolveStableVoicemailGreetingPlayUrl(input.greetingToken),
  };
}

export async function readVoicemailActiveMp3Bytes(greetingToken: string): Promise<Buffer | null> {
  if (isSupabaseConfigured()) {
    const bucket = resolveVoicemailGreetingBucket();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage.from(bucket).download(objectPath(greetingToken));
    if (!error && data) return Buffer.from(await data.arrayBuffer());
  }

  const diskPath = diskActivePath(greetingToken);
  if (await fileExists(diskPath)) return readFile(diskPath);
  return null;
}
