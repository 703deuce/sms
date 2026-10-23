import { getPrisma } from "@/lib/server/db";
import type { AnswerClassification } from "./types";

const MACHINE_RESULTS = new Set(["machine", "machine_end_beep", "machine_end_silence", "machine_end_other"]);
const HUMAN_RESULTS = new Set(["human", "not_sure"]);

export function mapTelnyxAmdResult(raw: string): AnswerClassification {
  const r = raw.toLowerCase();
  if (MACHINE_RESULTS.has(r)) return "voicemail";
  if (r.includes("screen")) return "screener";
  if (HUMAN_RESULTS.has(r)) return "human";
  return "uncertain";
}

export async function recordPowerDialerDetectionEvent(input: {
  workspaceId: string;
  attemptId?: string | null;
  humanCallId?: string | null;
  eventType: string;
  result?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
}) {
  const prisma = getPrisma();
  if (input.idempotencyKey) {
    const existing = await prisma.powerDialerDetectionEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
  }
  return prisma.powerDialerDetectionEvent.create({
    data: {
      workspaceId: input.workspaceId,
      attemptId: input.attemptId ?? undefined,
      humanCallId: input.humanCallId ?? undefined,
      eventType: input.eventType,
      result: input.result ?? undefined,
      payload: input.payload as import("@prisma/client").Prisma.InputJsonValue,
      idempotencyKey: input.idempotencyKey,
    },
  });
}

export async function applyAmdToPowerDialerAttempt(input: {
  workspaceId: string;
  humanCallId: string;
  amdResult: string;
  eventType: string;
  idempotencyKey: string;
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call || call.source !== "power_dialer") return { handled: false };

  const attemptId = (call.metadata as { powerDialerAttemptId?: string } | null)?.powerDialerAttemptId;
  await recordPowerDialerDetectionEvent({
    workspaceId: input.workspaceId,
    attemptId,
    humanCallId: call.id,
    eventType: input.eventType,
    result: input.amdResult,
    idempotencyKey: input.idempotencyKey,
    payload: { amdResult: input.amdResult },
  });

  const classification = mapTelnyxAmdResult(input.amdResult);
  if (attemptId) {
    await prisma.powerDialerAttempt.updateMany({
      where: { id: attemptId, workspaceId: input.workspaceId },
      data: { answerClassification: classification },
    });
  }
  return { handled: true, classification };
}
