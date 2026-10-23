import { getPrisma } from "@/lib/server/db";
import { assertCrmRead, contactVisibleToUser } from "./permissions";
import { buildUnifiedContactTimeline } from "./contact-timeline";

export async function getNativeContactDetail(
  workspaceId: string,
  contactId: string,
  opts?: { includeRecordings?: boolean },
) {
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

  const custom =
    contact.customFields && typeof contact.customFields === "object"
      ? (contact.customFields as Record<string, unknown>)
      : {};
  const timeline = await buildUnifiedContactTimeline(workspaceId, contactId, {
    includeRecordings: opts?.includeRecordings ?? isAdmin,
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
    refresherNotes: typeof custom.refresherNotes === "string" ? custom.refresherNotes : null,
    timeline,
    contactHref: `/app/contacts/${contact.id}`,
  };
}
