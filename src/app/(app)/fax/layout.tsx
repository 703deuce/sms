import { requireWorkspaceContext } from "@/lib/workspace-data";
import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import { redirect } from "next/navigation";

export default async function FaxLayout({ children }: { children: React.ReactNode }) {
  const { workspaceId } = await requireWorkspaceContext();
  const entitled = await hasWorkspaceProductFeature(workspaceId, "fax");
  if (!entitled) {
    redirect("/settings/billing?upgrade=fax");
  }
  return children;
}
