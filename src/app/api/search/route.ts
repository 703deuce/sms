import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export type SearchResult = {
  id: string;
  type:
    | "contact"
    | "campaign"
    | "conversation"
    | "appointment"
    | "form_submission"
    | "external"
    | "task"
    | "order"
    | "deal"
    | "ticket";
  title: string;
  subtitle: string;
  href: string;
};

const PER_TYPE = 5;

function dedupe<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();

    if (q.length < 2) {
      return NextResponse.json({ data: [] });
    }

    const prisma = getPrisma();
    const workspaceId = auth.workspaceId;
    const results: SearchResult[] = [];

    // Contacts — search each field independently so the compat layer can use ILIKE.
    const contactQueries = ["firstName", "lastName", "phone", "email"].map((field) =>
      prisma.contact.findMany({
        where: { workspaceId, [field]: { contains: q, mode: "insensitive" } },
        take: PER_TYPE,
      }),
    );
    const contactRows = dedupe(
      (await Promise.all(contactQueries)).flat() as Array<{
        id: string;
        firstName: string | null;
        lastName: string | null;
        phone: string;
        email: string | null;
      }>,
    ).slice(0, PER_TYPE);

    for (const c of contactRows) {
      const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone;
      results.push({
        id: c.id,
        type: "contact",
        title: name,
        subtitle: c.phone || c.email || "Contact",
        href: `/contacts/${c.id}`,
      });
    }

    // Campaigns — by name.
    const campaignRows = (await prisma.campaign.findMany({
      where: { workspaceId, name: { contains: q, mode: "insensitive" } },
      take: PER_TYPE,
      orderBy: { createdAt: "desc" },
    })) as Array<{ id: string; name: string; status: string }>;
    for (const c of campaignRows) {
      results.push({
        id: c.id,
        type: "campaign",
        title: c.name,
        subtitle: `Campaign · ${c.status}`,
        href: `/campaigns/${c.id}`,
      });
    }

    // Conversations — resolve through matching contacts.
    if (contactRows.length) {
      const convRows = (await prisma.conversation.findMany({
        where: { workspaceId, contactId: { in: contactRows.map((c) => c.id) } },
        take: PER_TYPE,
        orderBy: { updatedAt: "desc" },
        include: { contact: true },
      })) as Array<{
        id: string;
        contact: { firstName: string | null; lastName: string | null; phone: string } | null;
      }>;
      for (const conv of convRows) {
        const name =
          [conv.contact?.firstName, conv.contact?.lastName].filter(Boolean).join(" ") ||
          conv.contact?.phone ||
          "Conversation";
        results.push({
          id: conv.id,
          type: "conversation",
          title: name,
          subtitle: "Conversation",
          href: `/conversations?conversation=${conv.id}`,
        });
      }
    }

    // Appointments (Calendly / HighLevel synced)
    const appointments = (await prisma.voiceAppointment.findMany({
      where: {
        workspaceId,
        OR: [
          { serviceName: { contains: q, mode: "insensitive" } },
          { externalId: { contains: q, mode: "insensitive" } },
          { staffName: { contains: q, mode: "insensitive" } },
        ],
      },
      take: PER_TYPE,
      orderBy: { startsAt: "desc" },
    })) as Array<{
      id: string;
      serviceName: string | null;
      startsAt: Date;
      contactId: string | null;
      externalId: string | null;
    }>;
    for (const a of appointments) {
      results.push({
        id: a.id,
        type: "appointment",
        title: a.serviceName || "Appointment",
        subtitle: `${new Date(a.startsAt).toLocaleString()}${a.externalId ? ` · ${a.externalId}` : ""}`,
        href: a.contactId ? `/contacts/${a.contactId}` : "/integrations/native/appointments",
      });
    }

    // Form submissions (Typeform / Jotform synced)
    const submissions = (await prisma.formSubmission.findMany({
      where: {
        workspaceId,
        OR: [
          { phone: { contains: q, mode: "insensitive" } },
        ],
      },
      take: PER_TYPE,
      orderBy: { createdAt: "desc" },
      include: { form: true },
    })) as Array<{
      id: string;
      phone: string;
      contactId: string | null;
      form: { name: string; slug: string | null };
    }>;
    for (const s of submissions) {
      results.push({
        id: s.id,
        type: "form_submission",
        title: s.form.name,
        subtitle: s.phone,
        href: s.contactId
          ? `/contacts/${s.contactId}`
          : "/integrations/native/leads",
      });
    }

    // External IDs from mappings (local only — no live provider calls)
    const mappings = (await prisma.crmObjectMapping.findMany({
      where: {
        workspaceId,
        OR: [
          { externalId: { contains: q, mode: "insensitive" } },
          { provider: { contains: q, mode: "insensitive" } },
        ],
      },
      take: PER_TYPE,
      orderBy: { lastSyncedAt: "desc" },
    })) as Array<{
      id: string;
      provider: string;
      objectType: string;
      externalId: string;
      internalId: string;
    }>;
    for (const m of mappings) {
      const type =
        m.objectType === "deal"
          ? ("deal" as const)
          : m.objectType === "support_ticket"
            ? ("ticket" as const)
            : ("external" as const);
      results.push({
        id: m.id,
        type,
        title: `${m.provider} ${m.objectType}`,
        subtitle: m.externalId,
        href: `/contacts/${m.internalId}`,
      });
    }

    const tasks = (await prisma.integrationTask.findMany({
      where: {
        workspaceId,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { externalId: { contains: q, mode: "insensitive" } },
          { provider: { contains: q, mode: "insensitive" } },
        ],
      },
      take: PER_TYPE,
      orderBy: { updatedAt: "desc" },
    })) as Array<{
      id: string;
      title: string;
      provider: string;
      externalId: string;
      contactId: string | null;
    }>;
    for (const t of tasks) {
      results.push({
        id: t.id,
        type: "task",
        title: t.title,
        subtitle: `${t.provider} · ${t.externalId}`,
        href: t.contactId ? `/contacts/${t.contactId}` : "/integrations/native/tasks",
      });
    }

    const orders = (await prisma.integrationOrder.findMany({
      where: {
        workspaceId,
        OR: [
          { orderNumber: { contains: q, mode: "insensitive" } },
          { externalId: { contains: q, mode: "insensitive" } },
          { customerEmail: { contains: q, mode: "insensitive" } },
          { customerPhone: { contains: q, mode: "insensitive" } },
          { customerName: { contains: q, mode: "insensitive" } },
          { provider: { contains: q, mode: "insensitive" } },
        ],
      },
      take: PER_TYPE,
      orderBy: { createdAt: "desc" },
    })) as Array<{
      id: string;
      orderNumber: string | null;
      provider: string;
      externalId: string;
      contactId: string | null;
    }>;
    for (const o of orders) {
      results.push({
        id: o.id,
        type: "order",
        title: `Order ${o.orderNumber || o.externalId}`,
        subtitle: o.provider,
        href: o.contactId ? `/contacts/${o.contactId}` : "/integrations/native/orders",
      });
    }

    return NextResponse.json({ data: results });
  } catch (err) {
    return jsonError(err, 500);
  }
}
