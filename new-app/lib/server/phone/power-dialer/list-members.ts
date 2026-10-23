import { getPrisma } from "@/lib/server/db";

export async function addContactsToList(
  workspaceId: string,
  listId: string,
  contactIds: string[],
) {
  const prisma = getPrisma();
  const list = await prisma.contactList.findFirst({ where: { id: listId, workspaceId } });
  if (!list) throw new Error("List not found");
  let added = 0;
  for (const contactId of contactIds) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, workspaceId } });
    if (!contact) continue;
    await prisma.contactListMember.upsert({
      where: { listId_contactId: { listId, contactId } },
      create: { listId, contactId },
      update: {},
    });
    added += 1;
  }
  await prisma.contactList.update({ where: { id: listId }, data: { updatedAt: new Date() } });
  return { added };
}

export async function removeContactsFromList(
  workspaceId: string,
  listId: string,
  contactIds: string[],
) {
  const prisma = getPrisma();
  const list = await prisma.contactList.findFirst({ where: { id: listId, workspaceId } });
  if (!list) throw new Error("List not found");
  const result = await prisma.contactListMember.deleteMany({
    where: { listId, contactId: { in: contactIds } },
  });
  await prisma.contactList.update({ where: { id: listId }, data: { updatedAt: new Date() } });
  return { removed: result.count };
}

export async function exportListContactsCsv(workspaceId: string, listId: string) {
  const prisma = getPrisma();
  const list = await prisma.contactList.findFirst({ where: { id: listId, workspaceId } });
  if (!list) throw new Error("List not found");
  const members = await prisma.contactListMember.findMany({
    where: { listId },
    include: { contact: true },
    orderBy: { contact: { lastName: "asc" } },
  });
  const header = "first_name,last_name,phone,company,status,timezone\n";
  const lines = members.map((m) => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return [
      esc(m.contact.firstName || ""),
      esc(m.contact.lastName || ""),
      esc(m.contact.phone),
      esc(m.contact.company || ""),
      esc(m.contact.status),
      esc(m.contact.timezone || ""),
    ].join(",");
  });
  return header + lines.join("\n");
}
