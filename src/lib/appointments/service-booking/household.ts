import "server-only";

import { getPrisma } from "@/lib/db";

export async function listHouseholdAccounts(workspaceId: string, payerContactId?: string) {
  const prisma = getPrisma();
  return prisma.householdAccount.findMany({
    where: { workspaceId, ...(payerContactId ? { payerContactId } : {}) },
    include: { members: true },
  });
}

export async function createHouseholdAccount(
  workspaceId: string,
  payerContactId: string,
  name?: string,
) {
  const prisma = getPrisma();
  return prisma.householdAccount.create({
    data: { workspaceId, payerContactId, name },
  });
}

export async function addHouseholdMember(
  householdId: string,
  contactId: string,
  input?: { role?: string; displayName?: string },
) {
  const prisma = getPrisma();
  return prisma.householdMember.create({
    data: {
      householdId,
      contactId,
      role: input?.role || "dependent",
      displayName: input?.displayName,
    },
  });
}

export async function resolveHouseholdForContact(workspaceId: string, contactId: string) {
  const prisma = getPrisma();
  const member = await prisma.householdMember.findFirst({
    where: { contactId },
    include: { household: { include: { members: true } } },
  });
  if (!member) return null;
  if (member.household.workspaceId !== workspaceId) return null;
  return member.household;
}
