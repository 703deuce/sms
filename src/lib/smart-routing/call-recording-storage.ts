import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

const DEFAULT_BUCKET = "call-recordings";

export async function uploadCallRecordingToStorage(input: {
  workspaceId: string;
  callId: string;
  bytes: Buffer;
  mimeType?: string;
  extension?: string;
}) {
  const bucket = process.env.SUPABASE_CALL_RECORDINGS_BUCKET?.trim() || DEFAULT_BUCKET;
  const ext = input.extension || "mp3";
  const now = new Date();
  const path = `${input.workspaceId}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${input.callId}/${Date.now()}.${ext}`;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).upload(path, input.bytes, {
    contentType: input.mimeType || "audio/mpeg",
    upsert: false,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  return { bucket, path };
}

export async function createSignedRecordingUrl(bucket: string, path: string, expiresIn = 3600) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}

export async function deleteRecordingFromStorage(bucket: string, path: string) {
  const supabase = getSupabaseAdmin();
  await supabase.storage.from(bucket).remove([path]);
}
