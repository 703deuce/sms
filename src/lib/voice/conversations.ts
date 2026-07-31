import { getPrisma } from "@/lib/db";

export async function loadConversations(workspaceId: string, limit = 50) {
  const prisma = getPrisma();
  const calls = await prisma.voiceCall.findMany({
    where: { workspaceId, isTest: false },
    orderBy: { startedAt: "desc" },
    take: 500,
  });

  const byContact = new Map<string, {
    contactId: string | null;
    phone: string;
    callCount: number;
    lastCallAt: string;
    lastOutcome: string | null;
    totalDuration: number;
  }>();

  for (const c of calls) {
    const key = c.contactId || c.toE164 || c.fromE164;
    const phone = c.direction === "INBOUND" ? c.fromE164 : c.toE164;
    const existing = byContact.get(key);
    if (!existing) {
      byContact.set(key, {
        contactId: c.contactId,
        phone,
        callCount: 1,
        lastCallAt: c.startedAt.toISOString(),
        lastOutcome: c.outcome,
        totalDuration: c.durationSeconds || 0,
      });
    } else {
      existing.callCount += 1;
      existing.totalDuration += c.durationSeconds || 0;
      if (c.startedAt > new Date(existing.lastCallAt)) {
        existing.lastCallAt = c.startedAt.toISOString();
        existing.lastOutcome = c.outcome;
      }
    }
  }

  return [...byContact.values()]
    .sort((a, b) => b.lastCallAt.localeCompare(a.lastCallAt))
    .slice(0, limit);
}
