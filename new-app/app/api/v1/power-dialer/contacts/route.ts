import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { withPublicApi, paginated } from "@/lib/server/phone/power-dialer/public-api/http";

export async function GET(request: Request) {
  return withPublicApi(request, "contacts:read", async (ctx) => {
    const url = new URL(request.url);
    const page = Math.max(0, Number(url.searchParams.get("page") || 0));
    const limit = Math.min(100, Number(url.searchParams.get("limit") || 25));
    const prisma = getPrisma();
    const where = { workspaceId: ctx.workspaceId };
    const [total, rows] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: page * limit,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          company: true,
          leadSource: true,
          updatedAt: true,
        },
      }),
    ]);
    return NextResponse.json(paginated(rows, page, limit, total));
  });
}

export async function POST(request: Request) {
  return withPublicApi(request, "contacts:write", async (ctx) => {
    const body = (await request.json()) as {
      phone?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      company?: string;
    };
    if (!body.phone?.trim()) {
      return NextResponse.json(
        { error: { code: "validation", message: "phone is required" } },
        { status: 400 },
      );
    }
    const { normalizeE164 } = await import("@/lib/server/phone/normalize");
    const phone = normalizeE164(body.phone);
    const prisma = getPrisma();
    const contact = await prisma.contact.upsert({
      where: { workspaceId_phone: { workspaceId: ctx.workspaceId, phone } },
      create: {
        workspaceId: ctx.workspaceId,
        phone,
        firstName: body.firstName?.trim() || "Unknown",
        lastName: body.lastName?.trim() || null,
        email: body.email?.trim() || null,
        company: body.company?.trim() || null,
        leadSource: "api",
      },
      update: {
        firstName: body.firstName?.trim() || undefined,
        lastName: body.lastName?.trim() || undefined,
        email: body.email?.trim() || undefined,
        company: body.company?.trim() || undefined,
      },
    });
    const { pdWebhookContactCreated, pdWebhookContactUpdated } = await import(
      "@/lib/server/phone/power-dialer/webhooks/lifecycle"
    );
    pdWebhookContactCreated({
      workspaceId: ctx.workspaceId,
      contactId: contact.id,
      source: "api",
    });
    pdWebhookContactUpdated({ workspaceId: ctx.workspaceId, contactId: contact.id });
    return NextResponse.json({ data: contact });
  });
}
