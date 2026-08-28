import "server-only";

import { getPrisma } from "@/lib/db";
import {
  isAdminMctbTestWorkspace,
  loadAdminMctbTestFlags,
} from "@/lib/mctb/admin-test-workspace";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function envUnlimitedWorkspaceIds(): Set<string> {
  const raw = process.env.ADMIN_UNLIMITED_WORKSPACE_IDS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

/** Platform admin / certification workspaces bypass prepaid credit gates. */
export async function isAdminUnlimitedWorkspace(workspaceId: string): Promise<boolean> {
  if (!workspaceId) return false;
  if (envUnlimitedWorkspaceIds().has(workspaceId)) return true;

  const mctbFlags = await loadAdminMctbTestFlags(workspaceId);
  if (isAdminMctbTestWorkspace(mctbFlags)) return true;

  const prisma = getPrisma();
  const adminMember = await prisma.membership.findFirst({
    where: { workspaceId, user: { isPlatformAdmin: true } },
    select: { id: true },
  });
  if (adminMember) return true;
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const cfg = asRecord(ws?.customFieldsConfig);
  const billing = asRecord(cfg.billing);
  if (billing.adminUnlimited === true || billing.unlimitedCredits === true) {
    return true;
  }

  const limitsRow = await prisma.workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  const limits = asRecord(limitsRow?.limits);
  if (limits.adminUnlimitedCredits === true || limits.adminUnlimitedMctb === true) {
    return true;
  }

  return false;
}
