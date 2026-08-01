import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const data = await getPrisma().contact.findMany({
      where: {
        workspaceId: auth.workspaceId,
        ...(status
          ? { status: status.toUpperCase() as "SUBSCRIBED" | "UNSUBSCRIBED" | "BLOCKED" | "INVALID" }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      phone?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      consentSource?: string;
    };
    if (!body.phone) {
      return NextResponse.json({ error: "phone is required" }, { status: 400 });
    }
    const phone = normalizeE164(body.phone);
    const contact = await getPrisma().contact.upsert({
      where: { workspaceId_phone: { workspaceId: auth.workspaceId, phone } },
      create: {
        workspaceId: auth.workspaceId,
        phone,
        firstName: body.firstName || null,
        lastName: body.lastName || null,
        email: body.email || null,
        status: "SUBSCRIBED",
        consentSource: body.consentSource || "manual",
        consentDate: new Date(),
      },
      update: {
        firstName: body.firstName || undefined,
        lastName: body.lastName || undefined,
        email: body.email || undefined,
      },
    });

    const isNew = contact.createdAt.getTime() > Date.now() - 5000;
    if (isNew) {
      const { emitAutomationEvent } = await import("@/lib/automations/events");
      await emitAutomationEvent(auth.workspaceId, "customer.created", contact.id).catch(() => undefined);
    }

    try {
      const { publishContactEvent } = await import("@/lib/crm/events");
      await publishContactEvent({
        workspaceId: auth.workspaceId,
        contactId: contact.id,
        type: isNew ? "contact.created" : "contact.updated",
        payload: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          phone: contact.phone,
          email: contact.email,
        },
      });
    } catch {
      // CRM push is optional
    }

    return NextResponse.json({ data: contact }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
