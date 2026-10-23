import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { withPublicApi, paginated } from "@/lib/server/phone/power-dialer/public-api/http";

export async function GET(request: Request) {
  return withPublicApi(request, "sessions:read", async (ctx) => {
    const url = new URL(request.url);
    const page = Math.max(0, Number(url.searchParams.get("page") || 0));
    const limit = Math.min(100, Number(url.searchParams.get("limit") || 25));
    const status = url.searchParams.get("status");
    const prisma = getPrisma();
    const where = {
      workspaceId: ctx.workspaceId,
      ...(status ? { status } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.powerDialerSession.count({ where }),
      prisma.powerDialerSession.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip: page * limit,
        take: limit,
        select: {
          id: true,
          campaignId: true,
          repUserId: true,
          status: true,
          startedAt: true,
          endedAt: true,
        },
      }),
    ]);
    return NextResponse.json(paginated(rows, page, limit, total));
  });
}
