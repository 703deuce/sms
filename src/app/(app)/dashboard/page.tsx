import { MassTextingDashboardView } from "@/components/mass-texting/dashboard-view";
import { getPrisma } from "@/lib/db";
import { loadMassTextOverviewMetrics } from "@/lib/mass-texting/overview-metrics";
import { isOnboardingComplete, loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { redirect } from "next/navigation";

/** Platform dashboard — campaign metrics, scheduling, and recent activity. */
export default async function DashboardPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { billingPlan: true, type: true },
  });
  if (ws?.type === "BUSINESS" && String(ws.billingPlan).toLowerCase() === "onboarding") {
    const state = await loadMctbOnboardingState(workspaceId);
    if (!isOnboardingComplete(state)) {
      redirect("/onboarding/mctb");
    }
  }

  const metrics = await loadMassTextOverviewMetrics(workspaceId);
  return <MassTextingDashboardView metrics={metrics} />;
}
