import "server-only";

import { getPrisma } from "@/lib/db";
import type { VoiceV3CallbackPersistInput, VoiceV3CallbackPersistResult } from "./types";
import { callbackSlaMetadataPatch } from "@/lib/voice-receptionist-wizard/operating-maturity/callback-sla";

const V3_METADATA_SOURCE = "VOICE_V3";

export async function persistVoiceV3CallbackRequest(
  input: VoiceV3CallbackPersistInput,
): Promise<VoiceV3CallbackPersistResult> {
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
    console.log("VOICE_V3_CALLBACK_REQUEST_DUPLICATE", {
      callId: input.callId,
      workspaceId: input.workspaceId,
      callbackRequestId: existing.id,
    });
    return { ok: true, callbackRequestId: existing.id, duplicate: true };
  }

  try {
    const slaPatch =
      input.callbackSlaPolicy
        ? callbackSlaMetadataPatch({
            policy: input.callbackSlaPolicy,
            urgency: input.urgencySeverity,
            sourceVoiceCallId: input.callId,
            preferredWindow: input.preferredTime ?? undefined,
          })
        : {};

    const row = await prisma.callbackRequest.create({
      data: {
        workspaceId: input.workspaceId,
        callerE164: input.callbackPhoneE164,
        businessE164: input.businessE164,
        phoneNumberId: input.phoneNumberId,
        reason: input.reason,
        notes: input.notes,
        status: "new",
        sourceRoute: "voice_v3_request_callback",
        metadata: {
          source: V3_METADATA_SOURCE,
          ...slaPatch,
          voiceV3: {
            idempotencyKey: input.idempotencyKey,
            lifecycleStatus: "REQUESTED",
            callId: input.callId,
            liveSessionId: input.liveSessionId,
            agentId: input.agentId,
            callerName: input.callerName,
            inboundAni: input.inboundAni,
            preferredCallbackTime: input.preferredTime,
            customFieldsSnapshot: input.customFieldsSnapshot,
          },
        },
      },
      select: { id: true },
    });
    console.log("VOICE_V3_CALLBACK_REQUEST_PERSISTED", {
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callbackRequestId: row.id,
    });
    return { ok: true, callbackRequestId: row.id, duplicate: false };
  } catch (err) {
    console.error("VOICE_V3_CALLBACK_REQUEST_FAILED", {
      callId: input.callId,
      workspaceId: input.workspaceId,
      message: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      retryable: true,
      message: err instanceof Error ? err.message : "Callback persistence failed.",
    };
  }
}
