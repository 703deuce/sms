"use client";

import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { getPageTitle } from "@/lib/nav";
import type { SolutionNavInstance } from "@/lib/solutions-nav";
import type { DashboardMetrics, PhoneNumber, Workspace } from "@/lib/types";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";

export function AppShell({
  children,
  userName,
  phoneNumbers,
  metrics,
  activeFromNumberId,
  unreadNotifications,
  outcomeInstances = {},
}: {
  children: React.ReactNode;
  userName: string;
  workspaceId?: string;
  workspaces?: Workspace[];
  phoneNumbers: PhoneNumber[];
  metrics: DashboardMetrics;
  activeFromNumberId?: string | null;
  unreadNotifications?: number;
  outcomeInstances?: Record<string, SolutionNavInstance[]>;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  // Page hero owns the Solutions Dashboard title — avoid a duplicate chrome h1.
  const title =
    pathname === "/outcomes" || pathname === "/systems"
      ? ""
      : getPageTitle(pathname);

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <Sidebar
          userName={userName}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          outcomeInstances={outcomeInstances}
        />
      </Suspense>
      <div className="lg:pl-[260px]">
        <Header
          title={title}
          userName={userName}
          phoneNumbers={phoneNumbers}
          metrics={metrics}
          activeFromNumberId={activeFromNumberId}
          unreadNotifications={unreadNotifications}
          onMenuClick={() => setMenuOpen(true)}
        />
        <main className="px-4 pb-28 pt-5 lg:px-6 lg:pb-8">{children}</main>
      </div>
      <MobileNav onMore={() => setMenuOpen(true)} />
    </div>
  );
}
