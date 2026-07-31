import { LimitsSettingsForm } from "@/components/settings/limits-settings-form";
import {
  loadDashboardMetrics,
  loadRegistration,
  requireWorkspaceContext,
} from "@/lib/workspace-data";

export default async function SettingsLimitsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [metrics, registration] = await Promise.all([
    loadDashboardMetrics(workspaceId),
    loadRegistration(workspaceId),
  ]);

  const a2pApproved = metrics.a2pStatus === "Approved";
  const dailyCap = a2pApproved ? 10000 : 200;

  return (
    <LimitsSettingsForm
      a2pStatus={metrics.a2pStatus}
      a2pApproved={a2pApproved}
      dailyCapDefault={dailyCap}
      useCase={registration?.useCase}
    />
  );
}
