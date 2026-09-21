import "server-only";

import { getPrisma } from "@/lib/db";
import {
  readVoiceV3ScreeningFromCallMetadata,
  type VoiceV3ScreeningCallMetadata,
} from "./screening-call-metadata";

export type { VoiceV3ScreeningCallMetadata } from "./screening-call-metadata";
export { hasCarrierScreeningEvidence, readVoiceV3ScreeningFromCallMetadata } from "./screening-call-metadata";

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
