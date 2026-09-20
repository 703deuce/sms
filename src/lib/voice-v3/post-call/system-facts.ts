import "server-only";

import { getPrisma } from "@/lib/db";
import { readVoiceV3ScreeningFromCallMetadata } from "@/lib/voice-v3/spam-protection/call-metadata";

export type VoiceV3PostCallSystemFacts = {
  callId: string;
  workspaceId: string;
  outcome: string | null;
  appointmentBooked: boolean;
  transferred: boolean;
  transferConnected: boolean | null;
  transferFailed: boolean | null;
  callbackRequested: boolean;
  voicemailDetected: boolean;
  screeningOutcome: string | null;
  customerBillable: boolean | null;
  durationSeconds: number | null;
  callerE164: string | null;
  callerName: string | null;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function loadVoiceV3PostCallSystemFacts(
  callId: string,
): Promise<VoiceV3PostCallSystemFacts | null> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    include: {
      contact: { select: { firstName: true, lastName: true, phone: true } },
      transfers: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });
  if (!call) return null;

  const screening = readVoiceV3ScreeningFromCallMetadata(call.metadata);
  const transfer = call.transfers[0];
  const transferConnected = transfer ? transfer.status === "completed" && transfer.answered : null;
  const transferFailed =
    transfer
      ? transfer.status === "failed" ||
        (transfer.status === "completed" && !transfer.answered)
      : null;

  const meta = asRecord(call.metadata);
  const callbackRequest = await prisma.callbackRequest.findFirst({
    where: {
      workspaceId: call.workspaceId,
      metadata: { path: ["voiceV3", "callId"], equals: callId },
    },
    select: { id: true },
  });

  const callerName = call.contact
    ? [call.contact.firstName, call.contact.lastName].filter(Boolean).join(" ")
    : null;

  return {
    callId: call.id,
    workspaceId: call.workspaceId,
    outcome: call.outcome,
    appointmentBooked: call.appointmentBooked,
    transferred: call.transferred,
    transferConnected,
    transferFailed,
    callbackRequested: Boolean(callbackRequest),
    voicemailDetected: call.voicemailDetected,
    screeningOutcome: screening?.transovoOutcome ?? null,
    customerBillable: screening?.customerBillable ?? null,
    durationSeconds: call.durationSeconds,
    callerE164: call.fromE164,
    callerName: callerName || null,
  };
}
