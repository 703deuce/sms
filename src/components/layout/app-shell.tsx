"use client";

import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { ProductActivityTracker } from "@/components/products/product-activity-tracker";
import { getPageTitle } from "@/lib/nav";
import { getCurrentProduct } from "@/lib/products/context";
import { isVoiceShellRoute } from "@/lib/products/voice-routes";
import { getVoicePageTitle } from "@/lib/products/voice-nav";
import { getSmsPageTitle } from "@/lib/products/sms-nav";
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
  primaryVoiceAgentId = null,
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
  primaryVoiceAgentId?: string | null;
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
  const title =
    currentProduct === "voice"
      ? getVoicePageTitle(pathname)
      : currentProduct === "sms"
        ? getSmsPageTitle(pathname)
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
          primaryVoiceAgentId={primaryVoiceAgentId}
          currentProduct={currentProduct}
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
        <Header
          title={title}
          userName={userName}
          workspaceId={workspaceId}
          workspaceName={workspaceName || "Workspace"}
          workspaceType={workspaceType}
          workspaces={workspaces}
          currentProduct={currentProduct}
          isLauncher={false}
          phoneNumbers={phoneNumbers}
          metrics={metrics}
          activeFromNumberId={activeFromNumberId}
          unreadNotifications={unreadNotifications}
          onMenuClick={() => setMenuOpen(true)}
          hasVoice={hasVoice}
          hasSms={hasSms}
          hasNumbers={hasNumbers}
        />
        <main className="px-4 pb-28 pt-5 lg:px-6 lg:pb-8">{children}</main>
      </div>
      <MobileNav
        currentProduct={currentProduct}
        showTryIt={showTryIt}
        productFeatures={productFeatures}
        onMore={() => setMenuOpen(true)}
      />
    </div>
  );
}
