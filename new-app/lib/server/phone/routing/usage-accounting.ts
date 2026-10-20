import { getPrisma } from "@/lib/server/db";

function yearMonth(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function recordForwardedCallAttempt(workspaceId: string) {
  const ym = yearMonth();
  await getPrisma().forwardingUsageMonthly.upsert({
    where: { workspaceId_yearMonth: { workspaceId, yearMonth: ym } },
    create: { workspaceId, yearMonth: ym, forwardedCalls: 1 },
    update: { forwardedCalls: { increment: 1 } },
  });
}

export async function recordBridgedConversation(workspaceId: string, bridgedMinutes: number) {
  const ym = yearMonth();
  await getPrisma().forwardingUsageMonthly.upsert({
    where: { workspaceId_yearMonth: { workspaceId, yearMonth: ym } },
    create: {
      workspaceId,
      yearMonth: ym,
      answeredCalls: 1,
      bridgedMinutes: Math.max(1, Math.ceil(bridgedMinutes)),
      forwardedMinutes: Math.max(1, Math.ceil(bridgedMinutes)),
    },
    update: {
      answeredCalls: { increment: 1 },
      bridgedMinutes: { increment: Math.max(1, Math.ceil(bridgedMinutes)) },
      forwardedMinutes: { increment: Math.max(1, Math.ceil(bridgedMinutes)) },
    },
  });
}

export async function recordMissedForward(workspaceId: string) {
  const ym = yearMonth();
  await getPrisma().forwardingUsageMonthly.upsert({
    where: { workspaceId_yearMonth: { workspaceId, yearMonth: ym } },
    create: { workspaceId, yearMonth: ym, missedCalls: 1 },
    update: { missedCalls: { increment: 1 } },
  });
}
