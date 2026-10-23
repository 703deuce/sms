import { getPrisma } from "@/lib/server/db";

const INELIGIBLE_STATUSES = new Set(["BLOCKED", "UNSUBSCRIBED", "INVALID"]);

export async function countListEligibilityByListIds(
  workspaceId: string,
  listIds: string[],
): Promise<Map<string, { total: number; eligible: number; ineligible: number }>> {
  const prisma = getPrisma();
  const map = new Map<string, { total: number; eligible: number; ineligible: number }>();
  if (!listIds.length) return map;

  const members = await prisma.contactListMember.findMany({
    where: { listId: { in: listIds }, contact: { workspaceId } },
    select: { listId: true, contact: { select: { status: true } } },
  });

  for (const id of listIds) {
    map.set(id, { total: 0, eligible: 0, ineligible: 0 });
  }
  for (const m of members) {
    const cur = map.get(m.listId)!;
    cur.total += 1;
    if (INELIGIBLE_STATUSES.has(m.contact.status)) cur.ineligible += 1;
    else cur.eligible += 1;
  }
  return map;
}
