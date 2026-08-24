import "server-only";

import { getPrisma } from "@/lib/db";

export async function findUserRoutingDestination(workspaceId: string, userId: string) {
  const prisma = getPrisma();
  const authorized = await prisma.smartRoutingAuthorizedCaller.findFirst({
    where: { workspaceId, userId, active: true },
  });

  let destination = await prisma.smartRoutingDestination.findFirst({
    where: { workspaceId, assignedUserId: userId, active: true },
  });

  if (!destination && authorized?.phoneE164) {
    destination = await prisma.smartRoutingDestination.findFirst({
      where: { workspaceId, phoneNumber: authorized.phoneE164, active: true },
    });
  }

  return destination;
}
