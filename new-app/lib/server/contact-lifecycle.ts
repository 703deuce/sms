import { getPrisma } from "@/lib/server/db";

export type ContactRemovalResult =
  | { action: "deleted" }
  | { action: "archived"; reason: string };

/** Delete contact when safe; otherwise mark inactive and detach from lists. */
export async function deleteOrArchiveContact(
  workspaceId: string,
  contactId: string,
): Promise<ContactRemovalResult> {
  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({ where: { id: contactId, workspaceId } });
  if (!contact) throw new Error("Contact not found");

  const [attempts, callbacks, conversations, humanCalls] = await Promise.all([
    prisma.powerDialerAttempt.count({ where: { workspaceId, contactId } }),
    prisma.powerDialerCallback.count({ where: { workspaceId, contactId } }),
    prisma.conversation.count({ where: { workspaceId, contactId } }),
    prisma.humanCall.count({ where: { workspaceId, contactId } }),
  ]);

  const referenced = attempts + callbacks + conversations + humanCalls > 0;

  if (referenced) {
    const custom =
      contact.customFields && typeof contact.customFields === "object"
        ? (contact.customFields as Record<string, unknown>)
        : {};
    await prisma.$transaction([
      prisma.contactListMember.deleteMany({ where: { contactId } }),
      prisma.contact.update({
        where: { id: contactId },
        data: {
          status: "INVALID",
          customFields: {
            ...custom,
            archivedAt: new Date().toISOString(),
            archivedReason: "power_dialer_contact_delete",
          },
        },
      }),
    ]);
    return {
      action: "archived",
      reason:
        "Contact has call or messaging history and was marked inactive instead of deleted.",
    };
  }

  await prisma.$transaction([
    prisma.contactListMember.deleteMany({ where: { contactId } }),
    prisma.contactTag.deleteMany({ where: { contactId } }),
    prisma.contact.delete({ where: { id: contactId } }),
  ]);
  return { action: "deleted" };
}
