import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import type { AiRoutingAnalyticsSummary } from "./types";

const MIN_SAMPLE = Number(process.env.SMART_ROUTING_AI_MIN_ANALYTICS_SAMPLE || "10");

export type RoutingRecommendation = {
  id: string;
  kind: string;
  title: string;
  body: string;
  recommendation: string;
  metrics?: Record<string, number>;
};

export async function generateRoutingRecommendations(
  workspaceId: string,
  analytics: AiRoutingAnalyticsSummary,
  flowId?: string,
): Promise<RoutingRecommendation[]> {
  if (analytics.insufficientData || analytics.callsRouted < MIN_SAMPLE) {
    return [];
  }

  const recommendations: RoutingRecommendation[] = [];

  if (analytics.answerRate < 75 && analytics.noAnswer >= 5) {
    recommendations.push({
      id: createId(),
      kind: "overflow_destination",
      title: "Routing Opportunity",
      body: `Your team missed ${analytics.noAnswer} calls (${analytics.answerRate}% answer rate) in the last ${analytics.periodDays} days.`,
      recommendation:
        "Consider adding simultaneous ring or an overflow destination during busy periods.",
      metrics: {
        noAnswer: analytics.noAnswer,
        answerRate: analytics.answerRate,
      },
    });
  }

  const peakHour = Object.entries(analytics.byHour ?? {}).sort((a, b) => b[1] - a[1])[0];
  if (peakHour && peakHour[1] >= MIN_SAMPLE / 2) {
    recommendations.push({
      id: createId(),
      kind: "busy_hour",
      title: "Busy hour pattern",
      body: `Most calls arrive around ${peakHour[0]} (${peakHour[1]} calls).`,
      recommendation:
        "You may improve answer rate by staffing or routing adjustments during this window.",
      metrics: { hour: Number(peakHour[0].split(":")[0]), calls: peakHour[1] },
    });
  }

  if (recommendations.length) {
    const prisma = getPrisma();
    for (const r of recommendations.slice(0, 3)) {
      await prisma.smartRoutingAiRecommendation.create({
        data: {
          id: r.id,
          workspaceId,
          flowId: flowId ?? null,
          kind: r.kind,
          title: r.title,
          body: r.body,
          recommendationJson: { recommendation: r.recommendation } as object,
          metricsJson: (r.metrics ?? {}) as object,
          status: "active",
        },
      });
    }
  }

  return recommendations;
}

export async function listActiveRecommendations(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.smartRoutingAiRecommendation.findMany({
    where: { workspaceId, status: "active" },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}

export async function dismissRecommendation(workspaceId: string, id: string) {
  const prisma = getPrisma();
  return prisma.smartRoutingAiRecommendation.updateMany({
    where: { id, workspaceId },
    data: { status: "dismissed", dismissedAt: new Date() },
  });
}
