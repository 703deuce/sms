import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { withPublicApi } from "@/lib/server/phone/power-dialer/public-api/http";

/** Zapier polling trigger sample — returns recent dispositioned attempts (real schema). */
export async function GET(request: Request) {
  return withPublicApi(request, "attempts:read", async (ctx) => {
    const prisma = getPrisma();
    const rows = await prisma.powerDialerAttempt.findMany({
      where: { workspaceId: ctx.workspaceId, disposition: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        disposition: true,
        createdAt: true,
        contactId: true,
        session: { select: { campaignId: true, repUserId: true } },
      },
    });
    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        disposition: r.disposition,
        contactId: r.contactId,
        campaignId: r.session.campaignId,
        repUserId: r.session.repUserId,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  });
}
