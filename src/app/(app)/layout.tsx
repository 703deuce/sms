import "./product-theme.css";
import { AppShell } from "@/components/layout/app-shell";
import { ServiceWorkerRegister } from "@/components/push/service-worker-register";
import { getActiveWorkspaceId, getActiveWorkspaceType, getSession } from "@/lib/auth";
import { getUserProductAccess } from "@/lib/products/entitlements";
import { loadOutcomeInstances } from "@/lib/outcomes/instances";
import { loadPrimaryVoiceAgentId } from "@/lib/voice/shell-nav";
import { getMaintenanceState } from "@/lib/platform-flags";
import { loadShellData, loadWorkspace } from "@/lib/workspace-data";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  try {
    const maintenance = await getMaintenanceState();
    if (maintenance.enabled && !session.isAdmin) {
      redirect("/maintenance");
    }
  } catch {
    // ignore settings load failures
  }

  const workspaceId = await getActiveWorkspaceId();
  const workspaceType = await getActiveWorkspaceType();
  const [shell, outcomeInstances, primaryVoiceAgentId, workspaceRow, productAccess] =
    await Promise.all([
    loadShellData(session.userId, workspaceId),
    loadOutcomeInstances(workspaceId),
    loadPrimaryVoiceAgentId(workspaceId),
    loadWorkspace(workspaceId),
    getUserProductAccess(session.userId),
  ]);
  const workspaceName =
    (workspaceRow as { displayName?: string | null; name?: string } | null)?.displayName ||
    workspaceRow?.name ||
    "Workspace";

  return (
    <>
    <ServiceWorkerRegister />
    <AppShell
      userName={session.name}
      isAdmin={session.isAdmin}
      workspaceId={workspaceId}
      workspaceName={workspaceName}
      workspaceType={workspaceType}
      workspaces={shell.workspaces}
      phoneNumbers={shell.phoneNumbers}
      metrics={shell.metrics}
      activeFromNumberId={shell.activeFromNumberId}
      unreadNotifications={shell.unreadNotifications}
      outcomeInstances={outcomeInstances}
      primaryVoiceAgentId={primaryVoiceAgentId}
      realtorMode={false}
      hasSms={productAccess.hasSms}
      hasNumbers={productAccess.hasNumbers}
    >
      {children}
    </AppShell>
    </>
  );
}
