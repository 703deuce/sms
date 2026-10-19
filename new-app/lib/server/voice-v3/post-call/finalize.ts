import "server-only";

import { getPrisma } from "@/lib/server/db";

export async function finalizeVoiceV3Call(input: {
  workspaceId: string;
  callId: string;
  transcript?: string | null;
  summary?: string | null;
  recordingUrl?: string | null;
  durationSeconds?: number | null;
  outcome?: string | null;
  intent?: string | null;
}) {
  const prisma = getPrisma();
  const existing = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
  });
  if (!existing) {
    return { ok: false, code: "not_found", message: "Call not found" };
  }

  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: {
      status: "COMPLETED",
      endedAt: new Date(),
      durationSeconds: input.durationSeconds ?? existing.durationSeconds,
      outcome: input.outcome ?? existing.outcome,
      summary: input.summary ?? existing.summary,
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

  if (input.intent?.trim() && input.intent.includes("unknown")) {
    await prisma.voiceKnowledgeGap
      .create({
        data: {
          workspaceId: input.workspaceId,
          displayQuestion: input.intent,
          normalizedQuestion: input.intent.toLowerCase(),
          status: "OPEN",
          timesAsked: 1,
          sourceCallIds: [input.callId],
        },
      })
      .catch(() => undefined);
  }

  return { ok: true };
}
