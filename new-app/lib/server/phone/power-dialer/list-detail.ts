import { getPrisma } from "@/lib/server/db";

export async function getContactListDetail(
  workspaceId: string,
  listId: string,
  opts?: { page?: number; pageSize?: number; search?: string },
) {
  const prisma = getPrisma();
  const list = await prisma.contactList.findFirst({
    where: { id: listId, workspaceId },
    include: {
      powerDialerCampaigns: {
        where: { status: { not: "archived" } },
        select: { id: true, name: true, status: true },
      },
    },
  });
  if (!list) throw new Error("List not found");

  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 50));
  const search = opts?.search?.trim().toLowerCase();

  const memberWhere = {
    listId,
    ...(search
      ? {
          contact: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { company: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search.replace(/\D/g, "") } },
            ],
          },
        }
      : {}),
  };

  const total = await prisma.contactListMember.count({ where: { listId } });
  const filteredTotal = await prisma.contactListMember.count({ where: memberWhere });

  const members = await prisma.contactListMember.findMany({
    where: memberWhere,
    include: {
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          company: true,
          status: true,
          timezone: true,
          customFields: true,
          assignedUser: true,
        },
      },
    },
    orderBy: { contact: { lastName: "asc" } },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    id: list.id,
    name: list.name,
    description: list.description,
    source: list.source,
    filtersJson: list.filtersJson,
    archivedAt: list.archivedAt?.toISOString() ?? null,
    updatedAt: list.updatedAt.toISOString(),
    total,
    filteredTotal,
    page,
    pageSize,
    campaigns: list.powerDialerCampaigns,
    contacts: members.map((m) => m.contact),
    truncated: filteredTotal > members.length,
  };
}

export async function archiveContactList(workspaceId: string, listId: string) {
  const prisma = getPrisma();
  return prisma.contactList.updateMany({
    where: { id: listId, workspaceId },
    data: { archivedAt: new Date() },
  });
}
