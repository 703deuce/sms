import "server-only";

import { getPrisma } from "@/lib/db";
import type { VoiceV2IntakeState } from "./types";

/** DEFER_AFTER_RESPONSE — idempotent upsert into VoiceCall.metadata.voiceV2Intake */
export function scheduleIntakePersistence(input: {
  workspaceId: string;
  sessionKey: string;
  callControlId: string | null;
  snapshot: VoiceV2IntakeState;
  updatedAt: string;
}): void {
  void persistIntakeSnapshot(input).catch((err) => {
    console.warn("[voice-v2/intake-persist]", err instanceof Error ? err.message : err);
  });
}

async function persistIntakeSnapshot(input: {
  workspaceId: string;
  callControlId: string | null;
  snapshot: VoiceV2IntakeState;
  updatedAt: string;
}): Promise<void> {
  if (!input.callControlId) return;
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { telnyxCallControlId: input.callControlId },
    select: { id: true, metadata: true },
  });
  if (!call) return;

  const meta = (call.metadata || {}) as Record<string, unknown>;
  const prev = (meta.voiceV2Intake || {}) as Record<string, unknown>;
  const prevAt = String(prev.updatedAt || "");
  if (prevAt && prevAt > input.updatedAt) return;

  await prisma.voiceCall.update({
    where: { id: call.id },
    data: {
      metadata: {
        ...meta,
        voiceV2Intake: {
          snapshot: input.snapshot,
          updatedAt: input.updatedAt,
        },
      },
    },
  });
}
