import "server-only";

import { getPrisma } from "@/lib/db";
import { loadVoiceV2CallContextRecord } from "../session/call-context-store";
import { resolveVoiceV2PrimaryOutcome } from "../primary-outcome";
import {
  buildReconciledCallSummaryText,
  persistFinalSummaryAfterReconciliation,
} from "./final-summary";
import { reconcileVoiceV2PostCallRecord } from "./reconciliation";
import { extractPostCallFieldCandidatesWithAi } from "./structured-extraction";
import type { VoiceV2MultichannelTranscript, VoiceV2PinnedIntakeSnapshot } from "./types";

function providerLockedFieldsFromOutcome(
  primaryOutcome?: string,
  schema?: import("../intake/types").VoiceV2IntakeSchema,
): string[] {
  if (primaryOutcome === "BOOKED" && schema) {
    return schema.fields.map((f) => f.key);
  }
  return [];
}

export async function runVoiceV2PostCallReconciliationJob(input: {
  workspaceId: string;
  callId: string;
  transcript: VoiceV2MultichannelTranscript;
}) {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { metadata: true, telnyxCallControlId: true, appointmentBooked: true },
  });
  if (!call) return { ok: false, reason: "call_not_found" };

  const sessionKey = call.telnyxCallControlId ? `cc:${call.telnyxCallControlId}` : `call:${input.callId}`;
  const recovered = await loadVoiceV2CallContextRecord(sessionKey);
  const payload = recovered?.payload;
  if (!payload) {
    await patchReconcileMeta(input.callId, { status: "FAILED", reason: "no_call_context" });
    return { ok: false, reason: "no_call_context" };
  }

  const meta = (call.metadata || {}) as Record<string, unknown>;
  const primaryOutcome =
    (meta.voiceV2PrimaryOutcome as string) ||
    (payload ? resolveVoiceV2PrimaryOutcome(payload) : "NONE");

  const pinned: VoiceV2PinnedIntakeSnapshot = {
    intakeSchema: payload.intakeSchema,
    intakeState: payload.intakeState,
    intakeSchemaRevision: payload.capabilities?.intakeSchemaRevision,
    callerAniE164: payload.callerAniE164,
    primaryOutcome,
  };

  const { candidates, extraction, source, extractionFailed } =
    await extractPostCallFieldCandidatesWithAi({
      pinnedSchema: pinned.intakeSchema,
      transcript: input.transcript,
      intakeState: pinned.intakeState,
      primaryOutcome,
    });

  if (extractionFailed) {
    await patchReconcileMeta(input.callId, {
      status: "EXTRACTION_FAILED",
      reason: "llm_extraction_unavailable",
      extractionSource: source,
    });
    return { ok: false, reason: "extraction_failed" };
  }

  const locked = providerLockedFieldsFromOutcome(primaryOutcome, pinned.intakeSchema);

  const reconciled = reconcileVoiceV2PostCallRecord({
    pinned,
    transcript: input.transcript,
    providerLockedFields: locked as import("../intake/types").IntakeFieldKey[],
    candidates,
  });

  const summary = buildReconciledCallSummaryText({
    intakeSchema: pinned.intakeSchema,
    reconciledIntake: reconciled.reconciledIntake,
    primaryOutcome,
    transcript: input.transcript,
  });

  await persistFinalSummaryAfterReconciliation({
    workspaceId: input.workspaceId,
    callId: input.callId,
    summary,
    reconciledIntake: reconciled.reconciledIntake,
    intakeSchema: pinned.intakeSchema,
    recordComplete: reconciled.recordComplete,
    missingForRecord: reconciled.missingForRecord,
    needsReview: reconciled.needsReview,
  });

  const prevMeta = meta;
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
          extractionSource: source,
          structuredExtraction: extraction
            ? {
                provider: extraction.provider,
                model: extraction.model,
                fieldCount: extraction.fields.length,
              }
            : null,
        },
        voiceV2ReconciledIntake: reconciled.reconciledIntake,
        voiceV2RecordComplete: reconciled.recordComplete,
        voiceV2MissingForRecord: reconciled.missingForRecord,
      },
    },
  });

  return { ok: true, recordComplete: reconciled.recordComplete, summary };
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
