import { getPrisma } from "@/lib/server/db";

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
