import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { audioSecondsToTranscriptionMinutes } from "./minute-math";

export async function recordTranscriptionUsage(input: {
  workspaceId: string;
  sourceType: "voicemail_message" | "smart_routing_recording";
  sourceId: string;
  provider?: string | null;
  audioDurationSeconds?: number | null;
  transcriptionMinutes?: number;
  idempotencyKey: string;
  status?: string;
  errorMessage?: string | null;
}): Promise<{ recorded: boolean; minutes: number }> {
  const prisma = getPrisma();
  const existing = await prisma.platformTranscriptionUsageRecord.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    return { recorded: false, minutes: existing.transcriptionMinutes };
  }

  const minutes =
    input.transcriptionMinutes ??
    audioSecondsToTranscriptionMinutes(input.audioDurationSeconds);

  const audioDurationSeconds =
    typeof input.audioDurationSeconds === "number"
      ? Math.max(0, Math.round(input.audioDurationSeconds))
      : null;

  const sub = await prisma.platformProductSubscription.findFirst({
    where: {
      workspaceId: input.workspaceId,
      productFamily: "ai_transcription",
      status: { in: ["active", "trialing", "past_due"] },
    },
  });

  await prisma.platformTranscriptionUsageRecord.create({
    data: {
      id: createId(),
      workspaceId: input.workspaceId,
      subscriptionId: sub?.id ?? null,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      provider: input.provider ?? null,
      audioDurationSeconds,
      transcriptionMinutes: minutes,
      transcriptionProvider: "deepgram",
      transcriptionModel: "nova-3",
      status: input.status ?? "completed",
      idempotencyKey: input.idempotencyKey,
      billingPeriodStart: sub?.usagePeriodStart ?? null,
      errorMessage: input.errorMessage ?? null,
    },
  });

  if (sub && input.status !== "failed") {
    await prisma.platformProductSubscription.update({
      where: { id: sub.id },
      data: { transcriptionMinutesUsedThisPeriod: { increment: minutes } },
    });
  }

  return { recorded: true, minutes };
}

export async function resetTranscriptionUsageForBillingPeriod(workspaceId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.platformProductSubscription.updateMany({
    where: { workspaceId, productFamily: "ai_transcription" },
    data: { transcriptionMinutesUsedThisPeriod: 0 },
  });
}
