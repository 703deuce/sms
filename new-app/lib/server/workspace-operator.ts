import { getPrisma } from "@/lib/server/db";
import { resolveInternalUserId } from "@/lib/server/internal-user";

/**
 * Greenfield Phone / Power Dialer runs without customer login. The internal operator
 * must have workspace membership so CRM and dialer permission checks match /api/contacts.
 */
export async function ensureInternalOperatorMembership(workspaceId: string): Promise<void> {
  const userId = await resolveInternalUserId();
  const prisma = getPrisma();
  const existing = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { id: true },
  });
  if (existing) return;

  await prisma.membership.create({
    data: {
      userId,
      workspaceId,
      role: "OWNER",
    },
  });
}
