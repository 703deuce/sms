import { OperationalDashboardView } from "@/components/outcomes/operational-dashboard-view";
import {
  loadOperationalDashboardData,
  type DashboardDateRange,
} from "@/lib/outcomes/operational-dashboard";
import { requireWorkspaceContext } from "@/lib/workspace-data";

function parseRange(raw: string | undefined): DashboardDateRange {
  if (raw === "today" || raw === "30d" || raw === "7d") return raw;
  return "7d";
}

export default async function SolutionsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { workspaceId, session } = await requireWorkspaceContext();
  const params = await searchParams;
  const range = parseRange(params.range);
  const data = await loadOperationalDashboardData(
    workspaceId,
    session.name,
    range,
  );
  return <OperationalDashboardView initialData={data} />;
}
