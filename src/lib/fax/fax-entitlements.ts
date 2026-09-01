import "server-only";

import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";

export async function assertFaxEntitlement(workspaceId: string): Promise<void> {
  const entitled = await hasWorkspaceProductFeature(workspaceId, "fax");
  if (!entitled) {
    throw new Error("FAX_NOT_ENTITLED");
  }
}

export async function hasFaxEntitlement(workspaceId: string): Promise<boolean> {
  return hasWorkspaceProductFeature(workspaceId, "fax");
}
