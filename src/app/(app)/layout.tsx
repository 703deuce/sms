import "./product-theme.css";
import "@/styles/newui-shell-tokens.css";
import { AppShell } from "@/components/layout/app-shell";
import { ServiceWorkerRegister } from "@/components/push/service-worker-register";
import { getActiveWorkspaceId, getActiveWorkspaceType, getSession } from "@/lib/auth";
import { getUserProductAccess } from "@/lib/products/entitlements";
import { getWorkspaceProductFeatures } from "@/lib/products/feature-entitlements";
import { isActiveEntitlement } from "@/lib/products/types";
import { isAiAfterHoursEntitled } from "@/lib/products/ai-after-hours";
import { loadOutcomeInstances } from "@/lib/outcomes/instances";
import { shouldShowTryItNav } from "@/lib/mctb/try-it/visibility";
import { getMaintenanceState } from "@/lib/platform-flags";
import { loadShellData } from "@/lib/workspace-data";
import { loadPrimaryVoiceAgentId } from "@/lib/voice/shell-nav";
import { loadCallHandlingOwnershipState } from "@/lib/call-handling/ownership-state";
import { shouldShowCallHandlingSwitcher } from "@/lib/call-handling/show-switcher";
import { logNavTiming, timedNavSection, type NavTimingReport } from "@/lib/observability/nav-timing";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navTiming: NavTimingReport = {};
  const layoutStart = performance.now();

  const session = await timedNavSection("auth", navTiming, async () => await getSession());
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

  const [shell, outcomeInstances, primaryVoiceAgentId, productAccess, productFeatures] =
    await Promise.all([
      timedNavSection("shell", navTiming, () => loadShellData(session.userId, workspaceId)),
      loadOutcomeInstances(workspaceId),
      loadPrimaryVoiceAgentId(workspaceId),
      timedNavSection("entitlements", navTiming, () => getUserProductAccess(session.userId)),
      timedNavSection("entitlements", navTiming, () =>
        getWorkspaceProductFeatures(workspaceId, { isPlatformAdmin: session.isAdmin }),
      ),
    ]);

  const workspaceRow = shell.workspace;
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

  const showCallHandling = shouldShowCallHandlingSwitcher({
    hasMctb,
    hasVoice: productAccess.hasVoice,
  });
  const callHandlingInitial = showCallHandling
    ? await timedNavSection("call_handling", navTiming, () =>
        loadCallHandlingOwnershipState({ workspaceId }),
      )
    : null;

  navTiming.total = performance.now() - layoutStart;
  logNavTiming(navTiming);

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
        inboxUnreadCount={shell.inboxUnreadCount}
        outcomeInstances={outcomeInstances}
        primaryVoiceAgentId={primaryVoiceAgentId}
        realtorMode={false}
        hasVoice={productAccess.hasVoice}
        hasSms={
          productAccess.hasSms || isActiveEntitlement(productFeatures.mass_texting)
        }
        hasNumbers={productAccess.hasNumbers}
        hasMctb={hasMctb}
        hasAiAfterHours={hasAiAfterHours}
        showTryIt={showTryIt}
        productFeatures={productFeatures}
        callHandlingInitial={callHandlingInitial}
      >
        {children}
      </AppShell>
    </>
  );
}
