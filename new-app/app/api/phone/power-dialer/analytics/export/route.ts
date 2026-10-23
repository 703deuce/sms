import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import {
  attemptsToCsvRows,
  sessionsToCsvRows,
} from "@/lib/server/phone/power-dialer/analytics-service";
import {
  analyticsRepFilter,
  requirePowerDialerScope,
} from "@/lib/server/phone/power-dialer/power-dialer-permissions";

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const userId = await resolveInternalUserId();
    const { role } = await requirePowerDialerScope(workspaceId, userId, "analytics_export");
    const repFilter = analyticsRepFilter(role, userId);
    const url = new URL(request.url);
    const days = url.searchParams.get("days") === "90" ? 90 : url.searchParams.get("days") === "30" ? 30 : 7;
    const kind = url.searchParams.get("kind") === "sessions" ? "sessions" : "attempts";
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const prisma = getPrisma();
    if (kind === "sessions") {
      const sessions = await prisma.powerDialerSession.findMany({
        where: {
          workspaceId,
          startedAt: { gte: from },
          ...(repFilter ? { repUserId: repFilter } : {}),
        },
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          status: true,
          repUserId: true,
          campaignId: true,
          _count: { select: { attempts: true } },
        },
        orderBy: { startedAt: "desc" },
        take: 10_000,
      });
      const csv = sessionsToCsvRows(sessions);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="power-dialer-sessions-${days}d.csv"`,
        },
      });
    }
    const attempts = await prisma.powerDialerAttempt.findMany({
      where: {
        workspaceId,
        createdAt: { gte: from },
        ...(repFilter ? { session: { repUserId: repFilter } } : {}),
      },
      select: {
        id: true,
        createdAt: true,
        disposition: true,
        billableSeconds: true,
        session: { select: { campaignId: true, repUserId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10_000,
    });
    const csv = attemptsToCsvRows(attempts);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="power-dialer-attempts-${days}d.csv"`,
      },
    });
  } catch (err) {
    return jsonError(err, 403);
  }
}
