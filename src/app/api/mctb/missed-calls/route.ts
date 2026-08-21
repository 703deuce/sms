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
      events: events.map((e: (typeof events)[number]) => ({
        id: e.id,
        callerE164: e.callerE164,
        businessE164: e.businessE164,
        status: e.status,
        suppressionReason: e.suppressionReason,
        detectedAt: e.detectedAt,
        smsSentAt: e.smsSentAt,
        classification: e.disposition,
      })),
    },
  });
}
