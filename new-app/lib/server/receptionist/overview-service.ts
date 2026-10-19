import { getPrisma } from "@/lib/server/db";
import { getReceptionistState } from "@/lib/server/receptionist/agent-service";
import { listKnowledgeGaps, listKnowledgeSources } from "@/lib/server/receptionist/knowledge-service";
import { listReceptionistCalls } from "@/lib/server/receptionist/calls-service";

export async function getReceptionistOverview(workspaceId: string) {
  const state = await getReceptionistState(workspaceId);
  const prisma = getPrisma();
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const agentId = state.agentId;
  const [handled, booked, transferred, gaps, sources, recent] = await Promise.all([
    prisma.voiceCall.count({
      where: { workspaceId, agentId, startedAt: { gte: since } },
    }),
    prisma.voiceCall.count({
      where: { workspaceId, agentId, appointmentBooked: true, startedAt: { gte: since } },
    }),
    prisma.voiceCall.count({
      where: { workspaceId, agentId, transferred: true, startedAt: { gte: since } },
    }),
    listKnowledgeGaps(workspaceId),
    listKnowledgeSources(workspaceId),
    listReceptionistCalls(workspaceId, { limit: 6, page: 0 }),
  ]);

  const openGaps = gaps.filter((g) => g.status === "OPEN").length;
  const failedSources = sources.filter((s) => s.status === "failed").length;

  const durations = await prisma.voiceCall.findMany({
    where: { workspaceId, agentId, startedAt: { gte: since }, durationSeconds: { not: null } },
    select: { durationSeconds: true },
  });
  const avgSec =
    durations.length > 0
      ? Math.round(
          durations.reduce((s, d) => s + (d.durationSeconds || 0), 0) / durations.length,
        )
      : 0;

  const needsAttention = recent.data.filter((c) => c.ai?.followUp === "open").length;

  const calendars = await prisma.voiceCalendarConnection.count({
    where: { workspaceId, status: { in: ["connected", "active", "ok"] } },
  });

  return {
    state,
    metrics: {
      handled,
      booked,
      transferred,
      needsAttention,
      avgSec,
      openGaps,
    },
    readiness: {
      calendarConnected: calendars > 0,
      knowledgeSources: sources.length,
      failedSources,
    },
    recentCalls: recent.data,
  };
}
