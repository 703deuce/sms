"use client";

import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { getPageTitle } from "@/lib/nav";
import type { DashboardMetrics, PhoneNumber, Workspace } from "@/lib/types";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function AppShell({
  children,
  userName,
  workspaceId,
  workspaces,
  phoneNumbers,
  metrics,
}: {
  children: React.ReactNode;
  userName: string;
  workspaceId: string;
  workspaces: Workspace[];
  phoneNumbers: PhoneNumber[];
  metrics: DashboardMetrics;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const title = getPageTitle(pathname);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        workspaceId={workspaceId}
        userName={userName}
        workspaces={workspaces}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
      <div className="lg:pl-[260px]">
        <Header
          title={title}
          userName={userName}
          phoneNumbers={phoneNumbers}
          metrics={metrics}
          onMenuClick={() => setMenuOpen(true)}
        />
        <main className="px-4 pb-28 pt-5 lg:px-6 lg:pb-8">{children}</main>
      </div>
      <MobileNav onMore={() => setMenuOpen(true)} />
    </div>
  );
}
