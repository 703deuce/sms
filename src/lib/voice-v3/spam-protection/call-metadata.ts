import "server-only";

import { getPrisma } from "@/lib/db";
import type { VoiceV3SpamLikelyPolicy } from "./types";

export type VoiceV3ScreeningCallMetadata = {
  carrierScreeningRaw?: string | null;
  carrierScreeningNormalized?: string | null;
  suspectedSpamLikely?: boolean;
  spamLikelyPolicy?: VoiceV3SpamLikelyPolicy | null;
  transovoOutcome?: string | null;
  customerBillable?: boolean | null;
  classifiedAt?: string | null;
};

export function readVoiceV3ScreeningFromCallMetadata(
  metadata: unknown,
): VoiceV3ScreeningCallMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const root = metadata as Record<string, unknown>;
  const raw = root.voiceV3Screening;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as VoiceV3ScreeningCallMetadata;
}

export function hasCarrierScreeningEvidence(meta: VoiceV3ScreeningCallMetadata | null): boolean {
  if (!meta) return false;
  return Boolean(
    meta.carrierScreeningNormalized &&
      meta.carrierScreeningNormalized !== "unknown" &&
      meta.carrierScreeningRaw,
  );
}

export async function mergeVoiceV3ScreeningOnCall(input: {
  workspaceId: string;
  callId: string;
  patch: Partial<VoiceV3ScreeningCallMetadata>;
}): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { id: true, metadata: true },
  });
  if (!call) return;

  const prev =
    call.metadata && typeof call.metadata === "object" && !Array.isArray(call.metadata)
      ? (call.metadata as Record<string, unknown>)
      : {};
  const prevScreening = readVoiceV3ScreeningFromCallMetadata(prev) || {};

  await prisma.voiceCall.update({
    where: { id: call.id },
    data: {
      metadata: {
        ...prev,
        voiceV3Screening: {
          ...prevScreening,
          ...input.patch,
        },
      } as object,
    },
  });
}
