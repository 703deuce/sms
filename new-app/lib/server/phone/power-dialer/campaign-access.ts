import { getPrisma } from "@/lib/server/db";
import { parseExtendedConfig } from "./campaign-extended-config";

const ADMIN_ROLES = new Set(["OWNER", "ADMINISTRATOR", "MANAGER"]);

export function isPowerDialerAdminRole(role: string) {
  return ADMIN_ROLES.has(role);
}

export async function getMembershipForUser(workspaceId: string, userId: string) {
  const prisma = getPrisma();
  return prisma.membership.findFirst({
    where: { workspaceId, userId },
    select: { role: true, userId: true },
  });
}

export function userCanAccessCampaign(
  role: string,
  configJson: unknown,
  userId: string,
): boolean {
  if (isPowerDialerAdminRole(role)) return true;
  const ext = parseExtendedConfig(configJson);
  const members = ext.memberUserIds ?? [];
  return ext.ownerUserId === userId || members.includes(userId);
}

export async function listWorkspaceReps(workspaceId: string) {
  const prisma = getPrisma();
  const rows = await prisma.membership.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return rows.map((m) => ({
    userId: m.userId,
    role: m.role,
    name: m.user.name || m.user.email,
    email: m.user.email,
  }));
}

export async function assertCampaignDialAccess(
  workspaceId: string,
  campaignId: string,
  userId: string,
) {
  const prisma = getPrisma();
  const membership = await prisma.membership.findFirst({
    where: { workspaceId, userId },
    select: { role: true },
  });
  if (!membership) throw new Error("Not authorized for this workspace");
  if (ADMIN_ROLES.has(membership.role)) return;

  const campaign = await prisma.powerDialerCampaign.findFirst({
    where: { id: campaignId, workspaceId },
    select: { configJson: true },
  });
  if (!campaign) throw new Error("Campaign not found");
  const ext = parseExtendedConfig(campaign.configJson);
  const members = ext.memberUserIds ?? [];
  if (ext.ownerUserId === userId || members.includes(userId)) return;
  throw new Error("You are not assigned to this campaign");
}
