"use client";

import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { RealtorHeader } from "@/components/realtor/realtor-header";
import { Sidebar } from "@/components/layout/sidebar";
import { ProductActivityTracker } from "@/components/products/product-activity-tracker";
import { getPageTitle } from "@/lib/nav";
import { getRealtorPageTitle } from "@/lib/realtor/nav";
import { getCurrentProduct } from "@/lib/products/context";
import { isVoiceShellRoute } from "@/lib/products/voice-routes";
import { getNumbersPageTitle } from "@/lib/products/numbers-nav";
import { getAiAfterHoursPageTitle } from "@/lib/products/ai-after-hours-nav";
import { getVoicePageTitle } from "@/lib/products/voice-nav";
import { getSmsPlatformPageTitle } from "@/lib/products/sms-platform-nav";
import { getMctbPageTitle } from "@/lib/products/mctb-nav";
import { getAppointmentsPageTitle } from "@/lib/products/appointments-nav";
import { isAppointmentsProductPath } from "@/lib/products/appointments-routes";
import { isAppointmentsV1Primary } from "@/lib/workspace/platform-launch";
import { isSmsShellRoute } from "@/lib/products/sms-routes";
import { useProductShell } from "@/components/products/product-shell-tabs";
import { shouldShowProductSwitcher } from "@/lib/products/product-shell";
import type { SolutionNavInstance } from "@/lib/solutions-nav";
import type { CurrentProduct } from "@/lib/products/types";
import type { WorkspaceFeatureSnapshot } from "@/lib/products/feature-entitlements";
import type { DashboardMetrics, PhoneNumber, Workspace } from "@/lib/types";
import type { WorkspaceTypeCookie } from "@/lib/auth";
import { isKimiIntegratedRoute } from "@/lib/products/kimi-ui-routes";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type CSSProperties } from "react";

const SIDEBAR_COLLAPSED_KEY = "transovo.sidebarCollapsed";
const APP_HEADER_HEIGHT = "4rem";

/** Inbox + automation builder: fixed viewport, scroll inside panels only. */
function isFixedViewportSmsRoute(pathname: string): boolean {
  return (
    pathname === "/conversations" ||
    pathname.startsWith("/conversations/") ||
    /^\/automations\/[^/]+\/edit/.test(pathname)
  );
}

/** Automation builder/list — unchanged legacy chrome (excludes drip campaigns). */
function isLegacyAutomationRoute(pathname: string): boolean {
  if (pathname.startsWith("/automations/drip-campaigns") || pathname.startsWith("/drip-campaigns")) {
    return false;
  }
  return pathname.startsWith("/automations");
}

function shouldAutoCollapseSidebar(path: string) {
  return path.startsWith("/conversations") || /^\/automations\/[^/]+\/edit/.test(path);
}

function isAppointmentsKimiFullBleedRoute(pathname: string): boolean {
  if (!isAppointmentsV1Primary()) return false;
  return isKimiIntegratedRoute(pathname) && !pathname.startsWith("/automations");
}

function isSmsFullBleedRoute(pathname: string): boolean {
  if (isLegacyAutomationRoute(pathname)) return false;
  return (
    (isKimiIntegratedRoute(pathname) && !pathname.startsWith("/appointments")) ||
    pathname.startsWith("/automations/drip-campaigns") ||
    pathname.startsWith("/drip-campaigns") ||
    pathname.startsWith("/playbooks") ||
    pathname.startsWith("/ai-replies") ||
    pathname.startsWith("/sms/dashboard") ||
    pathname.startsWith("/sms/analytics")
  );
}

function readSidebarCollapsedPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppShell({
  children,
  userName,
  isAdmin,
  workspaceId,
  workspaceName,
  workspaceType = "BUSINESS",
  workspaces,
  phoneNumbers,
  metrics,
  activeFromNumberId,
  unreadNotifications,
  outcomeInstances = {},
  primaryVoiceAgentId = null,
  realtorMode = false,
  hasVoice = false,
  hasSms = false,
  hasNumbers = false,
  hasMctb = false,
  hasAiAfterHours = false,
  showTryIt = false,
  productFeatures = null,
}: {
  children: React.ReactNode;
  userName: string;
  isAdmin?: boolean;
  workspaceId?: string;
  workspaceName?: string;
  workspaceType?: WorkspaceTypeCookie;
  workspaces?: Workspace[];
  phoneNumbers: PhoneNumber[];
  metrics: DashboardMetrics;
  activeFromNumberId?: string | null;
  unreadNotifications?: number;
  outcomeInstances?: Record<string, SolutionNavInstance[]>;
  primaryVoiceAgentId?: string | null;
  realtorMode?: boolean;
  hasVoice?: boolean;
  hasSms?: boolean;
  hasNumbers?: boolean;
  hasMctb?: boolean;
  hasAiAfterHours?: boolean;
  showTryIt?: boolean;
  productFeatures?: WorkspaceFeatureSnapshot | null;
}) {
  const pathname = usePathname();

  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    if (shouldAutoCollapseSidebar(window.location.pathname)) return true;
    return readSidebarCollapsedPreference();
  });

  useEffect(() => {
    if (shouldAutoCollapseSidebar(pathname)) {
      setSidebarCollapsed(true);
      return;
    }
    setSidebarCollapsed(readSidebarCollapsedPreference());
  }, [pathname]);

  useEffect(() => {
    if (shouldAutoCollapseSidebar(pathname)) {
      return;
    }
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [sidebarCollapsed, pathname]);

  const resolvedProduct = getCurrentProduct(pathname);
  const currentProduct: CurrentProduct =
    resolvedProduct ?? (isVoiceShellRoute(pathname) ? "voice" : null);
  const isLauncher = pathname === "/app" || pathname.startsWith("/app/");
  const legacyAutomation = isLegacyAutomationRoute(pathname);
  const fixedViewport = isFixedViewportSmsRoute(pathname);
  const isFullBleed = isSmsFullBleedRoute(pathname) || isAppointmentsKimiFullBleedRoute(pathname);
  const isKimiFullBleed =
    isFullBleed &&
    isKimiIntegratedRoute(pathname) &&
    !pathname.startsWith("/automations");
  const hideChromeTitle =
    realtorMode &&
    (pathname.startsWith("/realtor/setup") ||
      pathname.startsWith("/realtor/dashboard") ||
      pathname.startsWith("/realtor/leads"));
  const multiProduct = shouldShowProductSwitcher({
    hasMctb,
    hasMassSms: hasSms,
    hasAiAfterHours,
  });
  const { shell: productShell } = useProductShell(hasMctb, hasSms, hasAiAfterHours);
  const appointmentsContextActive =
    multiProduct ? productShell === "appointments" : isAppointmentsV1Primary();
  const mctbContextActive = multiProduct && productShell === "mctb";
  const smsPlatformTitle = isSmsShellRoute(pathname) ? getSmsPlatformPageTitle(pathname) : "";
  const appointmentsTitle =
    appointmentsContextActive && isAppointmentsProductPath(pathname)
      ? getAppointmentsPageTitle(pathname)
      : "";
  const mctbTitle = mctbContextActive ? getMctbPageTitle(pathname) || getVoicePageTitle(pathname) : "";
  const title = hideChromeTitle
    ? ""
    : isLauncher
      ? "Your Transovo Products"
      : appointmentsTitle
        ? appointmentsTitle
        : mctbTitle
          ? mctbTitle
        : smsPlatformTitle
          ? smsPlatformTitle
          : currentProduct === "numbers"
            ? getNumbersPageTitle(pathname)
            : multiProduct && productShell === "ai_after_hours"
              ? getAiAfterHoursPageTitle(pathname) ||
                getVoicePageTitle(pathname) ||
                getSmsPlatformPageTitle(pathname)
              : currentProduct === "voice" || currentProduct === "sms"
                ? getVoicePageTitle(pathname) || getSmsPlatformPageTitle(pathname)
                : getPageTitle(pathname);

  const autoCollapseSidebar = shouldAutoCollapseSidebar(pathname);
  const sidebarCollapsedEffective = autoCollapseSidebar || sidebarCollapsed;
  const sidebarOffset = sidebarCollapsedEffective ? "56px" : "224px";

  return (
    <div
      className="product-theme flex h-dvh overflow-hidden bg-background"
      style={
        {
          "--sidebar-offset": sidebarOffset,
          "--app-header-height": APP_HEADER_HEIGHT,
        } as CSSProperties
      }
    >
      <ProductActivityTracker />
      <Suspense fallback={null}>
        <Sidebar
          userName={userName}
          workspaceName={workspaceName}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          outcomeInstances={outcomeInstances}
          primaryVoiceAgentId={primaryVoiceAgentId}
          realtorMode={realtorMode}
          currentProduct={currentProduct}
          isLauncher={isLauncher}
          inboxBadge={unreadNotifications}
          collapsed={sidebarCollapsedEffective}
          onToggleCollapse={() => {
            if (autoCollapseSidebar) return;
            setSidebarCollapsed((v) => !v);
          }}
          creditsRemaining={metrics.creditsRemaining}
          hasVoice={hasVoice}
          hasSms={hasSms}
          hasNumbers={hasNumbers}
          hasMctb={hasMctb}
          hasAiAfterHours={hasAiAfterHours}
          showTryIt={showTryIt}
          productFeatures={productFeatures}
        />
      </Suspense>
      <div
        className={`flex h-full min-w-0 flex-1 flex-col overflow-hidden ${sidebarCollapsedEffective ? "lg:pl-[56px]" : "lg:pl-[224px]"}`}
      >
        {realtorMode ? (
          <RealtorHeader
            userName={userName}
            isAdmin={isAdmin}
            workspaceId={workspaceId}
            workspaceName={workspaceName || "Workspace"}
            workspaces={workspaces}
            phoneNumbers={phoneNumbers}
            activeFromNumberId={activeFromNumberId}
            unreadNotifications={unreadNotifications}
            onMenuClick={() => setMenuOpen(true)}
          />
        ) : legacyAutomation ? null : (
          <Header
            title={title}
            userName={userName}
            workspaceId={workspaceId}
            workspaceName={workspaceName || "Workspace"}
            workspaceType={workspaceType}
            workspaces={workspaces}
            currentProduct={currentProduct}
            isLauncher={isLauncher}
            phoneNumbers={phoneNumbers}
            metrics={metrics}
            activeFromNumberId={activeFromNumberId}
            unreadNotifications={unreadNotifications}
            onMenuClick={() => setMenuOpen(true)}
            hasVoice={hasVoice}
            hasSms={hasSms}
            hasNumbers={hasNumbers}
            hasMctb={hasMctb}
          />
        )}
        <main
          className={
            legacyAutomation
              ? "h-dvh overflow-hidden px-0 pb-0 pt-0 lg:px-0"
              : fixedViewport
                ? "flex min-h-0 flex-1 flex-col overflow-hidden"
                : isFullBleed
                  ? isKimiFullBleed
                    ? "flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto"
                    : "flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 pb-28 pt-5 lg:px-6 lg:pb-8"
                  : "flex min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-28 pt-5 lg:px-6 lg:pb-8"
          }
        >
          {children}
        </main>
      </div>
      <MobileNav
        realtorMode={realtorMode}
        currentProduct={currentProduct}
        showTryIt={showTryIt}
        productFeatures={productFeatures}
        hasMctb={hasMctb}
        hasMassSms={hasSms}
        hasAiAfterHours={hasAiAfterHours}
        primaryVoiceAgentId={primaryVoiceAgentId}
        onMore={() => setMenuOpen(true)}
      />
    </div>
  );
}
