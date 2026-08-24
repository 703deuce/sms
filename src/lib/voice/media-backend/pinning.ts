import { getPrisma } from "@/lib/db";
import type { MediaBackend } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function pinMediaBackendOnCall(input: {
  callId: string;
  mediaBackend: MediaBackend;
}): Promise<void> {
  const prisma = getPrisma();
  const existing = await prisma.voiceCall.findUnique({
    where: { id: input.callId },
    select: { metadata: true },
  });
  if (!existing) return;

  const prior = asRecord(existing.metadata);
  if (prior.mediaBackend === input.mediaBackend) return;

  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: {
      metadata: {
        ...prior,
        mediaBackend: input.mediaBackend,
      } as object,
    },
  });
}

export function mediaBackendMetadataStamp(
  mediaBackend: MediaBackend,
): Record<string, unknown> {
  return { mediaBackend };
}
