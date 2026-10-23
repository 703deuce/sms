import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { withPublicApi, paginated } from "@/lib/server/phone/power-dialer/public-api/http";
import { upsertCallbackFromDisposition } from "@/lib/server/phone/power-dialer/callbacks-service";

export async function GET(request: Request) {
  return withPublicApi(request, "callbacks:read", async (ctx) => {
    const url = new URL(request.url);
    const page = Math.max(0, Number(url.searchParams.get("page") || 0));
    const limit = Math.min(100, Number(url.searchParams.get("limit") || 25));
    const prisma = getPrisma();
    const where = { workspaceId: ctx.workspaceId };
    const [total, rows] = await Promise.all([
      prisma.powerDialerCallback.count({ where }),
      prisma.powerDialerCallback.findMany({
        where,
        orderBy: { scheduledAt: "asc" },
        skip: page * limit,
        take: limit,
        select: {
          id: true,
          contactId: true,
          campaignId: true,
          scheduledAt: true,
          status: true,
          notes: true,
          assignedUserId: true,
        },
      }),
    ]);
    return NextResponse.json(paginated(rows, page, limit, total));
  });
}

export async function POST(request: Request) {
  return withPublicApi(request, "callbacks:write", async (ctx) => {
    const body = (await request.json()) as {
      campaignId?: string;
      contactId?: string;
      scheduledAt?: string;
      timezone?: string;
      notes?: string;
    };
    if (!body.campaignId || !body.contactId || !body.scheduledAt) {
      return NextResponse.json(
        { error: { code: "validation", message: "campaignId, contactId, scheduledAt required" } },
        { status: 400 },
      );
    }
    const prisma = getPrisma();
    const session = await prisma.powerDialerSession.findFirst({
      where: { workspaceId: ctx.workspaceId, campaignId: body.campaignId, status: { in: ["active", "paused"] } },
      orderBy: { startedAt: "desc" },
    });
    const attempt = session
      ? await prisma.powerDialerAttempt.findFirst({
          where: { sessionId: session.id, contactId: body.contactId },
          orderBy: { createdAt: "desc" },
        })
      : null;
    const row = await upsertCallbackFromDisposition({
      workspaceId: ctx.workspaceId,
      campaignId: body.campaignId,
      contactId: body.contactId,
      attemptId: attempt?.id || `api:${body.contactId}:${body.scheduledAt}`,
      scheduledAt: new Date(body.scheduledAt),
      timezone: body.timezone || "America/New_York",
      notes: body.notes,
      source: "api",
    });
    return NextResponse.json({ data: row });
  });
}
