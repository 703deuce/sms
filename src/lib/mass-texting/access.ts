import "server-only";

import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";

export async function isMassTextingWorkspace(workspaceId: string): Promise<boolean> {
  return hasWorkspaceProductFeature(workspaceId, "mass_texting");
}

export async function requireMassTextingWorkspace(workspaceId: string): Promise<void> {
  const entitled = await isMassTextingWorkspace(workspaceId);
  if (!entitled) {
    throw new Error("Mass Texting is not enabled for this workspace");
  }
}
