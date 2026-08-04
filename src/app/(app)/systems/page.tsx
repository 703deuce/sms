import { MySystemsView } from "@/components/systems/my-systems-view";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { loadMySystems } from "@/lib/systems/load-systems";
import { redirect } from "next/navigation";

export default async function MySystemsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const workspaceId = await getActiveWorkspaceId();
  const systems = await loadMySystems(workspaceId);
  return <MySystemsView systems={systems} />;
}
