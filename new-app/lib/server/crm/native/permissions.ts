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

export async function assertCrmWrite(workspaceId: string) {
  const ctx = await assertCrmRead(workspaceId);
  if (!ctx.isAdmin && ctx.role === "READ_ONLY") {
    const { getOrCreateWorkspaceCrmSettings } = await import("./crm-settings");
    const settings = await getOrCreateWorkspaceCrmSettings(workspaceId);
    if (settings.teamScopes.contactsWrite === "owned") {
      return { ...ctx, writeScope: "owned" as const };
    }
  }
  return { ...ctx, writeScope: "all" as const };
}

export function assertCanWriteContact(
  contact: { ownerUserId?: string | null; assignedUser?: string | null },
  userId: string,
  isAdmin: boolean,
  writeScope: "all" | "owned",
) {
  if (isAdmin || writeScope === "all") return;
  const owner = contact.ownerUserId || contact.assignedUser;
  if (owner && owner !== userId) throw new Error("Not allowed to edit this contact");
}
