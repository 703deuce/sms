import { CrossProductBanner } from "@/components/products/cross-product-banner";
import { SmsDashboardView } from "@/components/sms/sms-dashboard-view";
import { getPrisma } from "@/lib/db";
import { isOnboardingComplete, loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { getWorkspaceProductFeatures } from "@/lib/products/feature-entitlements";
import { isActiveEntitlement } from "@/lib/products/types";
import { getSession } from "@/lib/auth";
import { loadSmsDashboardMetrics } from "@/lib/sms/dashboard-metrics";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { mctbOnboardingEntryPath } from "@/lib/mctb/onboarding/entry-path";
import { redirect } from "next/navigation";

/** SMS product dashboard — at-a-glance account health (not deep analytics). */
export default async function SmsDashboardPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { billingPlan: true, type: true },
  });
  if (ws?.type === "BUSINESS" && String(ws.billingPlan).toLowerCase() === "onboarding") {
    const state = await loadMctbOnboardingState(workspaceId);
    if (!isOnboardingComplete(state)) {
      redirect(mctbOnboardingEntryPath());
    }
  }

  const session = await getSession();
  const productFeatures = await getWorkspaceProductFeatures(workspaceId, {
    isPlatformAdmin: session?.isAdmin,
  });
  const showMctbBanner = isActiveEntitlement(productFeatures.mctb);
  const metrics = await loadSmsDashboardMetrics(workspaceId);

  return (
    <div className="space-y-4">
      {showMctbBanner ? <CrossProductBanner variant="mctb_on_mass_sms" /> : null}
      <SmsDashboardView metrics={metrics} />
    </div>
  );
}
