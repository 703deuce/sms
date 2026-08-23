import { getPrisma } from "@/lib/db";

export async function countCallerMissedEventsToday(
  workspaceId: string,
  callerE164: string,
): Promise<{ total: number; missedToday: number }> {
  const prisma = getPrisma();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [total, missedToday] = await Promise.all([
    prisma.missedCallEvent.count({
      where: { workspaceId, callerE164 },
    }),
    prisma.missedCallEvent.count({
      where: { workspaceId, callerE164, detectedAt: { gte: start } },
    }),
  ]);
  return { total, missedToday };
}
