import "server-only";

import { getPrisma } from "@/lib/db";
import { loadVoiceV2CallContextRecord } from "../session/call-context-store";
import { resolveVoiceV2PrimaryOutcome } from "../primary-outcome";
import {
  classifyPostCallFrictionFromTranscript,
  flattenTranscriptForFriction,
} from "./post-call-friction-classifier";
import {
  detectRealtimeFrictionSignals,
  mergeFrictionSignals,
} from "./friction";
import { normalizeVoiceV2ResolutionAudit } from "./resolution-audit";
import type { VoiceV2CallQualityRecord, VoiceV2OperatingState } from "./types";

export async function persistVoiceV2CallQualityOnHangup(input: {
  callId: string;
  workspaceId: string;
  transcript?: unknown;
}): Promise<VoiceV2CallQualityRecord | null> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: {
      id: true,
      metadata: true,
      durationSeconds: true,
      telnyxCallControlId: true,
      outcome: true,
      isTest: true,
    },
  });
  if (!call) return null;

  const meta = (call.metadata || {}) as Record<string, unknown>;
  const sessionKey = call.telnyxCallControlId
    ? `cc:${call.telnyxCallControlId}`
    : `call:${call.id}`;
  const recovered = await loadVoiceV2CallContextRecord(sessionKey);
  const ctx = recovered?.payload;

  const realtime = ctx
    ? detectRealtimeFrictionSignals({ ctx, callMeta: meta })
    : detectRealtimeFrictionSignals({
        ctx: {
          intakeState: {},
          askedFields: {},
          intakeSchema: { fields: [], revision: "empty" },
          callerAniE164: "",
          capabilities: {},
        } as import("../intake/types").VoiceV2CallContext,
        callMeta: meta,
      });

  const transcriptPayload =
    input.transcript ??
    meta.voiceV2PostCallTranscript ??
    meta.voiceV2MultichannelTranscript;
  const transcriptText = flattenTranscriptForFriction(transcriptPayload);
  const postCallFriction = transcriptText
    ? classifyPostCallFrictionFromTranscript(transcriptText)
    : null;
  const frictionSignals = mergeFrictionSignals(realtime, postCallFriction);

  const resolutionStatus = normalizeVoiceV2ResolutionAudit({
    ctx: ctx ?? undefined,
    callMeta: meta,
    durationSeconds: call.durationSeconds ?? 0,
  });

  const primaryOutcome =
    (meta.voiceV2PrimaryOutcome as string) ||
    (ctx ? resolveVoiceV2PrimaryOutcome(ctx) : call.outcome || "NONE");

  const operatingState = (meta.voiceV2OperatingState ||
    ctx?.afterHours?.operating?.state) as VoiceV2OperatingState | undefined;

  const callbackMeta = meta.voiceV2CallbackSla as Record<string, unknown> | undefined;

  const quality: VoiceV2CallQualityRecord = {
    primaryOutcome: String(primaryOutcome),
    resolutionStatus,
    operatingState,
    frictionSignals,
    recoveryStatus: meta.voiceV2AiCallRecoverySent === true ? "SENT" : undefined,
    callbackStatus: callbackMeta?.lifecycle
      ? String(callbackMeta.lifecycle)
      : undefined,
    humanRequested: meta.voiceV2HumanRequest === true,
    aiRefusal: meta.voiceV2DeclinedAiChannel === true,
    providerFailure: meta.voiceV2ProviderFailure === true,
    transferFailure: ctx?.afterHours?.transfer?.status === "FAILED",
    recordCompleteness:
      typeof meta.voiceV2RecordComplete === "boolean"
        ? meta.voiceV2RecordComplete
          ? 1
          : 0
        : undefined,
  };

  await prisma.voiceCall.update({
    where: { id: call.id },
    data: {
      metadata: {
        ...meta,
        voiceV2Quality: quality,
        voiceV2ResolutionStatus: resolutionStatus,
        voiceV2FrictionPersistedAt: new Date().toISOString(),
      } as object,
    },
  });

  return quality;
}
