import "server-only";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const BUCKET = process.env.POWER_DIALER_AUDIO_BUCKET?.trim() || "transovo-media";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/webm", "audio/ogg"]);

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Supabase storage is not configured for power-dialer audio uploads");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function uploadPowerDialerAudio(input: {
  workspaceId: string;
  bytes: Buffer;
  mimeType: string;
  filename?: string;
}): Promise<{ storageUrl: string; sizeBytes: number; mimeType: string }> {
  const mime = input.mimeType.toLowerCase();
  if (!ALLOWED.has(mime)) throw new Error("Unsupported audio type");
  if (input.bytes.length > MAX_BYTES) throw new Error("File too large (max 5MB)");

  const ext = input.filename?.split(".").pop()?.toLowerCase() || "mp3";
  const path = `power-dialer/${input.workspaceId}/${randomUUID()}.${ext}`;
  const supabase = admin();

  const { error } = await supabase.storage.from(BUCKET).upload(path, input.bytes, {
    contentType: mime,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data.publicUrl) throw new Error("Could not resolve public URL");
  return { storageUrl: data.publicUrl, sizeBytes: input.bytes.length, mimeType: mime };
}
