import { getPrisma } from "@/lib/db";
import type { AiRoutingAnalyticsSummary } from "./types";

const MIN_SAMPLE_FOR_RECOMMENDATION = Number(
  process.env.SMART_ROUTING_AI_MIN_ANALYTICS_SAMPLE || "10",
);

type SessionAnalyticsRow = {
  finalOutcome: string | null;
  flowId: string;
  startedAt: Date;
  menuSelection: string | null;
  smsTriggered: boolean;
};

export async function getRoutingAnalyticsSummary(
  workspaceId: string,
  days = 30,
): Promise<AiRoutingAnalyticsSummary> {
  const periodDays = Math.min(Math.max(days, 1), 90);
  const since = new Date();
  since.setDate(since.getDate() - periodDays);
  const prisma = getPrisma();

  const sessions = (await prisma.smartRoutingCallSession.findMany({
    where: { workspaceId, startedAt: { gte: since }, isTest: false },
    select: {
      finalOutcome: true,
      flowId: true,
      startedAt: true,
      menuSelection: true,
      smsTriggered: true,
    },
  })) as SessionAnalyticsRow[];

  const total = sessions.length;
  const answered = sessions.filter((s: SessionAnalyticsRow) =>
    ["answered", "completed", "transferred", "connected"].includes(
      String(s.finalOutcome || "").toLowerCase(),
    ),
  ).length;
  const noAnswer = sessions.filter((s: SessionAnalyticsRow) =>
    String(s.finalOutcome || "").toLowerCase().includes("no_answer"),
  ).length;
  const voicemailCount = sessions.filter((s: SessionAnalyticsRow) =>
    String(s.finalOutcome || "").toLowerCase().includes("voicemail"),
  ).length;

  const byFlow: Record<string, number> = {};
  const byMenuSelection: Record<string, number> = {};
  const byHour: Record<string, number> = {};

  for (const s of sessions) {
    byFlow[s.flowId] = (byFlow[s.flowId] || 0) + 1;
    if (s.menuSelection) {
      byMenuSelection[s.menuSelection] = (byMenuSelection[s.menuSelection] || 0) + 1;
    }
    const hr = new Date(s.startedAt).getHours();
    const key = `${hr}:00`;
    byHour[key] = (byHour[key] || 0) + 1;
  }

  const outbound = await prisma.smartRoutingOutboundCall.count({
    where: { workspaceId, createdAt: { gte: since } },
  });

  const mctbRecoveryCount = sessions.filter((s: SessionAnalyticsRow) => s.smsTriggered).length;

  return {
    periodDays,
    callsRouted: total,
    answered,
    noAnswer,
    answerRate: total > 0 ? Math.round((answered / total) * 100) : 0,
    outboundBusinessCallbacks: outbound,
    byFlow,
    byMenuSelection,
    byHour,
    voicemailCount,
    mctbRecoveryCount,
    insufficientData: total < MIN_SAMPLE_FOR_RECOMMENDATION,
  };
}

export function formatAnalyticsFacts(summary: AiRoutingAnalyticsSummary): string {
  const lines = [
    `Period: last ${summary.periodDays} days`,
    `Calls routed: ${summary.callsRouted}`,
    `Answered: ${summary.answered} (${summary.answerRate}% answer rate)`,
    `Unanswered: ${summary.noAnswer}`,
    `Voicemail: ${summary.voicemailCount ?? 0}`,
    `Business callbacks made: ${summary.outboundBusinessCallbacks}`,
    `MCTB recoveries triggered: ${summary.mctbRecoveryCount ?? 0}`,
  ];
  if (summary.byMenuSelection && Object.keys(summary.byMenuSelection).length) {
    lines.push(
      `Menu selections: ${Object.entries(summary.byMenuSelection)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}`,
    );
  }
  if (summary.insufficientData) {
    lines.push(
      "Note: sample size is below recommendation threshold — use cautious language.",
    );
  }
  return lines.join("\n");
}

export function analyzeMissedCallsHeuristic(
  summary: AiRoutingAnalyticsSummary,
  departmentLabel?: string,
): { facts: string[]; recommendations: string[] } {
  const facts: string[] = [];
  const recommendations: string[] = [];

  if (summary.callsRouted === 0) {
    facts.push("No call activity recorded in this period.");
    return { facts, recommendations };
  }

  facts.push(
    `You received ${summary.callsRouted} inbound calls. ${summary.noAnswer} were unanswered.`,
  );

  if (departmentLabel && summary.byMenuSelection) {
    const digit = Object.entries(summary.byMenuSelection).find(([d]) =>
      d.includes(departmentLabel.toLowerCase()),
    );
    if (digit) {
      facts.push(
        `${digit[1]} calls selected menu option related to ${departmentLabel}.`,
      );
    }
  }

  const peakHour = Object.entries(summary.byHour ?? {}).sort((a, b) => b[1] - a[1])[0];
  if (peakHour) {
    facts.push(`Busiest hour bucket: ${peakHour[0]} (${peakHour[1]} calls).`);
  }

  if (!summary.insufficientData && summary.answerRate < 80 && summary.noAnswer >= 5) {
    recommendations.push(
      "Answer rate appears below 80%. Consider adding simultaneous ring or overflow destinations during busy periods.",
    );
  }

  if (summary.mctbRecoveryCount !== undefined) {
    // mctb data included in summary
  }

  return { facts, recommendations };
}
