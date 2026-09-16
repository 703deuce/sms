import "server-only";

import { getPrisma } from "@/lib/db";
import { loadVoiceV2CallContextRecord } from "../session/call-context-store";
import { reconcileVoiceV2PostCallRecord } from "./reconciliation";
import type { VoiceV2MultichannelTranscript, VoiceV2PinnedIntakeSnapshot } from "./types";

export async function runVoiceV2PostCallReconciliationJob(input: {
  workspaceId: string;
  callId: string;
  transcript: VoiceV2MultichannelTranscript;
}) {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { metadata: true, telnyxCallControlId: true },
  });
  if (!call) return { ok: false, reason: "call_not_found" };

  const sessionKey = call.telnyxCallControlId ? `cc:${call.telnyxCallControlId}` : `call:${input.callId}`;
  const recovered = await loadVoiceV2CallContextRecord(sessionKey);
  const payload = recovered?.payload;
  if (!payload) {
    await patchReconcileMeta(input.callId, { status: "FAILED", reason: "no_call_context" });
    return { ok: false, reason: "no_call_context" };
  }

  const pinned: VoiceV2PinnedIntakeSnapshot = {
    intakeSchema: payload.intakeSchema,
    intakeState: payload.intakeState,
    intakeSchemaRevision: payload.capabilities?.intakeSchemaRevision,
    callerAniE164: payload.callerAniE164,
    primaryOutcome: (call.metadata as Record<string, unknown>)?.voiceV2PrimaryOutcome as string,
  };

  const reconciled = reconcileVoiceV2PostCallRecord({
    pinned,
    transcript: input.transcript,
    providerLockedFields: [],
  });

  const prevMeta = (call.metadata || {}) as Record<string, unknown>;
  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: {
      metadata: {
        ...prevMeta,
        voiceV2PostCallReconciliation: {
          status: "COMPLETED",
          completedAt: new Date().toISOString(),
          recordComplete: reconciled.recordComplete,
          missingForRecord: reconciled.missingForRecord,
          needsReview: reconciled.needsReview,
          fields: reconciled.fields,
        },
        voiceV2ReconciledIntake: reconciled.reconciledIntake,
        voiceV2RecordComplete: reconciled.recordComplete,
        voiceV2MissingForRecord: reconciled.missingForRecord,
      },
    },
  });

  return { ok: true, recordComplete: reconciled.recordComplete };
}

async function patchReconcileMeta(callId: string, patch: Record<string, unknown>) {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({ where: { id: callId }, select: { metadata: true } });
  const prev = (call?.metadata || {}) as Record<string, unknown>;
  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      metadata: {
        ...prev,
        voiceV2PostCallReconciliation: {
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      },
    },
  });
}
