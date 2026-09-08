import "server-only";

import { getPrisma } from "@/lib/db";
import { assertResourcesAvailable } from "./resources";

export type ResourcePoolSelection = {
  /** Pick any one resource from this group */
  groupId: string;
  quantity?: number;
};

export async function listResourceGroups(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.schedulingResourceGroup.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
}

export async function upsertResourceGroup(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    resourceIds: string[];
    selectionMode?: "any_one" | "all_required";
    active?: boolean;
  },
) {
  const prisma = getPrisma();
  const data = {
    name: input.name.trim(),
    resourceIds: input.resourceIds,
    selectionMode: input.selectionMode ?? "any_one",
    active: input.active ?? true,
  };
  if (input.id) {
    return prisma.schedulingResourceGroup.update({ where: { id: input.id, workspaceId }, data });
  }
  return prisma.schedulingResourceGroup.create({ data: { workspaceId, ...data } });
}

/** Resolve a pool to concrete resource IDs (first available for any_one mode). */
export async function resolveResourcePool(
  workspaceId: string,
  groupId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<string[]> {
  const prisma = getPrisma();
  const group = await prisma.schedulingResourceGroup.findFirst({
    where: { id: groupId, workspaceId, active: true },
  });
  if (!group) throw new Error("Resource group not found");

  if (group.selectionMode === "all_required") {
    await assertResourcesAvailable(workspaceId, group.resourceIds, startsAt, endsAt);
    return group.resourceIds;
  }

  for (const resourceId of group.resourceIds) {
    try {
      await assertResourcesAvailable(workspaceId, [resourceId], startsAt, endsAt);
      return [resourceId];
    } catch {
      continue;
    }
  }
  throw new Error(`No available resource in group ${group.name}`);
}
