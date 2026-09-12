import "server-only";

import { getPrisma } from "@/lib/db";

export async function recordPaymentRequestEvent(input: {
  paymentRequestId: string;
  workspaceId: string;
  eventType: string;
  actorType?: "system" | "user" | "provider";
  actorUserId?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  const prisma = getPrisma();
  return prisma.paymentRequestEvent.create({
    data: {
      paymentRequestId: input.paymentRequestId,
      workspaceId: input.workspaceId,
      eventType: input.eventType,
      actorType: input.actorType ?? "system",
      actorUserId: input.actorUserId ?? null,
      payload: input.payload ?? undefined,
    },
  });
}
