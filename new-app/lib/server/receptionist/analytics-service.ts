import { getPrisma } from "@/lib/server/db";
import { findWorkspaceReceptionistAgent } from "@/lib/server/receptionist/agent-store";

export async function getReceptionistAnalytics(
  workspaceId: string,
  input: { from?: string; to?: string },
) {
  const agent = await findWorkspaceReceptionistAgent(workspaceId);
  const prisma = getPrisma();
  const from = input.from ? new Date(input.from) : new Date(Date.now() - 30 * 86400000);
  const to = input.to ? new Date(input.to) : new Date();

  const where = {
    workspaceId,
    ...(agent ? { agentId: agent.id } : {}),
    startedAt: { gte: from, lte: to },
  };

  const [handled, booked, transferred, failed, callbacks, calls] = await Promise.all([
    prisma.voiceCall.count({ where }),
    prisma.voiceCall.count({ where: { ...where, appointmentBooked: true } }),
    prisma.voiceCall.count({ where: { ...where, transferred: true } }),
    prisma.voiceCall.count({ where: { ...where, status: "FAILED" } }),
    prisma.voiceCall.count({
      where: { ...where, outcome: { contains: "callback", mode: "insensitive" } },
    }),
    prisma.voiceCall.findMany({
      where,
      select: {
        startedAt: true,
        appointmentBooked: true,
        transferred: true,
        durationSeconds: true,
        outcome: true,
      },
    }),
  ]);

  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const trendMap = new Map<string, { handled: number; booked: number; transferred: number }>();
  for (const c of calls) {
    const key = dayKey(c.startedAt);
    const row = trendMap.get(key) || { handled: 0, booked: 0, transferred: 0 };
    row.handled += 1;
    if (c.appointmentBooked) row.booked += 1;
    if (c.transferred) row.transferred += 1;
    trendMap.set(key, row);
  }
  const trend = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, ...v }));

  const intentMap = new Map<string, number>();
  for (const c of calls) {
    const intent = (c.outcome || "general").toLowerCase();
    intentMap.set(intent, (intentMap.get(intent) || 0) + 1);
  }
  const intents = [...intentMap.entries()]
    .map(([intent, count]) => ({ intent, calls: count }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 8);

  const withDuration = calls.filter((c) => c.durationSeconds != null);
  const avgSec =
    withDuration.length > 0
      ? Math.round(
          withDuration.reduce((s, c) => s + (c.durationSeconds || 0), 0) / withDuration.length,
        )
      : 0;

  const openKnowledgeGaps = await prisma.voiceKnowledgeGap.count({
    where: { workspaceId, status: "OPEN" },
  });

  const topGaps = await prisma.voiceKnowledgeGap.findMany({
    where: { workspaceId, status: "OPEN" },
    orderBy: { timesAsked: "desc" },
    take: 5,
  });

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    totals: { handled, booked, transferred, failed, callbacks, avgSec },
    trend,
    intents,
    openKnowledgeGaps,
    topGaps: topGaps.map((g) => ({
      id: g.id,
      question: g.displayQuestion,
      count: g.timesAsked,
      impact: g.timesAsked >= 5 ? "high" : g.timesAsked >= 2 ? "medium" : "low",
      lastCallId: Array.isArray(g.sourceCallIds)
        ? (g.sourceCallIds as string[])[0]
        : null,
    })),
  };
}
