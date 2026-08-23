import { MctbDashboardView } from "@/components/mctb/dashboard-view";
import type { DashboardDateRange } from "@/lib/outcomes/operational-dashboard-types";
import { getPrisma } from "@/lib/db";
import { isOnboardingComplete, loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { getWorkspaceProductFeatures } from "@/lib/products/feature-entitlements";
import { redirect } from "next/navigation";

function parseRange(raw: string | undefined): DashboardDateRange {
  if (raw === "today" || raw === "30d" || raw === "7d") return raw;
  return "7d";
}

/** Missed Call Text Back — operational dashboard. */
export default async function MctbDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { session, workspaceId } = await requireWorkspaceContext();
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
  const params = await searchParams;
  const range = parseRange(params.range);
  const productFeatures = await getWorkspaceProductFeatures(workspaceId);
  return (
    <MctbDashboardView
      userName={session.name}
      range={range}
      productFeatures={productFeatures}
    />
  );
}
