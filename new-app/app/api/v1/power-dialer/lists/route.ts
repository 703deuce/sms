import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { withPublicApi, paginated } from "@/lib/server/phone/power-dialer/public-api/http";

export async function GET(request: Request) {
  return withPublicApi(request, "lists:read", async (ctx) => {
    const url = new URL(request.url);
    const page = Math.max(0, Number(url.searchParams.get("page") || 0));
    const limit = Math.min(100, Number(url.searchParams.get("limit") || 25));
    const prisma = getPrisma();
    const where = { workspaceId: ctx.workspaceId };
    const [total, rows] = await Promise.all([
      prisma.contactList.count({ where }),
      prisma.contactList.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: page * limit,
        take: limit,
        select: { id: true, name: true, source: true, updatedAt: true },
      }),
    ]);
    return NextResponse.json(paginated(rows, page, limit, total));
  });
}
