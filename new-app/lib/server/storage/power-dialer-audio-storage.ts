import "server-only";
import { randomUUID } from "crypto";

const BUCKET = process.env.POWER_DIALER_AUDIO_BUCKET?.trim() || "transovo-media";

function storageConfig() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Supabase storage is not configured for voicemail drops");
  return { url: url.replace(/\/$/, ""), key };
}

export async function uploadPowerDialerAudio(input: {
  workspaceId: string;
  bytes: Buffer;
  mimeType: string;
  filename: string;
}) {
  const { url, key } = storageConfig();
  const safeName = input.filename.replace(/[^\w.-]+/g, "_").slice(0, 80);
  const path = `${input.workspaceId}/power-dialer/${randomUUID()}-${safeName}`;

  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": input.mimeType || "application/octet-stream",
      "x-upsert": "false",
    },
    body: input.bytes,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Storage upload failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const storageUrl = `${url}/storage/v1/object/public/${BUCKET}/${path}`;
  return {
    storageUrl,
    mimeType: input.mimeType,
    sizeBytes: input.bytes.length,
  };
}
