import "server-only";

import { getPrisma } from "@/lib/db";
import type { VoiceV2IntakeState } from "./types";
import {
  extractPostCallIntakeCandidates,
  mergePostCallBackfills,
} from "./postcall-reconcile";

/** DEFER_AFTER_CALL — enrich call metadata / appointment when safe. */
export async function processVoiceV2PostCallIntake(callId: string): Promise<{ ok: boolean }> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: {
      id: true,
      workspaceId: true,
      metadata: true,
    },
  });
  if (!call) return { ok: false };

  const meta = (call.metadata || {}) as Record<string, unknown>;
  const stored = meta.voiceV2Intake as { snapshot?: VoiceV2IntakeState } | undefined;
  const canonical: VoiceV2IntakeState = stored?.snapshot || {};

  const transcriptRow = await prisma.voiceTranscript.findFirst({
    where: { callId: call.id },
    select: { fullText: true },
  });
  const transcript =
    transcriptRow?.fullText?.trim() ||
    (typeof meta.transcript === "string" ? meta.transcript : "") ||
    "";

  if (!transcript.trim()) return { ok: true };

  const candidates = extractPostCallIntakeCandidates(transcript, canonical);
  const merged = mergePostCallBackfills(canonical, candidates);
  const changed = JSON.stringify(merged) !== JSON.stringify(canonical);
  if (!changed) return { ok: true };

  await prisma.voiceCall.update({
    where: { id: call.id },
    data: {
      metadata: {
        ...meta,
        voiceV2Intake: {
          ...(stored || {}),
          snapshot: merged,
          reconciledAt: new Date().toISOString(),
        },
      },
    },
  });

  const appointment = await prisma.voiceAppointment.findFirst({
    where: { callId: call.id, workspaceId: call.workspaceId },
    select: { id: true, metadata: true },
  });
  if (appointment) {
    const apptMeta = (appointment.metadata || {}) as Record<string, unknown>;
    await prisma.voiceAppointment.update({
      where: { id: appointment.id },
      data: {
        metadata: {
          ...apptMeta,
          voice_v2_intake_backfill: merged,
        },
      },
    });
  }

  return { ok: true };
}
