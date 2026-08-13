import { AppShell } from "@/components/layout/app-shell";
import { ServiceWorkerRegister } from "@/components/push/service-worker-register";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
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
  const [shell, outcomeInstances, primaryVoiceAgentId, workspaceRow] = await Promise.all([
    loadShellData(session.userId, workspaceId),
    loadOutcomeInstances(workspaceId),
    loadPrimaryVoiceAgentId(workspaceId),
    loadWorkspace(workspaceId),
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
      workspaces={shell.workspaces}
      phoneNumbers={shell.phoneNumbers}
      metrics={shell.metrics}
      activeFromNumberId={shell.activeFromNumberId}
      unreadNotifications={shell.unreadNotifications}
      outcomeInstances={outcomeInstances}
      primaryVoiceAgentId={primaryVoiceAgentId}
      realtorMode={false}
    >
      {children}
    </AppShell>
    </>
  );
}
