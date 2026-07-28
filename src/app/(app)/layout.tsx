import { AppShell } from "@/components/layout/app-shell";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const workspaceId = await getActiveWorkspaceId();

  return (
    <AppShell userName={session.name} workspaceId={workspaceId}>
      {children}
    </AppShell>
  );
}
