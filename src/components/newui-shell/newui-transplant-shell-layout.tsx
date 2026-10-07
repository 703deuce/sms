"use client";

import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/newui-transplant/components/ui/sidebar";
import { TooltipProvider } from "@/newui-transplant/components/ui/tooltip";
import { AppSidebar } from "@/newui-transplant/components/app/app-sidebar";
import { Topbar } from "@/newui-transplant/components/app/topbar";
import { OpusWorkspaceDataProvider } from "@/newui-transplant/context/opus-workspace-data";
import { cn } from "@/lib/utils";

/** Scrollable main column inside fixed h-dvh shell (mobile + desktop). */
const DEFAULT_MAIN_SCROLL_CLASS =
  "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y [-webkit-overflow-scrolling:touch]";

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
  hasAppointmentReminders?: boolean;
  hasAiAfterHours?: boolean;
  workspaces?: unknown[];
};

export function NewUiTransplantShellLayout({
  children,
  mainClassName,
  workspaceName,
  userName,
  hasMctb = true,
  hasAppointmentReminders = true,
  hasAiAfterHours = false,
}: NewUiTransplantShellLayoutProps) {
  const wsName = workspaceName?.trim() || "Workspace";
  return (
    <TooltipProvider>
      <OpusWorkspaceDataProvider workspaceName={wsName}>
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <SidebarProvider className="flex h-full min-h-0 w-full flex-1 overflow-hidden">
          <AppSidebar
            userName={userName}
            hasMctb={hasMctb}
            hasAppointmentReminders={hasAppointmentReminders}
            hasAiAfterHours={hasAiAfterHours}
          />
          <SidebarInset className="min-h-0 min-w-0 flex-1 bg-background">
            <div className="shrink-0">
              <Topbar userName={userName} />
            </div>
            <div className={cn(DEFAULT_MAIN_SCROLL_CLASS, mainClassName)}>{children}</div>
          </SidebarInset>
        </SidebarProvider>
        </div>
      </OpusWorkspaceDataProvider>
    </TooltipProvider>
  );
}
