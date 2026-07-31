import { AppShell } from "@/components/layout/app-shell";
import { ServiceWorkerRegister } from "@/components/push/service-worker-register";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { loadShellData } from "@/lib/workspace-data";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const workspaceId = await getActiveWorkspaceId();
  const shell = await loadShellData(session.userId, workspaceId);

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
    >
      {children}
    </AppShell>
    </>
  );
}
