import "server-only";

import { getPrisma } from "@/lib/db";
import type { AdminMctbTestFlags } from "@/lib/mctb/admin-test-workspace-shared";

export type { AdminMctbTestFlags } from "@/lib/mctb/admin-test-workspace-shared";
export { isAdminMctbTestWorkspace } from "@/lib/mctb/admin-test-workspace-shared";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function loadAdminMctbTestFlags(workspaceId: string): Promise<AdminMctbTestFlags> {
  const prisma = getPrisma();
  const [ws, limitsRow] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { customFieldsConfig: true },
    }),
    prisma.workspaceLimits.findUnique({
      where: { workspaceId },
      select: { limits: true },
    }),
  ]);

  const cfg = asRecord(ws?.customFieldsConfig);
  const mctb = asRecord(cfg.mctb);
  const limits = asRecord(limitsRow?.limits);

  return {
    adminTestAccount: mctb.adminTestAccount === true,
    unlimitedMctbTesting: mctb.unlimitedMctbTesting === true,
    adminUnlimitedMctb: limits.adminUnlimitedMctb === true,
  };
}
