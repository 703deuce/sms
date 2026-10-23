import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { withPublicApi, paginated } from "@/lib/server/phone/power-dialer/public-api/http";

export async function GET(request: Request) {
  return withPublicApi(request, "attempts:read", async (ctx) => {
    const url = new URL(request.url);
    const page = Math.max(0, Number(url.searchParams.get("page") || 0));
    const limit = Math.min(100, Number(url.searchParams.get("limit") || 25));
    const sessionId = url.searchParams.get("sessionId");
    const contactId = url.searchParams.get("contactId");
    const prisma = getPrisma();
    const where = {
      workspaceId: ctx.workspaceId,
      ...(sessionId ? { sessionId } : {}),
      ...(contactId ? { contactId } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.powerDialerAttempt.count({ where }),
      prisma.powerDialerAttempt.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: page * limit,
        take: limit,
        select: {
          id: true,
          sessionId: true,
          contactId: true,
          status: true,
          disposition: true,
          dialedPhoneE164: true,
          createdAt: true,
          endedAt: true,
        },
      }),
    ]);
    return NextResponse.json(paginated(rows, page, limit, total));
  });
}
