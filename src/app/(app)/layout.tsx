import "./product-theme.css";
import { AppShell } from "@/components/layout/app-shell";
import { ServiceWorkerRegister } from "@/components/push/service-worker-register";
import { getActiveWorkspaceId, getActiveWorkspaceType, getSession } from "@/lib/auth";
import { getUserProductAccess } from "@/lib/products/entitlements";
import { getWorkspaceProductFeatures } from "@/lib/products/feature-entitlements";
import { isActiveEntitlement } from "@/lib/products/types";
import { shouldShowTryItNav } from "@/lib/mctb/try-it/visibility";
import { loadOutcomeInstances } from "@/lib/outcomes/instances";
import { loadPrimaryVoiceAgentId } from "@/lib/voice/shell-nav";
import { getMaintenanceState } from "@/lib/platform-flags";
import { loadShellData, loadWorkspace } from "@/lib/workspace-data";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
  const showTryIt =
    hasMctb &&
    shouldShowTryItNav(billingPlan, {
      isPlatformAdmin: session.isAdmin,
      adminTestAccount: mctbCfg.adminTestAccount === true || mctbCfg.unlimitedMctbTesting === true,
    });

  return (
    <>
    <ServiceWorkerRegister />
    <AppShell
      userName={session.name}
      isAdmin={session.isAdmin}
      workspaceId={workspaceId}
      workspaceName={workspaceName}
      workspaceType={workspaceType}
      workspaces={shell.workspaces}
      phoneNumbers={shell.phoneNumbers}
      metrics={shell.metrics}
      activeFromNumberId={shell.activeFromNumberId}
      unreadNotifications={shell.unreadNotifications}
      outcomeInstances={outcomeInstances}
      primaryVoiceAgentId={primaryVoiceAgentId}
      realtorMode={false}
      hasVoice={productAccess.hasVoice}
      hasSms={
        productAccess.hasSms || isActiveEntitlement(productFeatures.mass_texting)
      }
      hasNumbers={productAccess.hasNumbers}
      hasMctb={hasMctb}
      showTryIt={showTryIt}
      productFeatures={productFeatures}
      hasMctb={hasMctb}
    >
      {children}
    </AppShell>
    </>
  );
}
