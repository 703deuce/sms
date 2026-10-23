import { getPrisma } from "@/lib/server/db";

export async function assertDispositionSetInUse(workspaceId: string, setId: string) {
  const prisma = getPrisma();
  const campaigns = await prisma.powerDialerCampaign.findMany({
    where: { workspaceId },
    select: { configJson: true },
  });
  for (const c of campaigns) {
    const o = c.configJson as { dispositionSetId?: string };
    if (o?.dispositionSetId === setId) return true;
  }
  return false;
}

export async function reorderDispositions(
  workspaceId: string,
  setId: string,
  orderedIds: string[],
) {
  const prisma = getPrisma();
  const set = await prisma.powerDialerDispositionSet.findFirst({
    where: { id: setId, workspaceId },
    include: { dispositions: true },
  });
  if (!set) throw new Error("Disposition set not found");
  const valid = new Set(set.dispositions.map((d) => d.id));
  for (const id of orderedIds) {
    if (!valid.has(id)) throw new Error("Invalid disposition id in order list");
  }
  let i = 0;
  for (const id of orderedIds) {
    await prisma.powerDialerDisposition.update({
      where: { id },
      data: { sortOrder: i++ },
    });
  }
  return prisma.powerDialerDispositionSet.findFirst({
    where: { id: setId },
    include: { dispositions: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function setDefaultDispositionSet(workspaceId: string, setId: string) {
  const prisma = getPrisma();
  const set = await prisma.powerDialerDispositionSet.findFirst({
    where: { id: setId, workspaceId },
  });
  if (!set) throw new Error("Disposition set not found");
  await prisma.powerDialerDispositionSet.updateMany({
    where: { workspaceId },
    data: { isDefault: false },
  });
  return prisma.powerDialerDispositionSet.update({
    where: { id: setId },
    data: { isDefault: true },
    include: { dispositions: { orderBy: { sortOrder: "asc" } } },
  });
}
