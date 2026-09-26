"use client";

import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/newui-transplant/components/ui/sidebar";
import { TooltipProvider } from "@/newui-transplant/components/ui/tooltip";
import { AppSidebar } from "@/newui-transplant/components/app/app-sidebar";
import { Topbar } from "@/newui-transplant/components/app/topbar";
import { OpusWorkspaceDataProvider } from "@/newui-transplant/context/opus-workspace-data";

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

export function NewUiTransplantShellLayout({
  children,
  mainClassName,
  workspaceName,
  userName,
}: NewUiTransplantShellLayoutProps) {
  const wsName = workspaceName?.trim() || "Workspace";
  return (
    <TooltipProvider>
      <OpusWorkspaceDataProvider workspaceName={wsName}>
        <SidebarProvider className="flex min-h-0 flex-1">
          <AppSidebar userName={userName} />
          <SidebarInset className="min-w-0 bg-background">
            <Topbar userName={userName} />
            <div className={mainClassName ?? "flex-1"}>{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </OpusWorkspaceDataProvider>
    </TooltipProvider>
  );
}
