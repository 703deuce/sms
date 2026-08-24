import { getPrisma } from "@/lib/db";
import type { MediaBackend, ResolveMediaBackendContext } from "./types";
import { getMediaBackendMode } from "./config";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function parseMediaBackend(value: unknown): MediaBackend | null {
  if (value === "self_hosted" || value === "livekit_cloud") return value;
  return null;
}

/** Sync selector — default `livekit_cloud` preserves pre-migration behavior. */
export function getActiveMediaBackend(): MediaBackend {
  return getMediaBackendMode();
}

export async function getPinnedMediaBackendForCall(
  callId: string,
): Promise<MediaBackend | null> {
  const prisma = getPrisma();
  const row = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  const meta = asRecord(row?.metadata);
  return parseMediaBackend(meta.mediaBackend);
}

/**
 * Resolve which LiveKit media backend should handle a call.
 * Active calls must use getPinnedMediaBackendForCall instead.
 */
export async function resolveMediaBackend(
  context: ResolveMediaBackendContext = {},
): Promise<MediaBackend> {
  if (context.callId) {
    const pinned = await getPinnedMediaBackendForCall(context.callId);
    if (pinned) return pinned;
  }

  if (context.forceBackend) return context.forceBackend;
  if (context.mediaBackend) return context.mediaBackend;

  return getActiveMediaBackend();
}
