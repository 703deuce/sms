import { getPrisma } from "@/lib/db";
import { filterWorkspaceListIds } from "@/lib/contacts/workspace-membership";

/** Find existing lists by name or create missing ones for imports / creates. */
export async function resolveOrCreateListIdsByName(
  workspaceId: string,
  names: string[],
): Promise<string[]> {
  const uniqueNames = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!uniqueNames.length) return [];

  const prisma = getPrisma();
  const ids: string[] = [];
  for (const name of uniqueNames) {
    const existing = await prisma.contactList.findFirst({
      where: { workspaceId, name },
      select: { id: true },
    });
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const created = await prisma.contactList.create({
      data: {
        workspaceId,
        name,
        description: `Import ${new Date().toISOString().slice(0, 10)}`,
      },
      select: { id: true },
    });
    ids.push(created.id);
  }
  return ids;
}

/** Add a contact to each list (idempotent). */
export async function assignContactToLists(
  workspaceId: string,
  contactId: string,
  listIds: string[],
): Promise<void> {
  const validListIds = await filterWorkspaceListIds(workspaceId, listIds);
  if (!validListIds.length) return;

  const prisma = getPrisma();
  for (const listId of validListIds) {
    await prisma.contactListMember.upsert({
      where: { listId_contactId: { listId, contactId } },
      create: { listId, contactId },
      update: {},
    }).catch(() => undefined);

    const { dispatchAutoReplies } = await import("@/lib/auto-replies/dispatch");
    await dispatchAutoReplies({
      workspaceId,
      contactId,
      triggerType: "list_join",
      listId,
    }).catch(() => undefined);
    const { triggerDripCampaigns } = await import("@/lib/drip-campaigns/engine");
    await triggerDripCampaigns({
      workspaceId,
      contactId,
      triggerType: "list_join",
      listId,
    }).catch(() => undefined);
  }
}
