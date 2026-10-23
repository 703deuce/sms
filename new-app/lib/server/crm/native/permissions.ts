import { getPrisma } from "@/lib/server/db";
import { resolveInternalUserId } from "@/lib/server/internal-user";

const ADMIN = new Set(["OWNER", "ADMINISTRATOR", "MANAGER"]);

export async function assertCrmRead(workspaceId: string) {
  const userId = await resolveInternalUserId();
  const m = await getPrisma().membership.findFirst({
    where: { workspaceId, userId },
    select: { role: true, userId: true },
  });
  if (!m) throw new Error("Not authorized");
  return { userId: m.userId, role: m.role, isAdmin: ADMIN.has(m.role) };
}

export function contactVisibleToUser(
  contact: { ownerUserId?: string | null; assignedUser?: string | null },
  userId: string,
  isAdmin: boolean,
) {
  if (isAdmin) return true;
  const owner = contact.ownerUserId || contact.assignedUser;
  if (!owner) return true;
  return owner === userId;
}
