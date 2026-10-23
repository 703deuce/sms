import { getPrisma } from "@/lib/server/db";
import { isHumanConversation } from "./disposition-effects";
import { startOfDayInTimezone } from "./timezone-window";

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
  /** M47 — not carrier spam score unless Telnyx reputation is entitled + connected */
  telnyxReputationStatus: string;
  stirShakenAttestation: string;
  healthState: string;
};

export async function listPowerDialerNumberHealth(workspaceId: string): Promise<NumberHealthRow[]> {
  const prisma = getPrisma();
  const pdSettings = await import("@/lib/server/phone/power-dialer").then((m) =>
    m.getPowerDialerSettings(workspaceId),
  );
  const dayStart = startOfDayInTimezone(new Date(), pdSettings.defaultTimezone || "America/Chicago");
  const numbers = await prisma.phoneNumber.findMany({
    where: { workspaceId },
    select: { id: true, e164: true, friendlyName: true, a2pStatus: true, capabilitiesJson: true },
  });

  const calls = await prisma.humanCall.findMany({
    where: { workspaceId, source: "power_dialer", phoneNumberId: { not: null } },
    select: {
      id: true,
      phoneNumberId: true,
      status: true,
      answeredAt: true,
      startedAt: true,
      endedAt: true,
      disposition: true,
      metadata: true,
    },
  });

  const attempts = await prisma.powerDialerAttempt.findMany({
    where: { workspaceId },
    select: { answerClassification: true, disposition: true, humanCallId: true },
  });
  const attemptByCall = new Map(
    attempts.filter((a) => a.humanCallId).map((a) => [a.humanCallId!, a]),
  );

  const byNumber = new Map<string, NumberHealthRow>();
  for (const n of numbers) {
    const caps = (n.capabilitiesJson || {}) as { stirShaken?: string };
    byNumber.set(n.id, {
      phoneNumberId: n.id,
      e164: n.e164,
      nickname: n.friendlyName,
      attempts: 0,
      dialsToday: 0,
      minutes: 0,
      answerRate: null,
      humanConversationRate: null,
      screeningRate: null,
      failedCalls: 0,
      registrationStatus: n.a2pStatus || "Unknown",
      telnyxReputationStatus: pdSettings.premiumReputationEntitlement
        ? "Not provisioned — connect Telnyx Number Reputation in premium settings"
        : "Not entitled — enable premium reputation for official scores",
      stirShakenAttestation: caps.stirShaken || "Unknown",
      healthState: "healthy",
    });
  }

  const todayAttempts = await prisma.powerDialerAttempt.findMany({
    where: { workspaceId, createdAt: { gte: dayStart }, humanCall: { phoneNumberId: { not: null } } },
    select: { humanCall: { select: { phoneNumberId: true } } },
  });
  for (const t of todayAttempts) {
    const id = t.humanCall?.phoneNumberId;
    if (!id) continue;
    const row = byNumber.get(id);
    if (row) row.dialsToday += 1;
  }

  let answered = 0;
  let human = 0;
  let screened = 0;
  for (const c of calls) {
    const id = c.phoneNumberId!;
    const row = byNumber.get(id);
    if (!row) continue;
    row.attempts += 1;
    if (c.status === "failed" || c.status === "busy") row.failedCalls += 1;
    const wasAnswered = Boolean(c.answeredAt);
    if (wasAnswered) answered += 1;
    const att = attemptByCall.get(c.id);
    const cls = att?.answerClassification || null;
    if (cls === "screener") screened += 1;
    if (isHumanConversation(att?.disposition || null, cls)) human += 1;
    if (c.endedAt && c.startedAt) {
      row.minutes += Math.max(0, (c.endedAt.getTime() - c.startedAt.getTime()) / 60000);
    }
  }

  for (const row of byNumber.values()) {
    if (row.attempts > 0) {
      const numCalls = calls.filter((c) => c.phoneNumberId === row.phoneNumberId);
      const ans = numCalls.filter((c) => c.answeredAt).length;
      row.answerRate = Math.round((ans / row.attempts) * 1000) / 10;
      const hum = numCalls.filter((c) => {
        const att = attemptByCall.get(c.id as string);
        return isHumanConversation(att?.disposition || null, att?.answerClassification || null);
      }).length;
      row.humanConversationRate = Math.round((hum / row.attempts) * 1000) / 10;
      const scr = numCalls.filter((c) => {
        const att = attemptByCall.get(c.id as string);
        return att?.answerClassification === "screener";
      }).length;
      row.screeningRate = Math.round((scr / row.attempts) * 1000) / 10;
      if (row.failedCalls / row.attempts > 0.35) row.healthState = "elevated_failures";
      else if (row.answerRate != null && row.answerRate < 5) row.healthState = "low_answer_rate";
    }
  }

  return [...byNumber.values()];
}
