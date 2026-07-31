import { createHmac, timingSafeEqual } from "crypto";
import { getPrisma } from "@/lib/db";

const DEFAULT_TTL_SEC = Number(process.env.VOICE_RECORDING_URL_TTL_SEC || 3600);

function signingKey() {
  const secret = process.env.INTEGRATION_SECRET_KEY?.trim() || "transovo-dev-recording-key";
  return createHmac("sha256", secret).update("voice-recording").digest();
}

export function createRecordingAccessToken(recordingId: string, workspaceId: string, ttlSec = DEFAULT_TTL_SEC) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${recordingId}:${workspaceId}:${exp}`;
  const sig = createHmac("sha256", signingKey()).update(payload).digest("hex");
  return { token: `${payload}:${sig}`, expiresAt: exp };
}

export function verifyRecordingAccessToken(token: string): { recordingId: string; workspaceId: string } | null {
  const parts = token.split(":");
  if (parts.length < 4) return null;
  const exp = Number(parts[2]);
  if (!exp || exp < Math.floor(Date.now() / 1000)) return null;
  const recordingId = parts[0];
  const workspaceId = parts[1];
  const sig = parts.slice(3).join(":");
  const payload = `${recordingId}:${workspaceId}:${exp}`;
  const expected = createHmac("sha256", signingKey()).update(payload).digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return { recordingId, workspaceId };
}

export async function getSignedRecordingUrl(
  workspaceId: string,
  recordingId: string,
  requesterUserId: string,
) {
  const { requireVoicePermission } = await import("./permissions");
  await requireVoicePermission(requesterUserId, workspaceId, "view_recordings");

  const prisma = getPrisma();
  const rec = await prisma.voiceRecording.findFirst({
    where: { id: recordingId, workspaceId },
  });
  if (!rec?.storageUrl) throw new Error("Recording not available");

  const { token, expiresAt } = createRecordingAccessToken(recordingId, workspaceId);
  const base = process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  return {
    url: `${base}/api/voice/recordings/${recordingId}/stream?token=${encodeURIComponent(token)}`,
    directUrl: rec.storageUrl,
    expiresAt,
    channels: rec.channels || 1,
  };
}
