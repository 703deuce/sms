import "server-only";

import { getPrisma } from "@/lib/server/db";
import { classifyCallIntent } from "@/lib/server/voice-v3/post-call/classify";

export async function finalizeVoiceV3Call(input: {
  workspaceId: string;
  callId: string;
  transcript?: string | null;
  summary?: string | null;
  recordingUrl?: string | null;
  durationSeconds?: number | null;
  outcome?: string | null;
  intent?: string | null;
  idempotencyKey?: string | null;
}) {
  const prisma = getPrisma();
  const existing = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
  });
  if (!existing) {
    return { ok: false, code: "not_found", message: "Call not found" };
  }

  const idem = input.idempotencyKey?.trim();
  const priorMeta = (existing.metadata as Record<string, unknown>) || {};
  const priorKeys = Array.isArray(priorMeta.finalizeIdempotencyKeys)
    ? (priorMeta.finalizeIdempotencyKeys as string[])
    : [];
  if (idem && priorKeys.includes(idem)) {
    return { ok: true, duplicate: true };
  }

  const priorSummary =
    typeof priorMeta.callSummary === "string" ? priorMeta.callSummary : undefined;
  const classified = classifyCallIntent({
    transcript: input.transcript ?? priorSummary,
    outcome: input.outcome ?? existing.outcome,
    appointmentBooked: existing.appointmentBooked,
    transferred: existing.transferred,
  });
  const intent = input.intent?.trim() || classified.intent;
  const followUpOpen = classified.followUp === "open";
  const callSummary = input.summary?.trim() || priorSummary;

  const nextMeta: Record<string, unknown> = {
    ...priorMeta,
    ...(callSummary ? { callSummary } : {}),
    aiIntent: intent,
    followUp: followUpOpen ? "open" : "closed",
  };
  if (idem) {
    nextMeta.finalizeIdempotencyKeys = [...priorKeys, idem];
  }

  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: {
      status: "COMPLETED",
      endedAt: existing.endedAt ?? new Date(),
      durationSeconds: input.durationSeconds ?? existing.durationSeconds,
      outcome: input.outcome ?? existing.outcome,
      dynamicVariables: {
        ...((existing.dynamicVariables as object) || {}),
        aiIntent: intent,
        followUp: followUpOpen ? "open" : "closed",
      },
      metadata: nextMeta as object,
    },
  });

  if (input.transcript?.trim()) {
    const existingTx = await prisma.voiceTranscript.findFirst({
      where: { callId: input.callId },
    });
    if (existingTx) {
      await prisma.voiceTranscript.update({
        where: { id: existingTx.id },
        data: { fullText: input.transcript, status: "ready" },
      });
    } else {
      await prisma.voiceTranscript.create({
        data: {
          callId: input.callId,
          workspaceId: input.workspaceId,
          fullText: input.transcript,
          status: "ready",
        },
      });
    }
  }

  if (input.recordingUrl?.trim()) {
    const existingRec = await prisma.voiceRecording.findFirst({
      where: { callId: input.callId },
    });
    if (existingRec) {
      await prisma.voiceRecording.update({
        where: { id: existingRec.id },
        data: { storageUrl: input.recordingUrl, status: "ready" },
      });
    } else {
      await prisma.voiceRecording.create({
        data: {
          callId: input.callId,
          workspaceId: input.workspaceId,
          storageUrl: input.recordingUrl,
          status: "ready",
        },
      });
    }
  }

  if (intent.includes("knowledge_gap") || intent.includes("unknown")) {
    await prisma.voiceKnowledgeGap
      .create({
        data: {
          workspaceId: input.workspaceId,
          displayQuestion: input.summary?.slice(0, 500) || intent,
          normalizedQuestion: intent.toLowerCase(),
          status: "OPEN",
          timesAsked: 1,
          sourceCallIds: [input.callId],
        },
      })
      .catch(() => undefined);
  }

  return { ok: true, intent, followUp: followUpOpen ? "open" : "closed" };
}
