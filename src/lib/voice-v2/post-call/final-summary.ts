import "server-only";

import { getPrisma } from "@/lib/db";
import type { VoiceV2IntakeSchema, VoiceV2IntakeState } from "../intake/types";
import type { VoiceV2MultichannelTranscript } from "./types";

/** Deterministic business-facing summary from reconciled intake (authoritative after reconciliation). */
export function buildReconciledCallSummaryText(input: {
  intakeSchema: VoiceV2IntakeSchema;
  reconciledIntake: VoiceV2IntakeState;
  primaryOutcome?: string;
  transcript?: VoiceV2MultichannelTranscript;
}): string {
  const parts: string[] = [];
  for (const field of input.intakeSchema.fields) {
    const v = input.reconciledIntake[field.key]?.value?.trim();
    if (v) parts.push(`${field.label || field.key}: ${v}`);
  }
  const outcome = input.primaryOutcome && input.primaryOutcome !== "NONE"
    ? `Outcome: ${input.primaryOutcome}. `
    : "";
  const body = parts.length ? parts.join("; ") : "No captured intake fields after reconciliation.";
  return `${outcome}${body}`.trim();
}

export async function persistFinalSummaryAfterReconciliation(input: {
  workspaceId: string;
  callId: string;
  summary: string;
  reconciledIntake: VoiceV2IntakeState;
  intakeSchema: VoiceV2IntakeSchema;
  recordComplete: boolean;
  missingForRecord: string[];
  needsReview: boolean;
}) {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { metadata: true },
  });
  const prevMeta = (call?.metadata || {}) as Record<string, unknown>;

  const customFields: Record<string, unknown> = {};
  for (const field of input.intakeSchema.fields) {
    const v = input.reconciledIntake[field.key]?.value;
    if (v) customFields[field.key] = v;
  }

  const existing = await prisma.voiceConversationInsight.findFirst({
    where: { callId: input.callId, workspaceId: input.workspaceId },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    await prisma.voiceConversationInsight.update({
      where: { id: existing.id },
      data: {
        summary: input.summary,
        customFields: customFields as object,
        needsReview: input.needsReview,
        confidence: 0.95,
      },
    });
  } else {
    await prisma.voiceConversationInsight.create({
      data: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        summary: input.summary,
        customFields: customFields as object,
        needsReview: input.needsReview,
        confidence: 0.95,
      },
    });
  }

  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: {
      metadata: {
        ...prevMeta,
        voiceV2FinalSummaryAuthority: "RECONCILED",
        voiceV2FinalSummaryGeneratedAt: new Date().toISOString(),
        voiceV2FinalSummaryText: input.summary,
        voiceV2ProvisionalInsightPendingReconciliation: false,
        voiceV2RecordComplete: input.recordComplete,
        voiceV2MissingForRecord: input.missingForRecord,
      },
    },
  });
}
