import { getPrisma } from "@/lib/server/db";
import { isHumanConversation } from "./disposition-effects";

export type NumberHealthRow = {
  phoneNumberId: string;
  e164: string;
  nickname: string | null;
  attempts: number;
  minutes: number;
  answerRate: number | null;
  humanConversationRate: number | null;
  screeningRate: number | null;
  failedCalls: number;
  registrationStatus: string;
};

export async function listPowerDialerNumberHealth(workspaceId: string): Promise<NumberHealthRow[]> {
  const prisma = getPrisma();
  const numbers = await prisma.phoneNumber.findMany({
    where: { workspaceId },
    select: { id: true, e164: true, friendlyName: true },
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
    byNumber.set(n.id, {
      phoneNumberId: n.id,
      e164: n.e164,
      nickname: n.friendlyName,
      attempts: 0,
      minutes: 0,
      answerRate: null,
      humanConversationRate: null,
      screeningRate: null,
      failedCalls: 0,
      registrationStatus: "Unknown",
    });
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
    }
  }

  return [...byNumber.values()].filter((r) => r.attempts > 0 || numbers.some((n) => n.id === r.phoneNumberId));
}
