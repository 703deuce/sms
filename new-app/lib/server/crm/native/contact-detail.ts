import { getPrisma } from "@/lib/server/db";
import { assertCrmRead, contactVisibleToUser } from "./permissions";

export async function getNativeContactDetail(workspaceId: string, contactId: string) {
  const { userId, isAdmin } = await assertCrmRead(workspaceId);
  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, workspaceId },
    include: {
      phones: { orderBy: { priority: "asc" } },
      customFieldValues: { include: { field: true } },
      crmCompany: true,
      deals: { include: { stage: true }, take: 10 },
      tasks: { where: { status: { not: "done" } }, orderBy: { dueAt: "asc" }, take: 20 },
      activityEvents: { orderBy: { occurredAt: "desc" }, take: 50 },
    },
  });
  if (!contact) throw new Error("Contact not found");
  if (!contactVisibleToUser(contact, userId, isAdmin)) throw new Error("Not allowed to view this contact");

  const pdAttempts = await prisma.powerDialerAttempt.findMany({
    where: { workspaceId, contactId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      disposition: true,
      status: true,
      createdAt: true,
      session: { select: { campaign: { select: { name: true, id: true } } } },
    },
  });

  return {
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    phone: contact.phone,
    email: contact.email,
    title: contact.title,
    company: contact.company,
    crmCompany: contact.crmCompany,
    leadSource: contact.leadSource,
    leadStage: contact.leadStage,
    ownerUserId: contact.ownerUserId || contact.assignedUser,
    timezone: contact.timezone,
    timezoneInferred: contact.timezoneInferred,
    status: contact.status,
    phones: contact.phones,
    customFields: contact.customFieldValues.map((v) => ({
      key: v.field.key,
      label: v.field.label,
      type: v.field.fieldType,
      value: v.valueText ?? v.valueNumber ?? v.valueJson,
    })),
    deals: contact.deals,
    tasks: contact.tasks,
    timeline: [
      ...contact.activityEvents.map((e) => ({
        id: e.id,
        kind: e.kind,
        title: e.title,
        body: e.body,
        at: e.occurredAt.toISOString(),
      })),
      ...pdAttempts.map((a) => ({
        id: `pd-${a.id}`,
        kind: "power_dialer_call",
        title: `Power Dialer · ${a.session.campaign.name}`,
        body: a.disposition || a.status,
        at: a.createdAt.toISOString(),
        href: `/app/power-dialer/call-history?attempt=${a.id}`,
      })),
    ].sort((a, b) => b.at.localeCompare(a.at)),
    contactHref: `/app/contacts/${contact.id}`,
  };
}
