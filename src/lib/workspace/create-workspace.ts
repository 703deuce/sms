import { getPrisma } from "@/lib/db";
import type { WorkspaceType } from "@/lib/workspace/types";

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "workspace"
  );
}

/** Ensure owner membership exists (prisma-compat does not support nested membership create). */
export async function ensureWorkspaceOwnerMembership(workspaceId: string, userId: string) {
  const prisma = getPrisma();
  const existing = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (existing) return existing;
  return prisma.membership.create({
    data: { userId, workspaceId, role: "OWNER" },
  });
}

/** Ensure business workspace onboarding rows exist. */
export async function ensureBusinessWorkspaceOnboarding(workspaceId: string) {
  const prisma = getPrisma();
  await prisma.messagingRegistration.upsert({
    where: { workspaceId },
    create: { workspaceId },
    update: {},
  });
  const limits = await prisma.workspaceLimits.findUnique({ where: { workspaceId } });
  if (!limits) {
    await prisma.workspaceLimits.create({
      data: {
        workspaceId,
        limits: { dailyCap: 500, maxNumbers: 1, trialDays: 14, requireCard: false },
      },
    });
  }
}

export async function createWorkspaceForUser(
  userId: string,
  name: string,
  type: WorkspaceType,
) {
  const prisma = getPrisma();
  const slugBase =
    type === "PERSONAL" ? `personal-${userId.slice(-8)}` : slugify(name);
  let slug = slugBase;
  const taken = await prisma.workspace.findUnique({ where: { slug } });
  if (taken) slug = `${slug}-${Date.now().toString(36)}`;

  const workspace = await prisma.workspace.create({
    data: {
      name: name.trim(),
      slug,
      type,
      ownerUserId: userId,
    },
  });

  await ensureWorkspaceOwnerMembership(workspace.id, userId);
  if (type === "BUSINESS") {
    await ensureBusinessWorkspaceOnboarding(workspace.id);
  }

  return workspace;
}
