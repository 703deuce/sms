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

export async function createWorkspaceForUser(
  userId: string,
  name: string,
  type: WorkspaceType,
) {
  const slugBase =
    type === "PERSONAL" ? `personal-${userId.slice(-8)}` : slugify(name);
  let slug = slugBase;
  const taken = await getPrisma().workspace.findUnique({ where: { slug } });
  if (taken) slug = `${slug}-${Date.now().toString(36)}`;

  const prisma = getPrisma();
  const workspace = await prisma.workspace.create({
    data: {
      name: name.trim(),
      slug,
      type,
      ownerUserId: userId,
    },
  });

  try {
    await prisma.membership.create({
      data: { userId, workspaceId: workspace.id, role: "OWNER" },
    });
  } catch (err) {
    await prisma.workspace.delete({ where: { id: workspace.id } }).catch(() => undefined);
    throw err;
  }

  if (type === "BUSINESS") {
    await prisma.messagingRegistration.create({ data: { workspaceId: workspace.id } }).catch(
      () => undefined,
    );
    await prisma.workspaceLimits
      .create({
        data: {
          workspaceId: workspace.id,
          limits: {
            dailyCap: 500,
            maxNumbers: 1,
            trialDays: 14,
          },
        },
      })
      .catch(() => undefined);
  }

  return workspace;
}
