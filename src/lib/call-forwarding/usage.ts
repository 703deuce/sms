import "server-only";

import { getPrisma } from "@/lib/db";
import { conversationMinutesFromSession } from "@/lib/smart-routing/conversation-minute-math";

export async function recordCallForwardingConversationMinutes(input: {
  workspaceId: string;
  humanCallId: string;
  startedAt: Date;
  answeredAt?: Date | null;
  completedAt?: Date | null;
}): Promise<{ recorded: boolean; minutes: number }> {
  const prisma = getPrisma();
  const minutes = conversationMinutesFromSession({
    startedAt: input.startedAt,
    answeredAt: input.answeredAt,
    completedAt: input.completedAt,
  });

  const existing = await prisma.platformCallForwardingUsageRecord.findUnique({
    where: { humanCallId: input.humanCallId },
  });
  if (existing) return { recorded: false, minutes: existing.conversationMinutes };

  const sub = await prisma.platformProductSubscription.findFirst({
    where: {
      workspaceId: input.workspaceId,
      productFamily: "call_forwarding",
      status: { in: ["active", "trialing", "past_due"] },
    },
  });
  if (!sub) return { recorded: false, minutes };

  await prisma.$transaction([
    prisma.platformCallForwardingUsageRecord.create({
      data: {
        workspaceId: input.workspaceId,
        subscriptionId: sub.id,
        humanCallId: input.humanCallId,
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
