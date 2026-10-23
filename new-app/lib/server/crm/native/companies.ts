import { getPrisma } from "@/lib/server/db";
import { assertCrmRead, assertCrmWrite } from "./permissions";

export async function listCompanies(workspaceId: string, q?: string) {
  await assertCrmRead(workspaceId);
  const prisma = getPrisma();
  const term = q?.trim();
  return prisma.crmCompany.findMany({
    where: {
      workspaceId,
      ...(term ? { name: { contains: term, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
    take: 200,
    include: { _count: { select: { contacts: true, deals: true } } },
  });
}

export async function getCompany(workspaceId: string, id: string) {
  await assertCrmRead(workspaceId);
  const prisma = getPrisma();
  const row = await prisma.crmCompany.findFirst({
    where: { id, workspaceId },
    include: {
      contacts: { take: 50, select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      deals: { include: { stage: true }, take: 50 },
    },
  });
  if (!row) throw new Error("Company not found");
  return row;
}

export async function createCompany(
  workspaceId: string,
  input: { name: string; website?: string; phone?: string; ownerUserId?: string; notes?: string },
) {
  await assertCrmWrite(workspaceId);
  const prisma = getPrisma();
  return prisma.crmCompany.create({
    data: {
      workspaceId,
      name: input.name.trim(),
      website: input.website?.trim() || null,
      phone: input.phone?.trim() || null,
      ownerUserId: input.ownerUserId || null,
      notes: input.notes?.trim() || null,
    },
  });
}

export async function patchCompany(
  workspaceId: string,
  id: string,
  input: Partial<{ name: string; website: string; phone: string; ownerUserId: string; notes: string }>,
) {
  await assertCrmWrite(workspaceId);
  const prisma = getPrisma();
  const existing = await prisma.crmCompany.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new Error("Company not found");
  return prisma.crmCompany.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.website !== undefined ? { website: input.website || null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
    },
  });
}
