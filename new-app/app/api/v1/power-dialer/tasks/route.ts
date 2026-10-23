import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { withPublicApi, paginated } from "@/lib/server/phone/power-dialer/public-api/http";

export async function GET(request: Request) {
  return withPublicApi(request, "tasks:read", async (ctx) => {
    const url = new URL(request.url);
    const page = Math.max(0, Number(url.searchParams.get("page") || 0));
    const limit = Math.min(100, Number(url.searchParams.get("limit") || 25));
    const prisma = getPrisma();
    const where = { workspaceId: ctx.workspaceId };
    const [total, rows] = await Promise.all([
      prisma.crmTask.count({ where }),
      prisma.crmTask.findMany({
        where,
        orderBy: { dueAt: "asc" },
        skip: page * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          notes: true,
          status: true,
          contactId: true,
          dueAt: true,
          assigneeUserId: true,
        },
      }),
    ]);
    return NextResponse.json(paginated(rows, page, limit, total));
  });
}

export async function POST(request: Request) {
  return withPublicApi(request, "tasks:write", async (ctx) => {
    const body = (await request.json()) as {
      title?: string;
      contactId?: string;
      notes?: string;
      dueAt?: string;
      assigneeUserId?: string;
    };
    if (!body.title?.trim()) {
      return NextResponse.json({ error: { code: "validation", message: "title required" } }, { status: 400 });
    }
    const prisma = getPrisma();
    const task = await prisma.crmTask.create({
      data: {
        workspaceId: ctx.workspaceId,
        title: body.title.trim(),
        contactId: body.contactId || null,
        notes: body.notes || null,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        assigneeUserId: body.assigneeUserId || null,
      },
    });
    return NextResponse.json({ data: task });
  });
}
