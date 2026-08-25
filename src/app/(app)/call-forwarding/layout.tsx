import { requireWorkspaceContext } from "@/lib/workspace-data";
import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import { redirect } from "next/navigation";

export default async function CallForwardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspaceId } = await requireWorkspaceContext();
  const entitled = await hasWorkspaceProductFeature(workspaceId, "call_forwarding");
  if (!entitled) {
    redirect("/settings/billing?upgrade=call_forwarding");
  }
  return children;
}
