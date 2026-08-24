import { getPrisma } from "@/lib/db";
import type { MediaBackend, ResolveMediaBackendContext } from "./types";
import {
  getMediaBackendMode,
  getSelfHostedTestDid,
  isMediaBackendConfigured,
} from "./config";
import { isMediaBackendHealthy, probeMediaBackendHealth } from "./health";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function parseMediaBackend(value: unknown): MediaBackend | null {
  if (value === "self_hosted" || value === "livekit_cloud") return value;
  return null;
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

export function inferMediaBackendFromDid(toE164?: string | null): MediaBackend | null {
  const testDid = getSelfHostedTestDid();
  if (testDid && toE164 && toE164.replace(/\s/g, "") === testDid.replace(/\s/g, "")) {
    return "self_hosted";
  }
  return null;
}

/**
 * Resolve which LiveKit media backend should handle a NEW call.
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

  const mode = getMediaBackendMode();
  if (mode === "self_hosted") return "self_hosted";
  if (mode === "livekit_cloud") return "livekit_cloud";

  const didHint = inferMediaBackendFromDid(context.toE164);
  if (didHint) return didHint;

  if (isMediaBackendConfigured("self_hosted")) {
    const healthy = await isMediaBackendHealthy("self_hosted");
    if (healthy) return "self_hosted";
  }

  return "livekit_cloud";
}

export async function getMediaBackendHealthReport(): Promise<{
  mode: ReturnType<typeof getMediaBackendMode>;
  backends: Awaited<ReturnType<typeof probeMediaBackendHealth>>[];
  resolvedDefault: MediaBackend;
}> {
  const mode = getMediaBackendMode();
  const backends: Awaited<ReturnType<typeof probeMediaBackendHealth>>[] = [];
  for (const backend of ["self_hosted", "livekit_cloud"] as const) {
    if (isMediaBackendConfigured(backend)) {
      backends.push(await probeMediaBackendHealth(backend));
    }
  }
  const resolvedDefault = await resolveMediaBackend();
  return { mode, backends, resolvedDefault };
}
