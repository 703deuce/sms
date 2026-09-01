import { SmsDashboardView } from "@/components/sms/sms-dashboard-view";
import { loadSmsDashboardMetrics } from "@/lib/sms/dashboard-metrics";
import { requireWorkspaceContext } from "@/lib/workspace-data";

/** SMS product dashboard — at-a-glance account health (not deep analytics). */
export default async function SmsDashboardPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const metrics = await loadSmsDashboardMetrics(workspaceId);
  return <SmsDashboardView metrics={metrics} />;
}
