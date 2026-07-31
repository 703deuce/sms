import { getPrisma } from "@/lib/db";

export type WorkspaceLimitsJson = {
  maxAudience?: number;
  approvalThreshold?: number;
  dailyCap?: number;
  inboxRate?: number;
  apiRate?: number;
  importBatch?: number;
};

export async function getWorkspaceLimits(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.workspaceLimits.findUnique({ where: { workspaceId } });
}

export async function upsertWorkspaceLimits(workspaceId: string, limits: WorkspaceLimitsJson) {
  const prisma = getPrisma();
  return prisma.workspaceLimits.upsert({
    where: { workspaceId },
    create: { workspaceId, limits },
    update: { limits },
  });
}
