import { getPrisma } from "@/lib/db";
import { visibleContactWhere } from "@/lib/contacts/visible-contacts";

/** Keep only visible contact IDs that belong to the workspace. */
export async function filterWorkspaceContactIds(
  workspaceId: string,
  contactIds: string[],
): Promise<string[]> {
  const unique = [...new Set(contactIds.filter(Boolean))];
  if (!unique.length) return [];
  const rows = await getPrisma().contact.findMany({
    where: {
      ...visibleContactWhere(workspaceId),
      id: { in: unique },
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Count list members excluding automation/system contacts. */
export async function countVisibleListMembers(
  workspaceId: string,
  listId: string,
): Promise<number> {
  const members = await getPrisma().contactListMember.findMany({
    where: { listId },
    select: { contactId: true },
  });
  if (!members.length) return 0;
  return getPrisma().contact.count({
    where: {
      ...visibleContactWhere(workspaceId),
      id: { in: members.map((m) => m.contactId) },
    },
  });
}

/** Batch count visible members per list (Supabase compat cannot filter contact.listMembers). */
export async function countVisibleListMembersBulk(
  workspaceId: string,
  listIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const listId of listIds) counts.set(listId, 0);
  if (!listIds.length) return counts;

  const members = await getPrisma().contactListMember.findMany({
    where: { listId: { in: listIds } },
    select: { listId: true, contactId: true },
  });
  const contactIds = [...new Set(members.map((m) => m.contactId))];
  const visibleIds = contactIds.length
    ? new Set(
        (
          await getPrisma().contact.findMany({
            where: { ...visibleContactWhere(workspaceId), id: { in: contactIds } },
            select: { id: true },
          })
        ).map((c) => c.id),
      )
    : new Set<string>();

  for (const member of members) {
    if (!visibleIds.has(member.contactId)) continue;
    counts.set(member.listId, (counts.get(member.listId) || 0) + 1);
  }
  return counts;
}

/** Resolve a contact where-clause, expanding list/tag filters via join tables. */
export async function resolveVisibleContactFilter(
  workspaceId: string,
  opts?: { status?: string; listId?: string; tagId?: string },
) {
  const base = visibleContactWhere(workspaceId, { status: opts?.status });
  if (opts?.listId) {
    const members = await getPrisma().contactListMember.findMany({
      where: { listId: opts.listId },
      select: { contactId: true },
    });
    const ids = members.map((m) => m.contactId);
    return { ...base, id: { in: ids.length ? ids : ["__none__"] } };
  }
  if (opts?.tagId) {
    const members = await getPrisma().contactTag.findMany({
      where: { tagId: opts.tagId },
      select: { contactId: true },
    });
    const ids = members.map((m) => m.contactId);
    return { ...base, id: { in: ids.length ? ids : ["__none__"] } };
  }
  return base;
}

/** Keep only list IDs that belong to the workspace. */
export async function filterWorkspaceListIds(
  workspaceId: string,
  listIds: string[],
): Promise<string[]> {
  const unique = [...new Set(listIds.filter(Boolean))];
  if (!unique.length) return [];
  const rows = await getPrisma().contactList.findMany({
    where: { workspaceId, id: { in: unique } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
