import { SolutionsDashboardView } from "@/components/outcomes/solutions-dashboard";
import { loadSolutionsDashboardData } from "@/lib/outcomes/dashboard-data";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function SolutionsDashboardPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const data = await loadSolutionsDashboardData(workspaceId);
  return <SolutionsDashboardView data={data} />;
}
