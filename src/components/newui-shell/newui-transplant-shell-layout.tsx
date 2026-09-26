"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/newui-transplant/components/ui/sidebar";
import { TooltipProvider } from "@/newui-transplant/components/ui/tooltip";
import { AppSidebar } from "@/newui-transplant/components/app/app-sidebar";
import { Topbar } from "@/newui-transplant/components/app/topbar";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { CallHandlingSwitcher } from "@/components/call-handling/call-handling-switcher";
import { ProductShellSwitcher } from "@/components/products/product-shell-tabs";
import { shouldShowCallHandlingSwitcher } from "@/lib/call-handling/show-switcher";
import { shouldShowProductSwitcher } from "@/lib/products/product-shell";
import { resolveProductSidebarNav } from "@/lib/products/resolve-product-nav";
import { smartRoutingFlowIdFromPath } from "@/lib/solutions-nav";
import {
  aiAfterHoursShellHome,
  appointmentsProductShellHome,
  massSmsShellHome,
  mctbShellHome,
  shellHomePath,
} from "@/lib/products/product-shell";
import { isMctbShellActive, isAppointmentsShellActive } from "@/lib/products/resolve-product-nav";
import { isAppointmentsV1Primary } from "@/lib/workspace/platform-launch";
import { productLogoHome } from "@/lib/products/context";
import { useProductShell } from "@/components/products/product-shell-tabs";
import { initialsForName } from "@/components/kimi/sidebar/map-nav";
import {
  newUiBreadcrumbFromSections,
  productionNavToNewUiSections,
} from "@/lib/newui-transplant/production-nav-sections";
import type { WorkspaceFeatureSnapshot } from "@/lib/products/feature-entitlements";
import type { CurrentProduct } from "@/lib/products/types";
import type { Workspace } from "@/lib/types";
import Link from "next/link";

export type NewUiTransplantShellLayoutProps = {
  children: ReactNode;
  userName: string;
  workspaceId?: string;
  workspaceName?: string;
  workspaces?: Workspace[];
  pageTitle: string;
  unreadNotifications?: number;
  creditsRemaining?: number;
  currentProduct: CurrentProduct;
  isLauncher: boolean;
  realtorMode: boolean;
  inboxBadge: number;
  primaryVoiceAgentId?: string | null;
  showTryIt?: boolean;
  productFeatures?: WorkspaceFeatureSnapshot | null;
  hasVoice?: boolean;
  hasSms?: boolean;
  hasNumbers?: boolean;
  hasMctb?: boolean;
  hasAiAfterHours?: boolean;
  mainClassName?: string;
};

export function NewUiTransplantShellLayout({
  children,
  userName,
  workspaceId,
  workspaceName = "Workspace",
  workspaces = [],
  pageTitle,
  unreadNotifications = 0,
  creditsRemaining,
  currentProduct,
  isLauncher,
  inboxBadge,
  primaryVoiceAgentId = null,
  showTryIt = false,
  productFeatures = null,
  hasVoice = false,
  hasSms = false,
  hasNumbers = false,
  hasMctb = false,
  hasAiAfterHours = false,
  mainClassName,
}: NewUiTransplantShellLayoutProps) {
  const pathname = usePathname();
  const hasMassSms = hasSms;
  const multiProduct = shouldShowProductSwitcher({ hasMctb, hasMassSms, hasAiAfterHours });
  const { shell: productShell } = useProductShell(hasMctb, hasMassSms, hasAiAfterHours);
  const showCallHandlingSwitcher = shouldShowCallHandlingSwitcher({ hasMctb, hasVoice });

  const navItems = useMemo(
    () =>
      resolveProductSidebarNav({
        pathname,
        inboxBadge,
        multiProduct,
        productShell,
        primaryVoiceAgentId,
        showTryIt,
        productFeatures,
        hasSms,
        hasMctb,
        hasVoice,
        hasNumbers,
        smartRoutingFlowId: smartRoutingFlowIdFromPath(pathname),
      }),
    [
      pathname,
      inboxBadge,
      multiProduct,
      productShell,
      primaryVoiceAgentId,
      showTryIt,
      productFeatures,
      hasSms,
      hasMctb,
      hasVoice,
      hasNumbers,
    ],
  );

  const sections = useMemo(() => productionNavToNewUiSections(navItems), [navItems]);
  const { section, page } = newUiBreadcrumbFromSections(pathname, sections, pageTitle);
  const breadcrumbPage = pageTitle || page;

  const homeHref =
    isMctbShellActive(pathname, multiProduct, productShell)
      ? mctbShellHome()
      : isAppointmentsShellActive(pathname, multiProduct, productShell)
        ? appointmentsProductShellHome()
        : multiProduct && productShell === "appointments"
          ? appointmentsProductShellHome()
          : multiProduct && productShell === "mctb"
            ? mctbShellHome()
            : isAppointmentsV1Primary()
              ? appointmentsProductShellHome()
              : isLauncher
                ? "/app"
                : currentProduct === "numbers"
                  ? productLogoHome("numbers")
                  : multiProduct
                    ? shellHomePath(productShell)
                    : hasMassSms
                      ? massSmsShellHome()
                      : hasAiAfterHours
                        ? aiAfterHoursShellHome()
                        : hasMctb
                          ? mctbShellHome()
                          : "/app";

  const workspaceControl = showCallHandlingSwitcher ? (
    <CallHandlingSwitcher className="px-0 pb-0" requireProvider />
  ) : multiProduct ? (
    <ProductShellSwitcher
      hasMctb={hasMctb}
      hasMassSms={hasMassSms}
      hasAiAfterHours={hasAiAfterHours}
      collapsed={false}
      className="px-0 pb-0"
    />
  ) : workspaceId && workspaces.length > 0 ? (
    <WorkspaceSwitcher
      workspaceId={workspaceId}
      workspaceName={workspaceName}
      workspaces={workspaces}
      className="w-full"
    />
  ) : (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-2.5 py-2 text-left transition-colors hover:bg-sidebar-accent"
    >
      <span className="flex size-6 items-center justify-center rounded-md bg-sidebar-border text-[11px] font-semibold text-sidebar-accent-foreground">
        {initialsForName(workspaceName).slice(0, 2)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-sidebar-accent-foreground">{workspaceName}</span>
      </span>
    </button>
  );

  const footer =
    typeof creditsRemaining === "number" ? (
      <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-sidebar-accent-foreground">Message credits</span>
          <span className="text-sidebar-foreground/70">{creditsRemaining}</span>
        </div>
        <Link href="/settings/billing" className="mt-2 inline-block text-[11px] text-sidebar-primary hover:underline">
          Manage plan
        </Link>
      </div>
    ) : undefined;

  return (
    <TooltipProvider>
      <SidebarProvider className="flex min-h-0 flex-1">
        <AppSidebar
          sections={sections}
          homeHref={homeHref}
          workspaceControl={workspaceControl}
          footer={footer}
        />
        <SidebarInset className="min-w-0 bg-background">
          <Topbar
            section={section}
            page={breadcrumbPage}
            userInitials={initialsForName(userName)}
            unreadNotifications={unreadNotifications}
            searchDisabled
          />
          <div className={mainClassName}>{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
