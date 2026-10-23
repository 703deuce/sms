import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";

export async function searchContacts(workspaceId: string, q: string, limit = 10) {
  const prisma = getPrisma();
  const term = q.trim();
  const digits = term.replace(/\D/g, "");
  return prisma.contact.findMany({
    where: {
      workspaceId,
      OR: [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { company: { contains: term, mode: "insensitive" } },
        ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
      ],
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });
}

export async function listContactLists(workspaceId: string) {
  const prisma = getPrisma();
  const lists = await prisma.contactList.findMany({
    where: { workspaceId, archivedAt: null },
    include: {
      powerDialerCampaigns: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const { countListEligibilityByListIds } = await import(
    "@/lib/server/phone/power-dialer/list-eligibility"
  );
  const counts = await countListEligibilityByListIds(workspaceId, lists.map((l) => l.id));
  return lists.map((l) => {
    const c = counts.get(l.id) || { total: 0, eligible: 0, ineligible: 0 };
    return {
      id: l.id,
      name: l.name,
      description: l.description,
      total: c.total,
      eligible: c.eligible,
      ineligible: c.ineligible,
      source: l.source || "manual",
      updated: l.updatedAt.toISOString(),
      campaignUsage: l.powerDialerCampaigns.map((c) => ({ id: c.id, name: c.name })),
    };
  });
}

export async function createContactList(workspaceId: string, name: string, description?: string) {
  const prisma = getPrisma();
  return prisma.contactList.create({
    data: { workspaceId, name, description },
  });
}

export async function importContactsToList(
  workspaceId: string,
  listId: string,
  rows: { name?: string; phone: string; company?: string }[],
) {
  const prisma = getPrisma();
  const list = await prisma.contactList.findFirst({ where: { id: listId, workspaceId } });
  if (!list) throw new Error("List not found");

  const results = { imported: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    try {
      const phone = normalizeE164(row.phone);
      const parts = (row.name || "").trim().split(/\s+/);
      const firstName = parts[0] || null;
      const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;

      const contact = await prisma.contact.upsert({
        where: { workspaceId_phone: { workspaceId, phone } },
        create: {
          workspaceId,
          phone,
          firstName,
          lastName,
          company: row.company || null,
        },
        update: {
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
          ...(row.company ? { company: row.company } : {}),
        },
      });

      await prisma.contactListMember.upsert({
        where: { listId_contactId: { listId, contactId: contact.id } },
        create: { listId, contactId: contact.id },
        update: {},
      });
      results.imported++;
    } catch (e) {
      results.skipped++;
      results.errors.push(e instanceof Error ? e.message : "Invalid row");
    }
  }

  return results;
}
