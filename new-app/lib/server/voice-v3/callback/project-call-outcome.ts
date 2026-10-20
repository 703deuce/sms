import "server-only";

import { getPrisma } from "@/lib/server/db";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Project message-taking outcome onto VoiceCall for Calls Inbox (best-effort). */
export async function projectVoiceV3MessageOntoCall(input: {
  callId: string;
  callbackRequestId: string;
  reason?: string | null;
}): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: input.callId },
    select: { id: true, metadata: true, outcome: true },
  });
  if (!call) return;

  const meta = asRecord(call.metadata);
  const voiceV3 = asRecord(meta.voiceV3);
  voiceV3.callbackRequestId = input.callbackRequestId;
  voiceV3.messageText = input.reason?.trim() || null;
  voiceV3.messageTaken = true;
  meta.voiceV3 = voiceV3;

  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: {
      metadata: meta as object,
      outcome: "message_left",
    },
  });
}

/** Project authoritative callback outcome onto VoiceCall for Calls Inbox (best-effort). */
export async function projectVoiceV3CallbackOntoCall(input: {
  callId: string;
  callbackRequestId: string;
  reason?: string | null;
}): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: input.callId },
    select: { id: true, metadata: true, outcome: true },
  });
  if (!call) return;

  const meta = asRecord(call.metadata);
  const voiceV3 = asRecord(meta.voiceV3);
  voiceV3.callbackRequestId = input.callbackRequestId;
  voiceV3.callbackReason = input.reason?.trim() || null;
  meta.voiceV3 = voiceV3;

  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: {
      metadata: meta as object,
      outcome: call.outcome?.includes("callback") ? call.outcome : "callback_requested",
    },
  });
}
