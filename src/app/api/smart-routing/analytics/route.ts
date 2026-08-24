import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const days = Number(new URL(request.url).searchParams.get("days") || "30");
    const since = new Date();
    since.setDate(since.getDate() - Math.min(Math.max(days, 1), 90));
    const prisma = getPrisma();
    const sessions = await prisma.smartRoutingCallSession.findMany({
      where: { workspaceId: auth.workspaceId, startedAt: { gte: since } },
      select: { finalOutcome: true, flowId: true, startedAt: true },
    });
    const total = sessions.length;
    const answered = sessions.filter((s: { finalOutcome: string | null }) =>
      ["answered", "completed", "transferred", "connected"].includes(String(s.finalOutcome || "").toLowerCase()),
    ).length;
    const noAnswer = sessions.filter((s: { finalOutcome: string | null }) =>
      String(s.finalOutcome || "").toLowerCase().includes("no_answer"),
    ).length;
    const byFlow: Record<string, number> = {};
    for (const s of sessions) {
      const fid = s.flowId || "unknown";
      byFlow[fid] = (byFlow[fid] || 0) + 1;
    }
    const outbound = await prisma.smartRoutingOutboundCall.count({
      where: { workspaceId: auth.workspaceId, createdAt: { gte: since } },
    }).catch(() => 0);
    return NextResponse.json({
      data: {
        periodDays: days,
        callsRouted: total,
        answered,
        noAnswer,
        answerRate: total > 0 ? Math.round((answered / total) * 100) : 0,
        outboundBusinessCallbacks: outbound,
        byFlow,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
