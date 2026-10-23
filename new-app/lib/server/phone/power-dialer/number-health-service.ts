import { getPrisma } from "@/lib/server/db";
import { startOfDayInTimezone } from "./timezone-window";
import {
  assessNumberHealth,
  computeWindowMetrics,
  filterRowsSince,
  type NumberSignalInput,
} from "./number-health-signals";

export type NumberHealthRow = {
  phoneNumberId: string;
  e164: string;
  nickname: string | null;
  attempts: number;
  dialsToday: number;
  minutes: number;
  answerRate: number | null;
  humanConversationRate: number | null;
  screeningRate: number | null;
  failedCalls: number;
  registrationStatus: string;
  telnyxReputationStatus: string;
  stirShakenAttestation: string;
  healthLabel: "healthy" | "watch" | "at_risk";
  healthLabelSource: "based_on_your_call_data";
  healthReasons: string[];
  healthSuggestion: string | null;
  metrics7d: ReturnType<typeof computeWindowMetrics>;
  metrics30d: ReturnType<typeof computeWindowMetrics>;
  trendAnswerRate7vs30: number | null;
};

export async function listPowerDialerNumberHealth(workspaceId: string): Promise<NumberHealthRow[]> {
  const prisma = getPrisma();
  const pdSettings = await import("@/lib/server/phone/power-dialer").then((m) =>
    m.getPowerDialerSettings(workspaceId),
  );
  const tz = pdSettings.defaultTimezone || "America/Chicago";
  const dayStart = startOfDayInTimezone(new Date(), tz);
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const numbers = await prisma.phoneNumber.findMany({
    where: { workspaceId },
    select: { id: true, e164: true, friendlyName: true, a2pStatus: true, capabilitiesJson: true },
  });

  const attempts = await prisma.powerDialerAttempt.findMany({
    where: { workspaceId, createdAt: { gte: since30 } },
    select: {
      id: true,
      createdAt: true,
      disposition: true,
      answerClassification: true,
      billableSeconds: true,
      humanCall: {
        select: {
          phoneNumberId: true,
          answeredAt: true,
          endedAt: true,
          startedAt: true,
          status: true,
        },
      },
    },
  });

  const byNumberSignals = new Map<string, NumberSignalInput[]>();
  for (const n of numbers) byNumberSignals.set(n.id, []);

  for (const a of attempts) {
    const nid = a.humanCall?.phoneNumberId;
    if (!nid) continue;
    const bucket = byNumberSignals.get(nid);
    if (!bucket) continue;
    bucket.push({
      attemptId: a.id,
      createdAt: a.createdAt,
      disposition: a.disposition,
      answerClassification: a.answerClassification,
      billableSeconds: a.billableSeconds,
      answeredAt: a.humanCall?.answeredAt ?? null,
      endedAt: a.humanCall?.endedAt ?? null,
      startedAt: a.humanCall?.startedAt ?? null,
    });
  }

  const todayAttempts = await prisma.powerDialerAttempt.count({
    where: { workspaceId, createdAt: { gte: dayStart } },
  });

  const rows: NumberHealthRow[] = [];
  for (const n of numbers) {
    const signals = byNumberSignals.get(n.id) || [];
    const w7 = computeWindowMetrics(filterRowsSince(signals, since7));
    const w30 = computeWindowMetrics(signals);
    const assessment = assessNumberHealth(w7, w30);
    const caps = (n.capabilitiesJson || {}) as { stirShaken?: string };

    let minutes = 0;
    let failedCalls = 0;
    let screened = 0;
    let human = 0;
    for (const s of signals) {
      if (s.billableSeconds) minutes += s.billableSeconds / 60;
      if (s.answerClassification === "screener") screened += 1;
      if (s.disposition && /failed|busy/i.test(s.disposition)) failedCalls += 1;
    }
    human = w30.humanConversations;

    rows.push({
      phoneNumberId: n.id,
      e164: n.e164,
      nickname: n.friendlyName,
      attempts: w30.attempts,
      dialsToday: 0,
      minutes,
      answerRate: w30.answerRatePct,
      humanConversationRate:
        w30.attempts > 0 ? Math.round((human / w30.attempts) * 1000) / 10 : null,
      screeningRate:
        w30.attempts > 0 ? Math.round((screened / w30.attempts) * 1000) / 10 : null,
      failedCalls,
      registrationStatus: n.a2pStatus || "Unknown",
      telnyxReputationStatus: pdSettings.premiumReputationEntitlement
        ? "Not provisioned — connect Telnyx Number Reputation in premium settings"
        : "Not entitled — enable premium reputation for official carrier scores",
      stirShakenAttestation: caps.stirShaken || "Unknown",
      healthLabel: assessment.label,
      healthLabelSource: assessment.labelSource,
      healthReasons: assessment.reasons,
      healthSuggestion: assessment.suggestion,
      metrics7d: w7,
      metrics30d: w30,
      trendAnswerRate7vs30: assessment.trendAnswerRate7vs30,
    });
  }

  const todayByNumber = await prisma.powerDialerAttempt.groupBy({
    by: ["humanCallId"],
    where: { workspaceId, createdAt: { gte: dayStart }, humanCallId: { not: null } },
    _count: true,
  });
  const callIds = todayByNumber.map((g) => g.humanCallId!).filter(Boolean);
  if (callIds.length) {
    const calls = await prisma.humanCall.findMany({
      where: { id: { in: callIds } },
      select: { id: true, phoneNumberId: true },
    });
    const countByNumber = new Map<string, number>();
    for (const c of calls) {
      if (!c.phoneNumberId) continue;
      countByNumber.set(c.phoneNumberId, (countByNumber.get(c.phoneNumberId) || 0) + 1);
    }
    for (const row of rows) {
      row.dialsToday = countByNumber.get(row.phoneNumberId) || 0;
    }
  }

  void todayAttempts;
  return rows;
}
