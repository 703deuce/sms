import { getPrisma } from "@/lib/db";

/** Keep only contact IDs that belong to the workspace. */
export async function filterWorkspaceContactIds(
  workspaceId: string,
  contactIds: string[],
): Promise<string[]> {
  const unique = [...new Set(contactIds.filter(Boolean))];
  if (!unique.length) return [];
  const rows = await getPrisma().contact.findMany({
    where: { workspaceId, id: { in: unique } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
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
