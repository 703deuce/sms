import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { withPublicApi } from "@/lib/server/phone/power-dialer/public-api/http";

/** Zapier polling trigger — recent contacts (schema sample, not fabricated prod rows). */
export async function GET(request: Request) {
  return withPublicApi(request, "contacts:read", async (ctx) => {
    const prisma = getPrisma();
    const rows = await prisma.contact.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        company: true,
        updatedAt: true,
      },
    });
    return NextResponse.json(rows);
  });
}
