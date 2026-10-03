import "server-only";

import { getPrisma } from "@/lib/db";
import { grantWorkspaceProductFeature } from "@/lib/products/feature-entitlements";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** True when this workspace is in the MCTB product (onboarding or live), not Mass Texting-only. */
export async function workspaceHasMctbProductContext(workspaceId: string): Promise<boolean> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { billingPlan: true, customFieldsConfig: true },
  });
  if (!ws) return false;
  const plan = String(ws.billingPlan || "").toLowerCase();
  if (plan === "onboarding" || plan === "free") {
    const cfg = asRecord(ws.customFieldsConfig);
    if (cfg.mctbOnboarding || cfg.mctb) return true;
  }
  const [eventCount, config] = await Promise.all([
    prisma.missedCallEvent.count({ where: { workspaceId } }),
    prisma.missedCallTextConfig.findUnique({
      where: { workspaceId },
      select: { enabled: true },
    }),
  ]);
  return eventCount > 0 || Boolean(config?.enabled);
}

/** Idempotent — free/paid MCTB recovery limits require an active MCTB product feature row. */
export async function grantMctbProductFeatureActive(workspaceId: string): Promise<void> {
  await grantWorkspaceProductFeature(workspaceId, "mctb", "active");
}
