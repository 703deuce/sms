import "server-only";

import { getActiveWorkspaceId, getActiveWorkspaceType, getSession } from "@/lib/auth";
import { getUserProductAccess } from "@/lib/products/entitlements";
import { getWorkspaceProductFeatures } from "@/lib/products/feature-entitlements";
import { isActiveEntitlement } from "@/lib/products/types";
import { isAiAfterHoursEntitled } from "@/lib/products/ai-after-hours";
import { loadOutcomeInstances } from "@/lib/outcomes/instances";
import { shouldShowTryItNav } from "@/lib/mctb/try-it/visibility";
import { getMaintenanceState } from "@/lib/platform-flags";
import { loadShellData, loadWorkspace } from "@/lib/workspace-data";
import { loadPrimaryVoiceAgentId } from "@/lib/voice/shell-nav";
import { redirect } from "next/navigation";
import type { WorkspaceFeatureSnapshot } from "@/lib/products/feature-entitlements";
import type { SolutionNavInstance } from "@/lib/solutions-nav";
import type { DashboardMetrics, PhoneNumber, Workspace } from "@/lib/types";
import type { WorkspaceTypeCookie } from "@/lib/auth";

export type AppLayoutShellProps = {
  userName: string;
  isAdmin: boolean;
  workspaceId: string;
  workspaceName: string;
  workspaceType: WorkspaceTypeCookie;
  workspaces: Workspace[];
  phoneNumbers: PhoneNumber[];
  metrics: DashboardMetrics;
  activeFromNumberId: string | null;
  unreadNotifications: number;
  inboxUnreadCount: number;
  outcomeInstances: Record<string, SolutionNavInstance[]>;
  primaryVoiceAgentId: string | null;
  realtorMode: boolean;
  hasVoice: boolean;
  hasSms: boolean;
  hasNumbers: boolean;
  hasMctb: boolean;
  hasAiAfterHours: boolean;
  showTryIt: boolean;
  productFeatures: WorkspaceFeatureSnapshot;
};

/** Full authenticated (app) layout server graph — shared by layout and memory probes. */
export async function runAppLayoutServerPipeline(): Promise<AppLayoutShellProps> {
  const session = await getSession();
  if (!session) redirect("/login");

  try {
    const maintenance = await getMaintenanceState();
    if (maintenance.enabled && !session.isAdmin) {
      redirect("/maintenance");
    }
  } catch {
    // ignore settings load failures
  }

  const workspaceId = await getActiveWorkspaceId();
  const workspaceType = await getActiveWorkspaceType();
  const [shell, outcomeInstances, primaryVoiceAgentId, workspaceRow, productAccess, productFeatures] =
    await Promise.all([
      loadShellData(session.userId, workspaceId),
      loadOutcomeInstances(workspaceId),
      loadPrimaryVoiceAgentId(workspaceId),
      loadWorkspace(workspaceId),
      getUserProductAccess(session.userId),
      getWorkspaceProductFeatures(workspaceId, { isPlatformAdmin: session.isAdmin }),
    ]);
  const workspaceName =
    (workspaceRow as { displayName?: string | null; name?: string } | null)?.displayName ||
    workspaceRow?.name ||
    "Workspace";
  const billingPlan = String(
    (workspaceRow as { billingPlan?: string | null } | null)?.billingPlan || "",
  );
  const customCfg =
    workspaceRow?.customFieldsConfig && typeof workspaceRow.customFieldsConfig === "object"
      ? (workspaceRow.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctbCfg =
    customCfg.mctb && typeof customCfg.mctb === "object"
      ? (customCfg.mctb as Record<string, unknown>)
      : {};
  const hasMctb = isActiveEntitlement(productFeatures.mctb);
  const hasAiAfterHours = isAiAfterHoursEntitled(productAccess.hasVoice);
  const showTryIt =
    hasMctb &&
    shouldShowTryItNav(billingPlan, {
      isPlatformAdmin: session.isAdmin,
      adminTestAccount: mctbCfg.adminTestAccount === true || mctbCfg.unlimitedMctbTesting === true,
    });

  return {
    userName: session.name,
    isAdmin: session.isAdmin,
    workspaceId,
    workspaceName,
    workspaceType,
    workspaces: shell.workspaces,
    phoneNumbers: shell.phoneNumbers,
    metrics: shell.metrics,
    activeFromNumberId: shell.activeFromNumberId,
    unreadNotifications: shell.unreadNotifications,
    inboxUnreadCount: shell.inboxUnreadCount,
    outcomeInstances,
    primaryVoiceAgentId,
    realtorMode: false,
    hasVoice: productAccess.hasVoice,
    hasSms: productAccess.hasSms || isActiveEntitlement(productFeatures.mass_texting),
    hasNumbers: productAccess.hasNumbers,
    hasMctb,
    hasAiAfterHours,
    showTryIt,
    productFeatures,
  };
}
