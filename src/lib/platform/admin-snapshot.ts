import "server-only";

import { getPrisma } from "@/lib/db";
import { getWorkspaceProductFeatures } from "@/lib/products/feature-entitlements";
import { loadMctbSupportSnapshot } from "@/lib/mctb/admin/support-snapshot";
import { isCustomerSmartRoutingFlow } from "@/lib/smart-routing/flow-kind";

export type PlatformAdminSnapshot = {
  workspace: {
    id: string;
    name: string;
    type: string;
    billingPlan: string | null;
    stripeSubscriptionId: string | null;
    createdAt: string;
  };
  productFeatures: Awaited<ReturnType<typeof getWorkspaceProductFeatures>>;
  mctb: Awaited<ReturnType<typeof loadMctbSupportSnapshot>>;
  smartRouting: {
    activeFlows: number;
    totalFlows: number;
    routingNumberE164: string | null;
    callbackNumberE164: string | null;
    callsLast7Days: number;
  };
  counts: {
    missedCalls30d: number;
    linkClicks30d: number;
    formSubmissions30d: number;
    voicemails30d: number;
    callbacksOpen: number;
  };
};

export async function loadPlatformAdminSnapshot(
  workspaceId: string,
): Promise<PlatformAdminSnapshot | null> {
  const prisma = getPrisma();
  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);
  const since7 = new Date();
  since7.setDate(since7.getDate() - 7);

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      type: true,
      billingPlan: true,
      stripeSubscriptionId: true,
      createdAt: true,
    },
  });
  if (!ws) return null;

  const [
    productFeatures,
    mctb,
    flows,
    srSettings,
    missedCalls30d,
    linkClicks30d,
    formSubmissions30d,
    voicemails30d,
    callbacksOpen,
    callsLast7Days,
  ] = await Promise.all([
    getWorkspaceProductFeatures(workspaceId),
    loadMctbSupportSnapshot(workspaceId),
    prisma.smartRoutingFlow.findMany({
      where: { workspaceId },
      select: { status: true, type: true, name: true },
    }),
    prisma.smartRoutingWorkspaceSettings.findUnique({
      where: { workspaceId },
      select: { routingNumberE164: true, callbackNumberE164: true },
    }),
    prisma.missedCallEvent.count({
      where: { workspaceId, detectedAt: { gte: since30 } },
    }),
    prisma.linkClickEvent.count({
      where: { workspaceId, createdAt: { gte: since30 } },
    }),
    prisma.mctbRequestFormSubmission.count({
      where: { workspaceId, submittedAt: { gte: since30 } },
    }).catch(() => 0),
    prisma.voicemailMessage.count({
      where: { workspaceId, createdAt: { gte: since30 } },
    }),
    prisma.callbackRequest.count({
      where: { workspaceId, status: { in: ["new", "contacted"] } },
    }).catch(() => 0),
    prisma.smartRoutingCallSession.count({
      where: { workspaceId, startedAt: { gte: since7 } },
    }),
  ]);

  return {
    workspace: {
      id: ws.id,
      name: ws.name,
      type: ws.type,
      billingPlan: ws.billingPlan,
      stripeSubscriptionId: ws.stripeSubscriptionId,
      createdAt: ws.createdAt.toISOString(),
    },
    productFeatures,
    mctb,
    smartRouting: {
      activeFlows: flows.filter(
        (f: { status: string; type?: string; name?: string }) =>
          f.status === "active" && isCustomerSmartRoutingFlow(f),
      ).length,
      totalFlows: flows.filter(isCustomerSmartRoutingFlow).length,
      routingNumberE164: srSettings?.routingNumberE164 ?? null,
      callbackNumberE164: srSettings?.callbackNumberE164 ?? null,
      callsLast7Days,
    },
    counts: {
      missedCalls30d,
      linkClicks30d,
      formSubmissions30d,
      voicemails30d,
      callbacksOpen,
    },
  };
}
