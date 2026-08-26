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
import { getVoicePageTitle } from "@/lib/products/voice-nav";
import { getMassTextPageTitle } from "@/lib/products/mass-text-nav";
import { getSmsPageTitle } from "@/lib/products/sms-nav";
import type { SolutionNavInstance } from "@/lib/solutions-nav";
import type { CurrentProduct } from "@/lib/products/types";
import type { WorkspaceFeatureSnapshot } from "@/lib/products/feature-entitlements";
import type { DashboardMetrics, PhoneNumber, Workspace } from "@/lib/types";
import type { WorkspaceTypeCookie } from "@/lib/auth";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";

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
  showTryIt?: boolean;
  productFeatures?: WorkspaceFeatureSnapshot | null;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const resolvedProduct = getCurrentProduct(pathname);
  const currentProduct: CurrentProduct =
    resolvedProduct ?? (isVoiceShellRoute(pathname) ? "voice" : null);
  const isLauncher = pathname === "/app" || pathname.startsWith("/app/");
  const hideChromeTitle =
    realtorMode &&
    (pathname.startsWith("/realtor/setup") ||
      pathname.startsWith("/realtor/dashboard") ||
      pathname.startsWith("/realtor/leads"));
  const title = hideChromeTitle
    ? ""
    : isLauncher
      ? "Your Transovo Products"
      : currentProduct === "numbers"
        ? getNumbersPageTitle(pathname)
        : currentProduct === "voice"
          ? getVoicePageTitle(pathname)
          : currentProduct === "sms"
            ? getMassTextPageTitle(pathname) || getSmsPageTitle(pathname)
            : getPageTitle(pathname);

  return (
    <div className="product-theme min-h-screen bg-background">
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
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          creditsRemaining={metrics.creditsRemaining}
          hasVoice={hasVoice}
          hasSms={hasSms}
          hasNumbers={hasNumbers}
          showTryIt={showTryIt}
          productFeatures={productFeatures}
        />
      </Suspense>
      <div className={sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-[260px]"}>
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
        ) : (
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
          />
        )}
        <main className="px-4 pb-28 pt-5 lg:px-6 lg:pb-8">{children}</main>
      </div>
      <MobileNav
        realtorMode={realtorMode}
        currentProduct={currentProduct}
        showTryIt={showTryIt}
        productFeatures={productFeatures}
        onMore={() => setMenuOpen(true)}
      />
    </div>
  );
}
