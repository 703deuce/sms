"use client";

import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/newui-transplant/components/ui/sidebar";
import { TooltipProvider } from "@/newui-transplant/components/ui/tooltip";
import { AppSidebar } from "@/newui-transplant/components/app/app-sidebar";
import { Topbar } from "@/newui-transplant/components/app/topbar";

/**
 * Phase 1 — exact Opus shell (sidebar + topbar from newui/). Production session/workspace
 * wiring is deferred until it maps to controls Opus already designed.
 */
export type NewUiTransplantShellLayoutProps = {
  children: ReactNode;
  mainClassName?: string;
  /** @deprecated Phase 1 ignores production nav reinterpretation */
  userName?: string;
  workspaceId?: string;
  workspaceName?: string;
  pageTitle?: string;
  unreadNotifications?: number;
  creditsRemaining?: number;
  currentProduct?: unknown;
  isLauncher?: boolean;
  realtorMode?: boolean;
  inboxBadge?: number;
  primaryVoiceAgentId?: string | null;
  showTryIt?: boolean;
  productFeatures?: unknown;
  hasVoice?: boolean;
  hasSms?: boolean;
  hasNumbers?: boolean;
  hasMctb?: boolean;
  hasAiAfterHours?: boolean;
  workspaces?: unknown[];
};

export function NewUiTransplantShellLayout({ children, mainClassName }: NewUiTransplantShellLayoutProps) {
  return (
    <TooltipProvider>
      <SidebarProvider className="flex min-h-0 flex-1">
        <AppSidebar />
        <SidebarInset className="min-w-0 bg-background">
          <Topbar />
          <div className={mainClassName ?? "flex-1"}>{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
