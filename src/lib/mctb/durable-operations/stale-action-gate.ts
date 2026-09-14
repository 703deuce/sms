import "server-only";

import { getPrisma } from "@/lib/db";

export async function assertVoiceBookingWriteNotStale(input: {
  voiceCallId: string;
  expectedActionEpoch?: number | null;
  operationStatus?: string | null;
}): Promise<{ ok: true } | { ok: false; reason: string; customerMessage: string }> {
  if (input.operationStatus === "CANCELLED") {
    return {
      ok: false,
      reason: "OPERATION_CANCELLED",
      customerMessage: "Okay — I won't book that. What time works better for you?",
    };
  }
  if (input.expectedActionEpoch == null) {
    return { ok: true };
  }
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: input.voiceCallId },
    select: { metadata: true },
  });
  const meta = (call?.metadata || {}) as Record<string, unknown>;
  const currentEpoch = Number(meta.voiceBookingActionEpoch ?? meta.voiceBookingWriteEpoch ?? 0);
  if (currentEpoch !== input.expectedActionEpoch) {
    return {
      ok: false,
      reason: "STALE_ACTION",
      customerMessage: "That request changed while I was working on it. What would you like to do now?",
    };
  }
  return { ok: true };
}

export async function bumpVoiceBookingActionEpoch(voiceCallId: string): Promise<number> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: voiceCallId },
    select: { metadata: true },
  });
  const meta = (call?.metadata || {}) as Record<string, unknown>;
  const epoch = Number(meta.voiceBookingActionEpoch ?? meta.voiceBookingWriteEpoch ?? 0) + 1;
  await prisma.voiceCall.update({
    where: { id: voiceCallId },
    data: {
      metadata: {
        ...meta,
        voiceBookingActionEpoch: epoch,
        voiceBookingActionEpochAt: new Date().toISOString(),
      } as object,
    },
  });
  return epoch;
}
