import "server-only";

import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";

export async function assertAiNotetakerEntitlement(workspaceId: string): Promise<void> {
  const entitled = await hasWorkspaceProductFeature(workspaceId, "ai_notetaker");
  if (!entitled) {
    throw new Error("AI_NOTETAKER_NOT_ENTITLED");
  }
}

export async function hasAiNotetakerEntitlement(workspaceId: string): Promise<boolean> {
  return hasWorkspaceProductFeature(workspaceId, "ai_notetaker");
}
