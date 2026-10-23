import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { isHumanConversation } from "@/lib/server/phone/power-dialer/disposition-effects";
import { listPowerDialerNumberHealth } from "@/lib/server/phone/power-dialer/number-health-service";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ phoneNumberId: string }> },
) {
  try {
    const { phoneNumberId } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const prisma = getPrisma();
    const num = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId, workspaceId },
    });
    if (!num) return NextResponse.json({ error: "Number not found" }, { status: 404 });

    const calls = await prisma.humanCall.findMany({
      where: { workspaceId, source: "power_dialer", phoneNumberId },
      orderBy: { startedAt: "desc" },
      take: 500,
      select: {
        id: true,
        startedAt: true,
        answeredAt: true,
        status: true,
        disposition: true,
        endedAt: true,
      },
    });

    const attemptRows = await prisma.powerDialerAttempt.findMany({
      where: { workspaceId, humanCallId: { in: calls.map((c) => c.id) } },
      select: { humanCallId: true, answerClassification: true, disposition: true },
    });
    const byCall = new Map(attemptRows.map((a) => [a.humanCallId!, a]));

    const byMonth = new Map<string, { attempts: number; answered: number; human: number; screened: number }>();
    for (const c of calls) {
      const key = c.startedAt.toISOString().slice(0, 7);
      const bucket = byMonth.get(key) || { attempts: 0, answered: 0, human: 0, screened: 0 };
      bucket.attempts += 1;
      if (c.answeredAt) bucket.answered += 1;
      const att = byCall.get(c.id);
      if (att?.answerClassification === "screener") bucket.screened += 1;
      if (isHumanConversation(att?.disposition || c.disposition, att?.answerClassification || null)) {
        bucket.human += 1;
      }
      byMonth.set(key, bucket);
    }

    const healthRows = await listPowerDialerNumberHealth(workspaceId);
    const health = healthRows.find((h) => h.phoneNumberId === phoneNumberId) || null;

    return NextResponse.json({
      data: {
        phoneNumberId: num.id,
        e164: num.e164,
        nickname: num.friendlyName,
        registrationStatus: health?.registrationStatus || "Unknown",
        health,
        trend: [...byMonth.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, m]) => ({ month, ...m })),
        recentOutcomes: calls.slice(0, 25).map((c) => {
          const att = byCall.get(c.id);
          return {
            callId: c.id,
            at: c.startedAt.toISOString(),
            status: c.status,
            disposition: att?.disposition || c.disposition,
            answerClassification: att?.answerClassification || null,
          };
        }),
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
