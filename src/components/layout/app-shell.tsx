"use client";

import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { getPageTitle } from "@/lib/nav";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function AppShell({
  children,
  userName,
  workspaceId,
}: {
  children: React.ReactNode;
  userName: string;
  workspaceId: string;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const title = getPageTitle(pathname);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        workspaceId={workspaceId}
        userName={userName}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
      <div className="lg:pl-[248px]">
        <Header
          title={title}
          userName={userName}
          onMenuClick={() => setMenuOpen(true)}
        />
        <main className="px-4 pb-28 pt-5 lg:px-6 lg:pb-8">{children}</main>
      </div>
      <MobileNav onMore={() => setMenuOpen(true)} />
    </div>
  );
}
