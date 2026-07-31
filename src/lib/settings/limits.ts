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

export function parseWorkspaceLimits(row: { limits?: unknown } | null | undefined): WorkspaceLimitsJson {
  const raw = row?.limits;
  if (!raw || typeof raw !== "object") return {};
  return raw as WorkspaceLimitsJson;
}

/**
 * Enforce the workspace-wide daily send cap. Throws when the number of outbound
 * messages already sent today has reached the configured `dailyCap`. No-op when
 * no cap is configured.
 */
export async function assertWithinWorkspaceLimits(workspaceId: string): Promise<void> {
  if (!workspaceId) return;
  const prisma = getPrisma();

  const row = await prisma.workspaceLimits.findUnique({ where: { workspaceId } });
  const limits = parseWorkspaceLimits(row);
  const dailyCap = Number(limits.dailyCap ?? 0);
  if (!Number.isFinite(dailyCap) || dailyCap <= 0) return;

  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const sentStatuses = ["sent", "delivered", "clicked"];
  const [quickSends, campaignSends] = await Promise.all([
    prisma.message.count({
      where: { workspaceId, status: { in: sentStatuses }, createdAt: { gte: dayStart } },
    }),
    prisma.campaignMessage.count({
      where: { workspaceId, status: { in: sentStatuses }, sentAt: { gte: dayStart } },
    }),
  ]);

  if (quickSends + campaignSends >= dailyCap) {
    throw new Error(`Workspace daily send cap reached (${dailyCap})`);
  }
}
