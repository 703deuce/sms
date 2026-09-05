import "server-only";

import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";

export async function assertTransovoVideoEntitlement(workspaceId: string): Promise<void> {
  const entitled = await hasWorkspaceProductFeature(workspaceId, "transovo_video");
  if (!entitled) {
    throw new Error("TRANSOVO_VIDEO_NOT_ENTITLED");
  }
}

export async function hasTransovoVideoEntitlement(workspaceId: string): Promise<boolean> {
  return hasWorkspaceProductFeature(workspaceId, "transovo_video");
}
