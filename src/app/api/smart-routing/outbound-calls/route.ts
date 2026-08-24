import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { initiateDashboardOutboundBridge } from "@/lib/smart-routing/dashboard-outbound-bridge";
import type { OutboundContextType } from "@/lib/smart-routing/outbound-bridge";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const limit = Math.min(
      Number(new URL(request.url).searchParams.get("limit") || "50"),
      100,
    );
    const prisma = getPrisma();
    const rows = await prisma.smartRoutingOutboundCall.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        authorizedCaller: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const destinationE164 = String(body.destinationE164 || "").trim();
    const authorizedCallerId = String(body.authorizedCallerId || "").trim();
    const contextType = String(body.contextType || "manual") as OutboundContextType;
    const contextRefId = body.contextRefId ? String(body.contextRefId) : null;

    if (!destinationE164 || !authorizedCallerId) {
      return jsonError(new Error("destinationE164 and authorizedCallerId are required"), 400);
    }

    const result = await initiateDashboardOutboundBridge({
      workspaceId: auth.workspaceId,
      authorizedCallerId,
      destinationE164,
      contextType,
      contextRefId,
      initiatedByUserId: auth.session.userId,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
