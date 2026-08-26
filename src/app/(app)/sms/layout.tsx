import { redirect } from "next/navigation";
import { requireMassTextingWorkspace } from "@/lib/mass-texting/access";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function MassTextingShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspaceId } = await requireWorkspaceContext();
  try {
    await requireMassTextingWorkspace(workspaceId);
  } catch {
    redirect("/mass-texting");
  }
  return children;
}
