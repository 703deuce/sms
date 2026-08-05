import { DeploymentsView } from "@/components/agents/deployments-view";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { listDeploymentsForWorkspace } from "@/lib/agents/deployments";
import { redirect } from "next/navigation";

export default async function DeploymentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const workspaceId = await getActiveWorkspaceId();
  const deployments = await listDeploymentsForWorkspace(workspaceId);
  return <DeploymentsView deployments={deployments} />;
}
