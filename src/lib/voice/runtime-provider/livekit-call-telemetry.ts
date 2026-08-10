import { getPrisma } from "@/lib/db";
import type { Prisma } from "@/lib/domain";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { appendTraceEvent } from "@/lib/voice/workflow-engine/trace";

export async function markVoiceCallBooked(input: {
  workspaceId: string;
  callId: string;
  contactId?: string | null;
  appointmentId?: string | null;
  externalId?: string | null;
}): Promise<void> {
  const prisma = getPrisma();
  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: {
      appointmentBooked: true,
      contactId: input.contactId || undefined,
      outcome: "appointment_booked",
    },
  });

  if (input.externalId) {
    const externalId = input.externalId.startsWith("calendly:")
      ? input.externalId
      : `calendly:${input.externalId}`;
    await prisma.voiceAppointment
      .updateMany({
        where: { workspaceId: input.workspaceId, externalId },
        data: { callId: input.callId },
      })
      .catch(() => undefined);
  } else if (input.appointmentId) {
    await prisma.voiceAppointment
      .updateMany({
        where: { id: input.appointmentId, workspaceId: input.workspaceId },
        data: { callId: input.callId },
      })
      .catch(() => undefined);
  }

  await appendTraceEvent(input.callId, {
    kind: "booking_confirmed",
    tool: "schedule_appointment",
    detail: {
      appointmentId: input.appointmentId || null,
      externalId: input.externalId || null,
    },
  }).catch(() => undefined);
}

export async function recordLiveKitBuiltinToolExecution<T>(input: {
  workspaceId: string;
  callId: string;
  toolType: string;
  args?: Record<string, unknown>;
  run: () => Promise<T>;
}): Promise<T> {
  const prisma = getPrisma();
  const started = Date.now();
  const execution = await prisma.voiceToolExecution
    .create({
      data: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        toolId: null,
        status: "running",
        input: { toolType: input.toolType, ...(input.args || {}) } as Prisma.InputJsonValue,
        isAsync: false,
      },
    })
    .catch(() => null);

  try {
    const output = await input.run();
    const latencyMs = Date.now() - started;
    if (execution) {
      await prisma.voiceToolExecution
        .update({
          where: { id: execution.id },
          data: {
            status: "completed",
            output: output as Prisma.InputJsonValue,
            latencyMs,
            completedAt: new Date(),
          },
        })
        .catch(() => undefined);
    }
    await appendTraceEvent(input.callId, {
      kind: "tool_success",
      tool: input.toolType,
      detail: { latencyMs },
    }).catch(() => undefined);
    return output;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const latencyMs = Date.now() - started;
    if (execution) {
      await prisma.voiceToolExecution
        .update({
          where: { id: execution.id },
          data: {
            status: "failed",
            errorMessage: message,
            latencyMs,
            completedAt: new Date(),
          },
        })
        .catch(() => undefined);
    }
    await appendTraceEvent(input.callId, {
      kind: "tool_failure",
      tool: input.toolType,
      detail: { error: message, latencyMs },
    }).catch(() => undefined);
    throw err;
  }
}

export async function appendLiveKitTranscriptLine(input: {
  workspaceId: string;
  callId: string;
  speaker: string;
  text: string;
  confidence?: number | null;
}): Promise<void> {
  const text = input.text.trim();
  if (!text) return;

  const prisma = getPrisma();
  let transcript = await prisma.voiceTranscript.findFirst({
    where: { workspaceId: input.workspaceId, callId: input.callId },
  });
  if (!transcript) {
    transcript = await prisma.voiceTranscript.create({
      data: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        provider: "livekit",
        status: "partial",
        language: "en",
        fullText: text,
      },
    });
  } else {
    const next = `${transcript.fullText || ""}\n${text}`.trim();
    transcript = await prisma.voiceTranscript.update({
      where: { id: transcript.id },
      data: { fullText: next },
    });
  }

  await prisma.voiceTranscriptSegment.create({
    data: {
      workspaceId: input.workspaceId,
      transcriptId: transcript.id,
      speaker: input.speaker,
      text,
      confidence: input.confidence ?? undefined,
    },
  });
}

export async function finalizeLiveKitTranscript(callId: string): Promise<void> {
  const prisma = getPrisma();
  const transcript = await prisma.voiceTranscript.findFirst({
    where: { callId },
  });
  if (!transcript) return;
  await prisma.voiceTranscript.update({
    where: { id: transcript.id },
    data: { status: "completed" },
  });
}

export async function enqueueLiveKitPostCallJob(input: {
  workspaceId: string;
  callId: string;
}): Promise<void> {
  await enqueueJob({
    jobType: "voice_post_call",
    queueName: "voice-calls",
    payload: { callId: input.callId, workspaceId: input.workspaceId },
    idempotencyKey: `voice-post-call:${input.callId}`,
  }).catch(() => undefined);
}
