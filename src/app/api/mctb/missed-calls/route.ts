import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  const prisma = getPrisma();
  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 50)));

  const events = await prisma.missedCallEvent.findMany({
    where: { workspaceId },
    orderBy: { detectedAt: "desc" },
    take: limit,
  });

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const { countCallerMissedEventsToday } = await import("@/lib/mctb/repeat-caller");

  const [missedToday, sentToday, repliedToday] = await Promise.all([
    prisma.missedCallEvent.count({
      where: { workspaceId, detectedAt: { gte: start } },
    }),
    prisma.missedCallEvent.count({
      where: { workspaceId, smsSentAt: { gte: start } },
    }),
    prisma.missedCallEvent.count({
      where: {
        workspaceId,
        status: "CUSTOMER_REPLIED",
        updatedAt: { gte: start },
      },
    }),
  ]);

  return NextResponse.json({
    data: {
      summary: { missedToday, sentToday, repliedToday },
      events: await Promise.all(
        events.map(async (e: (typeof events)[number]) => {
          const meta =
            e.metadata && typeof e.metadata === "object"
              ? (e.metadata as Record<string, unknown>)
              : {};
          const repeat = await countCallerMissedEventsToday(workspaceId, e.callerE164);
          return {
            id: e.id,
            callerE164: e.callerE164,
            businessE164: e.businessE164,
            transovoNumberE164:
              typeof meta.transovoNumberE164 === "string" ? meta.transovoNumberE164 : null,
            status: e.status,
            suppressionReason: e.suppressionReason,
            detectedAt: e.detectedAt,
            scheduledSmsAt: e.scheduledSmsAt,
            smsSentAt: e.smsSentAt,
            classification: e.disposition,
            consentMode: typeof meta.consentMode === "string" ? meta.consentMode : null,
            eligibilityStatus:
              typeof meta.eligibilityStatus === "string" ? meta.eligibilityStatus : null,
            captureMode: typeof meta.captureMode === "string" ? meta.captureMode : null,
            voiceCaptureStatus:
              typeof meta.voiceCaptureStatus === "string" ? meta.voiceCaptureStatus : null,
            callsToday: repeat.missedToday,
            totalCalls: repeat.total,
          };
        }),
      ),
    },
  });
}
