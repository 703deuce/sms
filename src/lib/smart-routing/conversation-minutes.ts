import "server-only";

import { getPrisma } from "@/lib/db";
import { conversationMinutesFromSession } from "./conversation-minute-math";

export { conversationMinutesFromSession } from "./conversation-minute-math";

export async function recordSmartRoutingConversationMinutes(input: {
  workspaceId: string;
  callSessionId: string;
  startedAt: Date;
  answeredAt?: Date | null;
  completedAt?: Date | null;
}): Promise<{ recorded: boolean; minutes: number }> {
  const prisma = getPrisma();
  const minutes = conversationMinutesFromSession(input);

  const existing = await prisma.platformSmartRoutingUsageRecord.findUnique({
    where: { callSessionId: input.callSessionId },
  });
  if (existing) {
    return { recorded: false, minutes: existing.conversationMinutes };
  }

  const sub = await prisma.platformProductSubscription.findFirst({
    where: {
      workspaceId: input.workspaceId,
      productFamily: "smart_routing",
      status: { in: ["active", "trialing", "past_due"] },
    },
  });
  if (!sub) return { recorded: false, minutes };

  await prisma.$transaction([
    prisma.platformSmartRoutingUsageRecord.create({
      data: {
        workspaceId: input.workspaceId,
        subscriptionId: sub.id,
        callSessionId: input.callSessionId,
        conversationMinutes: minutes,
        billingPeriodStart: sub.usagePeriodStart,
      },
    }),
    prisma.platformProductSubscription.update({
      where: { id: sub.id },
      data: { minutesUsedThisPeriod: { increment: minutes } },
    }),
  ]);

  return { recorded: true, minutes };
}
