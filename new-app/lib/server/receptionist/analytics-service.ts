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

  const [handled, booked, transferred, failed, callbacks] = await Promise.all([
    prisma.voiceCall.count({ where }),
    prisma.voiceCall.count({ where: { ...where, appointmentBooked: true } }),
    prisma.voiceCall.count({ where: { ...where, transferred: true } }),
    prisma.voiceCall.count({ where: { ...where, status: "FAILED" } }),
    prisma.voiceCall.count({
      where: { ...where, outcome: { contains: "callback", mode: "insensitive" } },
    }),
  ]);

  const byDay = await prisma.$queryRaw<
    { day: Date; count: bigint }[]
  >`SELECT date_trunc('day', "startedAt") as day, count(*)::bigint as count
    FROM voice_calls
    WHERE "workspaceId" = ${workspaceId}
    AND "startedAt" >= ${from} AND "startedAt" <= ${to}
    GROUP BY 1 ORDER BY 1`;

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    totals: { handled, booked, transferred, failed, callbacks },
    trend: byDay.map((r) => ({
      day: r.day instanceof Date ? r.day.toISOString() : String(r.day),
      count: Number(r.count),
    })),
  };
}
