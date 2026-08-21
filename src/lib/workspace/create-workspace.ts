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

  const data: {
    name: string;
    slug: string;
    type: WorkspaceType;
    ownerUserId: string;
    memberships: { create: { userId: string; role: "OWNER" } };
    messagingRegistration?: { create: Record<string, never> };
    workspaceLimits?: { create: { limits: Record<string, unknown> } };
  } = {
    name: name.trim(),
    slug,
    type,
    ownerUserId: userId,
    memberships: { create: { userId, role: "OWNER" } },
  };

  if (type === "BUSINESS") {
    data.messagingRegistration = { create: {} };
    data.workspaceLimits = {
      create: {
        limits: {
          dailyCap: 500,
          maxNumbers: 1,
          trialDays: 14,
        },
      },
    };
  }

  return getPrisma().workspace.create({ data });
}
