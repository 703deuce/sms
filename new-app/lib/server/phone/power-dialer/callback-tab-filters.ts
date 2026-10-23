export type CallbackTab =
  | "due_today"
  | "upcoming"
  | "overdue"
  | "completed"
  | "all"
  | "ai_callbacks";

export function dayBoundsUtc(now: Date): { startOfDay: Date; endOfDay: Date } {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  return { startOfDay, endOfDay };
}

/** Prisma-style where fragment for PowerDialerCallback list tabs (server UTC day windows). */
export function buildCallbackTabWhere(
  workspaceId: string,
  tab: CallbackTab,
  now = new Date(),
): Record<string, unknown> {
  const { startOfDay, endOfDay } = dayBoundsUtc(now);
  const where: Record<string, unknown> = { workspaceId };

  if (tab === "completed") {
    where.status = "completed";
  } else if (tab === "due_today") {
    where.status = "scheduled";
    where.scheduledAt = { gte: startOfDay, lte: endOfDay };
  } else if (tab === "upcoming") {
    where.status = "scheduled";
    where.scheduledAt = { gt: endOfDay };
  } else if (tab === "overdue") {
    where.status = "scheduled";
    where.scheduledAt = { lt: startOfDay };
  } else if (tab === "ai_callbacks") {
    where.OR = [
      { source: { contains: "ai", mode: "insensitive" } },
      { disposition: { equals: "AI callback", mode: "insensitive" } },
    ];
  }

  return where;
}
