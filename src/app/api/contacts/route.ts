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
    const q = searchParams.get("q")?.trim();
    const phone = searchParams.get("phone")?.trim();
    const take = Math.min(200, Math.max(1, Number(searchParams.get("take") || 50)));
    const skip = Math.max(0, Number(searchParams.get("skip") || 0));

    const include = { tagMembers: { include: { tag: true } } };

    if (phone) {
      const normalized = normalizeE164(phone);
      const data = await getPrisma().contact.findMany({
        where: { workspaceId: auth.workspaceId, phone: normalized },
        include,
        take: 5,
      });
      return NextResponse.json({ data });
    }

    if (q) {
      const data = await getPrisma().contact.findMany({
        where: {
          workspaceId: auth.workspaceId,
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
          ],
        },
        include,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      });
      return NextResponse.json({ data });
    }

    const data = await getPrisma().contact.findMany({
      where: {
        workspaceId: auth.workspaceId,
        ...(status
          ? { status: status.toUpperCase() as "SUBSCRIBED" | "UNSUBSCRIBED" | "BLOCKED" | "INVALID" }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
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
      const { dispatchAutoReplies } = await import("@/lib/auto-replies/dispatch");
      await dispatchAutoReplies({
        workspaceId: auth.workspaceId,
        contactId: contact.id,
        triggerType: "contact_added",
      }).catch(() => undefined);
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
