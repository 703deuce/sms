import { requireWorkspaceContext } from "@/lib/workspace-data";
import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import { redirect } from "next/navigation";

export default async function CallbackRequestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspaceId } = await requireWorkspaceContext();
  const entitled = await hasWorkspaceProductFeature(workspaceId, "callback_requests");
  if (!entitled) {
    redirect("/settings/billing?upgrade=callback_requests");
  }
  return children;
}
