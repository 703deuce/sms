import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { mapContact } from "@/lib/mappers";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  fireContactAddedAutomations,
  shouldRunContactAddedAutomations,
} from "@/lib/automate/contact-added-triggers";

const CONTACT_STATUSES = new Set(["SUBSCRIBED", "UNSUBSCRIBED", "BLOCKED", "INVALID"]);

const contactInclude = {
  tagMembers: { include: { tag: true } },
  listMembers: { include: { list: true } },
} as const;

type ContactRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  email: string | null;
  status: string;
  consentSource: string | null;
  consentDate: Date | string | null;
  lastMessaged: Date | string | null;
  lastReply: Date | string | null;
  createdAt?: Date | string;
  assignedUser: string | null;
  company?: string | null;
  customFields?: unknown;
  tagMembers?: Array<{ tag: { name: string } }>;
  listMembers?: Array<{ list: { name: string } }>;
};

function mapContactRows(rows: ContactRow[]) {
  return rows.map((c) =>
    mapContact({
      ...c,
      tags: c.tagMembers,
      lists: c.listMembers,
    }),
  );
}

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

    if (phone) {
      const normalized = normalizeE164(phone);
      const rows = await getPrisma().contact.findMany({
        where: { workspaceId: auth.workspaceId, phone: normalized },
        include: contactInclude,
        take: 5,
      });
      return NextResponse.json({ data: mapContactRows(rows as ContactRow[]) });
    }

    if (q) {
      const rows = await getPrisma().contact.findMany({
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
        include: contactInclude,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      });
      return NextResponse.json({ data: mapContactRows(rows as ContactRow[]) });
    }

    const rows = await getPrisma().contact.findMany({
      where: {
        workspaceId: auth.workspaceId,
        ...(status
          ? { status: status.toUpperCase() as "SUBSCRIBED" | "UNSUBSCRIBED" | "BLOCKED" | "INVALID" }
          : {}),
      },
      include: contactInclude,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    });
    return NextResponse.json({ data: mapContactRows(rows as ContactRow[]) });
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
      status?: string;
    };
    if (!body.phone) {
      return NextResponse.json({ error: "phone is required" }, { status: 400 });
    }
    const phone = normalizeE164(body.phone);
    const consentSource = body.consentSource || "manual";
    const statusRaw = (body.status || "SUBSCRIBED").toUpperCase();
    const status = CONTACT_STATUSES.has(statusRaw)
      ? (statusRaw as "SUBSCRIBED" | "UNSUBSCRIBED" | "BLOCKED" | "INVALID")
      : "SUBSCRIBED";

    const prisma = getPrisma();
    const existing = await prisma.contact.findUnique({
      where: { workspaceId_phone: { workspaceId: auth.workspaceId, phone } },
      select: { id: true, customFields: true, consentSource: true },
    });

    const contact = await prisma.contact.upsert({
      where: { workspaceId_phone: { workspaceId: auth.workspaceId, phone } },
      create: {
        workspaceId: auth.workspaceId,
        phone,
        firstName: body.firstName || null,
        lastName: body.lastName || null,
        email: body.email || null,
        status,
        consentSource,
        consentDate: new Date(),
      },
      update: {
        firstName: body.firstName || undefined,
        lastName: body.lastName || undefined,
        email: body.email || undefined,
        status,
        ...(consentSource === "manual" ? { consentSource, consentDate: new Date() } : {}),
      },
    });

    const isNew = !existing;
    let automations: Awaited<ReturnType<typeof fireContactAddedAutomations>> | null = null;

    if (shouldRunContactAddedAutomations(existing, consentSource)) {
      const { emitAutomationEvent } = await import("@/lib/automations/events");
      await emitAutomationEvent(auth.workspaceId, "customer.created", contact.id).catch(() => undefined);
      automations = await fireContactAddedAutomations(auth.workspaceId, contact.id, {
        consentSource,
      });
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

    return NextResponse.json(
      {
        data: contact,
        meta: {
          created: isNew,
          automations,
        },
      },
      { status: isNew ? 201 : 200 },
    );
  } catch (err) {
    return jsonError(err, 400);
  }
}
