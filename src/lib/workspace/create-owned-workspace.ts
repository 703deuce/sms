import { getPrisma } from "@/lib/db";
import type { WorkspaceType } from "@/lib/workspace/types";
import { createWorkspaceForUser } from "@/lib/workspace/create-workspace";

export type CreateOwnedWorkspaceInput = {
  userId: string;
  name: string;
  type: WorkspaceType;
  billingPlan?: string;
  creditBalanceCents?: number;
  customFieldsConfig?: Record<string, unknown>;
};

/**
 * Create workspace + OWNER membership atomically for an existing User.
 * If membership insert fails, the workspace row is removed and the error propagates.
 */
export async function createOwnedWorkspaceWithOwnerMembership(
  input: CreateOwnedWorkspaceInput,
) {
  const prisma = getPrisma();
  const slugBase =
    input.type === "PERSONAL"
      ? `personal-${input.userId.slice(-8)}`
      : input.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .slice(0, 40) || "workspace";
  let slug = slugBase;
  const taken = await prisma.workspace.findUnique({ where: { slug } });
  if (taken) slug = `${slug}-${Date.now().toString(36)}`;

  const workspace = await prisma.workspace.create({
    data: {
      name: input.name.trim(),
      slug,
      type: input.type,
      ownerUserId: input.userId,
      billingPlan: input.billingPlan,
      creditBalanceCents: input.creditBalanceCents ?? 0,
      customFieldsConfig: input.customFieldsConfig,
    },
  });

  try {
    await prisma.membership.create({
      data: { userId: input.userId, workspaceId: workspace.id, role: "OWNER" },
    });
  } catch (err) {
    await prisma.workspace.delete({ where: { id: workspace.id } }).catch(() => undefined);
    throw err;
  }

  if (input.type === "BUSINESS") {
    await prisma.messagingRegistration.create({ data: { workspaceId: workspace.id } }).catch(
      () => undefined,
    );
    await prisma.workspaceLimits
      .create({
        data: {
          workspaceId: workspace.id,
          limits: { dailyCap: 500, maxNumbers: 1, trialDays: 14 },
        },
      })
      .catch(() => undefined);
  }

  return workspace;
}

/** First-time user with no owned workspaces — delegates to canonical helper. */
export async function createFirstWorkspaceForNewUser(
  userId: string,
  name: string,
  type: WorkspaceType,
) {
  return createWorkspaceForUser(userId, name, type);
}
