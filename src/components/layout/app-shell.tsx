"use client";

import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { RealtorHeader } from "@/components/realtor/realtor-header";
import { Sidebar } from "@/components/layout/sidebar";
import { getPageTitle } from "@/lib/nav";
import { getRealtorPageTitle } from "@/lib/realtor/nav";
import type { SolutionNavInstance } from "@/lib/solutions-nav";
import type { DashboardMetrics, PhoneNumber, Workspace } from "@/lib/types";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";

export function AppShell({
  children,
  userName,
  isAdmin,
  workspaceId,
  workspaceName,
  workspaces,
  phoneNumbers,
  metrics,
  activeFromNumberId,
  unreadNotifications,
  outcomeInstances = {},
  realtorMode = false,
}: {
  children: React.ReactNode;
  userName: string;
  isAdmin?: boolean;
  workspaceId?: string;
  workspaceName?: string;
  workspaces?: Workspace[];
  phoneNumbers: PhoneNumber[];
  metrics: DashboardMetrics;
  activeFromNumberId?: string | null;
  unreadNotifications?: number;
  outcomeInstances?: Record<string, SolutionNavInstance[]>;
  realtorMode?: boolean;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const hideChromeTitle =
    realtorMode &&
    (pathname.startsWith("/realtor/setup") ||
      pathname.startsWith("/realtor/dashboard") ||
      pathname.startsWith("/realtor/leads"));
  const title =
    hideChromeTitle
      ? ""
      : pathname === "/outcomes" ||
          pathname === "/systems" ||
          pathname === "/agents" ||
          pathname.startsWith("/agents/")
        ? ""
        : (realtorMode ? getRealtorPageTitle(pathname) : null) || getPageTitle(pathname);

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <Sidebar
          userName={userName}
          workspaceName={workspaceName}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          outcomeInstances={outcomeInstances}
          realtorMode={realtorMode}
          inboxBadge={unreadNotifications}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
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
            phoneNumbers={phoneNumbers}
            metrics={metrics}
            activeFromNumberId={activeFromNumberId}
            unreadNotifications={unreadNotifications}
            onMenuClick={() => setMenuOpen(true)}
          />
        )}
        <main className="px-4 pb-28 pt-5 lg:px-6 lg:pb-8">{children}</main>
      </div>
      <MobileNav realtorMode={realtorMode} onMore={() => setMenuOpen(true)} />
    </div>
  );
}
