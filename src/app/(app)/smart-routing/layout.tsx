import { requireWorkspaceContext } from "@/lib/workspace-data";
import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import { redirect } from "next/navigation";

export default async function SmartRoutingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspaceId } = await requireWorkspaceContext();
  const entitled = await hasWorkspaceProductFeature(workspaceId, "smart_routing");
  if (!entitled) {
    redirect("/settings/billing?upgrade=smart_routing");
  }
  return children;
}
