import { CrossProductBanner } from "@/components/products/cross-product-banner";
import { MassTextingDashboardView } from "@/components/mass-texting/dashboard-view";
import { getPrisma } from "@/lib/db";
import { loadMassTextOverviewMetrics } from "@/lib/mass-texting/overview-metrics";
import { isOnboardingComplete, loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { getWorkspaceProductFeatures } from "@/lib/products/feature-entitlements";
import { isActiveEntitlement } from "@/lib/products/types";
import { getSession } from "@/lib/auth";
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
  const session = await getSession();
  const productFeatures = await getWorkspaceProductFeatures(workspaceId, {
    isPlatformAdmin: session?.isAdmin,
  });
  const showMctbBanner = isActiveEntitlement(productFeatures.mctb);

  return (
    <div className="space-y-4">
      {showMctbBanner ? <CrossProductBanner variant="mctb_on_mass_sms" /> : null}
      <MassTextingDashboardView metrics={metrics} />
    </div>
  );
}
