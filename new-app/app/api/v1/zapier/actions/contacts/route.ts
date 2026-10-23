import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { withPublicApi } from "@/lib/server/phone/power-dialer/public-api/http";
import { pdWebhookContactCreated } from "@/lib/server/phone/power-dialer/webhooks/lifecycle";

export async function POST(request: Request) {
  return withPublicApi(request, "contacts:write", async (ctx) => {
    const body = (await request.json()) as Record<string, string | undefined>;
    const phone = body.phone?.trim();
    if (!phone) {
      return NextResponse.json({ error: { code: "validation", message: "phone required" } }, { status: 400 });
    }
    const { normalizeE164 } = await import("@/lib/server/phone/normalize");
    const e164 = normalizeE164(phone);
    const prisma = getPrisma();
    const contact = await prisma.contact.create({
      data: {
        workspaceId: ctx.workspaceId,
        phone: e164,
        firstName: body.firstName?.trim() || "Unknown",
        lastName: body.lastName?.trim() || null,
        email: body.email?.trim() || null,
        company: body.company?.trim() || null,
        leadSource: "zapier",
      },
    });
    pdWebhookContactCreated({ workspaceId: ctx.workspaceId, contactId: contact.id, source: "zapier" });
    return NextResponse.json(contact);
  });
}
