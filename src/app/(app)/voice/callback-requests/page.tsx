import { AddOnUpgradeCard } from "@/components/products/add-on-upgrade-card";
import { CallbackRequestsClient } from "@/components/voice/callback-requests-client";
import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function CallbackRequestsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const entitled = await hasWorkspaceProductFeature(workspaceId, "callback_requests");

  if (!entitled) {
    return <AddOnUpgradeCard feature="callback_requests" />;
  }

  return <CallbackRequestsClient />;
}
