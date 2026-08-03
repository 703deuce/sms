import { AppShell } from "@/components/layout/app-shell";
import { ServiceWorkerRegister } from "@/components/push/service-worker-register";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { getNavView } from "@/lib/nav-view";
import { loadOutcomeInstances } from "@/lib/outcomes/instances";
import { getMaintenanceState } from "@/lib/platform-flags";
import { loadShellData } from "@/lib/workspace-data";
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
  const [shell, navView, outcomeInstances] = await Promise.all([
    loadShellData(session.userId, workspaceId),
    getNavView(),
    loadOutcomeInstances(workspaceId),
  ]);

  return (
    <>
    <ServiceWorkerRegister />
    <AppShell
      userName={session.name}
      workspaceId={workspaceId}
      workspaces={shell.workspaces}
      phoneNumbers={shell.phoneNumbers}
      metrics={shell.metrics}
      activeFromNumberId={shell.activeFromNumberId}
      unreadNotifications={shell.unreadNotifications}
      navView={navView}
      outcomeInstances={outcomeInstances}
    >
      {children}
    </AppShell>
    </>
  );
}
