import "server-only";

import { getPrisma } from "@/lib/server/db";

export type VoiceV3AppointmentRequestPersistInput = {
  workspaceId: string;
  agentId: string | null;
  callId: string;
  liveSessionId: string;
  callerName: string | null;
  callerPhoneE164: string;
  preferredTime: string | null;
  reason: string | null;
  customFieldsSnapshot: Record<string, unknown>;
  idempotencyKey: string;
  businessE164: string | null;
  phoneNumberId: string | null;
};

export type VoiceV3AppointmentRequestPersistResult =
  | { ok: true; requestId: string; duplicate: boolean }
  | { ok: false; retryable: boolean; message: string };

export async function persistVoiceV3AppointmentRequest(
  input: VoiceV3AppointmentRequestPersistInput,
): Promise<VoiceV3AppointmentRequestPersistResult> {
  const prisma = getPrisma();
  const existing = await prisma.callbackRequest.findFirst({
    where: {
      workspaceId: input.workspaceId,
      metadata: {
        path: ["voiceV3", "idempotencyKey"],
        equals: input.idempotencyKey,
      },
    },
    select: { id: true },
  });
  if (existing) {
    return { ok: true, requestId: existing.id, duplicate: true };
  }

  try {
    const row = await prisma.callbackRequest.create({
      data: {
        workspaceId: input.workspaceId,
        callerE164: input.callerPhoneE164,
        businessE164: input.businessE164,
        phoneNumberId: input.phoneNumberId,
        reason: input.reason,
        notes: input.preferredTime ? `Preferred: ${input.preferredTime}` : null,
        status: "new",
        sourceRoute: "voice_v3_appointment_request",
        metadata: {
          source: "VOICE_V3",
          voiceV3: {
            idempotencyKey: input.idempotencyKey,
            lifecycleStatus: "APPOINTMENT_REQUESTED",
            callId: input.callId,
            liveSessionId: input.liveSessionId,
            agentId: input.agentId,
            callerName: input.callerName,
            preferredTime: input.preferredTime,
            customFieldsSnapshot: input.customFieldsSnapshot,
          },
        },
      },
      select: { id: true },
    });
    return { ok: true, requestId: row.id, duplicate: false };
  } catch (err) {
    return {
      ok: false,
      retryable: true,
      message: err instanceof Error ? err.message : "Appointment request persistence failed.",
    };
  }
}
