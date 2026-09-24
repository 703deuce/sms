"use client";

import { flattenNavLinks, isNavGroup } from "@/lib/nav";
import type { NavChild, NavItem, NavLink } from "@/lib/nav";
import {
  isSmartRoutingSectionPathExport,
  smartRoutingFlowIdFromPath,
  type SolutionNavInstance,
} from "@/lib/solutions-nav";
import { buildRealtorNav } from "@/lib/realtor/nav";
import { buildNumbersNav } from "@/lib/products/numbers-nav";
import { buildAiAfterHoursNav } from "@/lib/products/ai-after-hours-nav";
import { buildMctbShellNav, buildMassSmsMobileNav, buildVoiceMobileNav } from "@/lib/products/voice-nav";
import { buildSmsPlatformNav } from "@/lib/products/sms-platform-nav";
import { resolveProductSidebarNav, isMctbShellActive, isAppointmentsShellActive } from "@/lib/products/resolve-product-nav";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { isMctbProductChromePath } from "@/lib/products/mctb-shell";
import { appointmentsShellHome, isAppointmentsNavItemActive } from "@/lib/products/appointments-routes";
import { productLogoHome } from "@/lib/products/context";
import { isAppointmentsV1Primary, isSmsOnlyAppNav } from "@/lib/workspace/platform-launch";
import {
  aiAfterHoursShellHome,
  massSmsShellHome,
  mctbShellHome,
  productShellLabel,
  shouldShowProductSwitcher,
  shellHomePath,
} from "@/lib/products/product-shell";
import { useProductShell, ProductShellSwitcher } from "@/components/products/product-shell-tabs";
import { CallHandlingSwitcher } from "@/components/call-handling/call-handling-switcher";
import { shouldShowCallHandlingSwitcher } from "@/lib/call-handling/show-switcher";
import type { WorkspaceFeatureSnapshot } from "@/lib/products/feature-entitlements";
import { productLabel, type CurrentProduct } from "@/lib/products/types";
import { trackCrossSellClicked } from "@/lib/products/analytics";
import { cn } from "@/lib/utils";
import { TransovoSidebar } from "@/components/kimi/sidebar/TransovoSidebar";
import { initialsForName, mapProductionNavToKimi } from "@/components/kimi/sidebar/map-nav";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export const SIDEBAR_WIDTH_PX = 224;
export const SIDEBAR_COLLAPSED_WIDTH_PX = 56;

const PLAN_BALANCE_LIMIT = 100;

function hrefPath(href: string) {
  return href.split("?")[0] || href;
}

function isNavHrefActive(pathname: string, search: string, href: string): boolean {
  const pathPart = hrefPath(href);
  const queryPart = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
  const have = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  if (queryPart) {
    if (pathname !== pathPart && !pathname.startsWith(`${pathPart}/`)) {
      return false;
    }
    if (pathname === pathPart || pathname.startsWith(`${pathPart}/`)) {
      const want = new URLSearchParams(queryPart);
      if (want.has("channel")) {
        return have.get("channel") === want.get("channel");
      }
      let matchedQuery = true;
      let sawWantedKey = false;
      for (const [key, value] of want) {
        if (have.has(key)) {
          sawWantedKey = true;
          if (have.get(key) !== value) matchedQuery = false;
        }
      }
      if (sawWantedKey) return matchedQuery;
      return pathname === pathPart || pathname.startsWith(`${pathPart}/`);
    }
    return false;
  }

  if (pathPart === "/appointments") {
    return isAppointmentsNavItemActive("/appointments", pathname);
  }

  if (pathname === pathPart) {
    if (have.has("type")) return false;
    if (have.has("channel")) return false;
    return true;
  }

  if (have.has("channel")) return false;
  return pathname.startsWith(`${pathPart}/`);
}

function linkMatchScore(pathname: string, search: string, href: string): number {
  if (!isNavHrefActive(pathname, search, href)) return -1;
  const pathPart = hrefPath(href);
  const queryPart = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
  const have = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  let score = pathPart.length;
  if (pathname === pathPart) score += 20_000;
  else if (pathname.startsWith(`${pathPart}/`)) score += 10_000;
  if (queryPart) {
    const want = new URLSearchParams(queryPart);
    for (const [key, value] of want) {
      if (have.get(key) === value) score += 50_000;
    }
  } else if (!have.has("channel")) {
    score += 25_000;
  }
  return score;
}

function itemExpandKey(item: NavItem): string {
  return `${item.href}::${item.label}`;
}

function sectionHasActiveChild(
  children: NavChild[] | undefined,
  pathname: string,
  search: string,
): boolean {
  return flattenNavLinks(children).some((link) =>
    isNavHrefActive(pathname, search, link.href),
  );
}

function bestExpandedKey(
  navItems: NavItem[],
  pathname: string,
  search: string,
): string | null {
  const outcomesSlug = pathname.match(/^\/outcomes\/([^/]+)/)?.[1];
  if (outcomesSlug) {
    const matches = navItems.filter(
      (item) => hrefPath(item.href) === `/outcomes/${outcomesSlug}`,
    );
    let best: NavItem | undefined;
    let bestScore = -1;
    for (const item of matches) {
      const score = linkMatchScore(pathname, search, item.href);
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }
    if (best?.children?.length) return itemExpandKey(best);
    if (best && !best.children?.length) {
      const withTree = matches.find((item) => item.children?.length);
      if (withTree && bestScore < 50_000) return itemExpandKey(withTree);
      return itemExpandKey(best);
    }
  }

  let bestKey: string | null = null;
  let bestScore = -1;

  for (const item of navItems) {
    let score = -1;

    score = Math.max(score, linkMatchScore(pathname, search, item.href));
    for (const link of flattenNavLinks(item.children)) {
      score = Math.max(score, linkMatchScore(pathname, search, link.href));
    }

    if (
      item.href !== "/dashboard" &&
      item.href !== "/outcomes" &&
      pathname.startsWith(`${hrefPath(item.href)}/`)
    ) {
      const base = hrefPath(item.href).length + (item.children?.length ? 2_000 : 0);
      score = Math.max(score, base);
    }

    if (
      item.label === "Configure" &&
      item.href === MCTB_ROUTES.setup &&
      pathname.startsWith(MCTB_ROUTES.setup)
    ) {
      score = Math.max(score, 60_000);
    }
    if (
      item.label === "Routing Setup" &&
      item.href === "/smart-routing/setup" &&
      pathname.startsWith("/smart-routing/setup")
    ) {
      score = Math.max(score, 60_000);
    }
    if (
      item.label === "Missed Calls" &&
      (pathname.startsWith(MCTB_ROUTES.missedCalls) || pathname.startsWith("/voice/missed-calls"))
    ) {
      score = Math.max(score, 60_000);
    }
    if (
      item.label === "Consent log" &&
      (pathname.startsWith(MCTB_ROUTES.complianceConsent) || pathname.startsWith("/voice/consent-log"))
    ) {
      score = Math.max(score, 60_000);
    }
    if (
      item.label === "Try It" &&
      (pathname.startsWith(MCTB_ROUTES.setupTest) || pathname.startsWith("/voice/try-it"))
    ) {
      score = Math.max(score, 60_000);
    }
    if (item.label === "Compliance" && pathname.startsWith("/compliance")) {
      score = Math.max(score, 60_000);
    }

    if (score > bestScore || (score === bestScore && item.children?.length && score >= 0)) {
      if (score > bestScore) {
        bestScore = score;
        bestKey = itemExpandKey(item);
      }
    }
  }

  return bestScore >= 0 ? bestKey : null;
}

function NavLinkRow({
  link,
  sectionHref,
  pathname,
  search,
  onClose,
}: {
  link: NavLink;
  sectionHref: string;
  pathname: string;
  search: string;
  onClose?: () => void;
}) {
  const pathPart = hrefPath(link.href);
  const sectionPath = hrefPath(sectionHref);
  const matched = isNavHrefActive(pathname, search, link.href);
  const prefix =
    pathPart !== sectionPath &&
    (pathname === pathPart || pathname.startsWith(`${pathPart}/`));
  const active = matched || prefix;

  return (
    <Link
      href={link.href}
      data-nav-active={active ? "true" : undefined}
      onClick={onClose}
      className={cn(
        "block rounded-md px-2.5 py-1.5 text-[12px] transition",
        active
          ? "bg-primary/10 font-semibold text-primary"
          : "text-sidebar-muted hover:bg-[#f3f4f6] hover:text-sidebar-foreground",
      )}
    >
      <span className="flex items-center gap-2">
        {link.label}
        {link.badge ? (
          <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            {link.badge}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function MessageCreditsCard({ creditsRemaining }: { creditsRemaining?: number }) {
  const total = PLAN_BALANCE_LIMIT;
  const remaining =
    typeof creditsRemaining === "number"
      ? Math.max(0, Math.min(creditsRemaining, total))
      : Math.round(total * 0.15);
  const pct = total > 0 ? Math.min(100, Math.round((remaining / total) * 100)) : 0;

  return (
    <div className="mx-1 rounded-lg border border-[#e6e8ef] bg-muted/40 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-[#111827]">Message Credits</span>
        <Link
          href="/settings/billing"
          className="text-[11px] font-medium text-[#6366f1] hover:text-[#4f46e5]"
        >
          Upgrade
        </Link>
      </div>
      <div className="transovo-credits-bar mt-2">
        <div className="transovo-credits-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] text-sidebar-muted whitespace-nowrap">
        {remaining.toLocaleString()} Credits Remaining
      </p>
    </div>
  );
}

export function Sidebar({
  userName,
  workspaceName,
  open,
  onClose,
  outcomeInstances = {},
  primaryVoiceAgentId = null,
  realtorMode = false,
  currentProduct = null,
  isLauncher = false,
  inboxBadge = 0,
  collapsed = false,
  onToggleCollapse,
  creditsRemaining,
  hasVoice = false,
  hasSms = false,
  hasNumbers = false,
  hasMctb = false,
  hasAiAfterHours = false,
  showTryIt = false,
  productFeatures = null,
}: {
  userName: string;
  workspaceName?: string;
  open?: boolean;
  onClose?: () => void;
  outcomeInstances?: Record<string, SolutionNavInstance[]>;
  primaryVoiceAgentId?: string | null;
  realtorMode?: boolean;
  currentProduct?: CurrentProduct;
  isLauncher?: boolean;
  inboxBadge?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  creditsRemaining?: number;
  hasVoice?: boolean;
  hasSms?: boolean;
  hasNumbers?: boolean;
  hasMctb?: boolean;
  hasAiAfterHours?: boolean;
  showTryIt?: boolean;
  productFeatures?: WorkspaceFeatureSnapshot | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : "";
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const hasMassSms = hasSms;
  const multiProduct = shouldShowProductSwitcher({
    hasMctb,
    hasMassSms,
    hasAiAfterHours,
  });
  const showCallHandlingSwitcher = shouldShowCallHandlingSwitcher({
    hasMctb,
    hasVoice,
  });
  const { shell: productShell } = useProductShell(hasMctb, hasMassSms, hasAiAfterHours);
  const isAppointmentsOverviewPilot = pathname === "/appointments/overview";
  const softCoolSlateShell =
    isAppointmentsOverviewPilot || isMctbProductChromePath(pathname, productShell);
  const sidebarExpandedPx = softCoolSlateShell ? 204 : SIDEBAR_WIDTH_PX;

  const navItems: NavItem[] = useMemo(() => {
    if (realtorMode) return buildRealtorNav(inboxBadge);
    if (isLauncher) return [];
    if (currentProduct === "numbers") {
      return buildNumbersNav({
        smartRoutingFlowId: smartRoutingFlowIdFromPath(pathname),
      });
    }

    return resolveProductSidebarNav({
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
    });
  }, [
    primaryVoiceAgentId,
    showTryIt,
    productFeatures,
    pathname,
    realtorMode,
    currentProduct,
    isLauncher,
    inboxBadge,
    hasSms,
    hasMassSms,
    hasMctb,
    hasVoice,
    hasNumbers,
    hasAiAfterHours,
    multiProduct,
    productShell,
  ]);

  useEffect(() => {
    setExpanded(bestExpandedKey(navItems, pathname, search));
  }, [pathname, search, navItems]);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>('[data-nav-active="true"]');
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname, search, expanded]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const homeHref =
    isMctbShellActive(pathname, multiProduct, productShell)
      ? mctbShellHome()
      : isAppointmentsShellActive(pathname, multiProduct, productShell)
        ? appointmentsShellHome()
        : multiProduct && productShell === "appointments"
          ? appointmentsShellHome()
          : multiProduct && productShell === "mctb"
            ? mctbShellHome()
            : isAppointmentsV1Primary()
    ? appointmentsShellHome()
    : realtorMode
    ? "/realtor/dashboard"
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

  const useKimiSidebar = !realtorMode && !isLauncher && currentProduct !== "numbers";

  if (useKimiSidebar) {
    const planLabel =
      multiProduct
        ? productShellLabel(productShell)
        : hasMassSms
          ? productShellLabel("mass_sms")
          : hasAiAfterHours
            ? productShellLabel("ai_after_hours")
            : hasMctb
              ? productShellLabel("mctb")
              : workspaceName || "Account";

    const kimiAside = (
      <TransovoSidebar
        navItems={mapProductionNavToKimi(navItems)}
        activeRoute={pathname}
        search={search}
        collapsed={collapsed}
        expandedWidthPx={sidebarExpandedPx}
        appointmentsOverviewShell={softCoolSlateShell}
        mctbBrandMark={isMctbProductChromePath(pathname, productShell, { hasMctb })}
        onToggleCollapse={onToggleCollapse}
        homeHref={homeHref}
        productSwitcher={
          showCallHandlingSwitcher ? (
            <CallHandlingSwitcher collapsed={collapsed} className="px-0 pb-0" />
          ) : multiProduct ? (
            <ProductShellSwitcher
              hasMctb={hasMctb}
              hasMassSms={hasMassSms}
              hasAiAfterHours={hasAiAfterHours}
              collapsed={collapsed}
              onNavigate={onClose}
              className="px-0 pb-0"
            />
          ) : undefined
        }
        credits={{
          label: "Message Credits",
          remaining:
            typeof creditsRemaining === "number" ? creditsRemaining : PLAN_BALANCE_LIMIT,
          total: PLAN_BALANCE_LIMIT,
        }}
        user={{
          name: userName,
          initials: initialsForName(userName),
          plan: planLabel,
        }}
      />
    );

    return (
      <>
        <div
          className={cn(
            "hidden lg:fixed lg:inset-y-0 lg:z-30 lg:flex",
            collapsed ? "lg:w-[56px]" : "lg:w-[224px]",
          )}
          style={collapsed ? undefined : { width: sidebarExpandedPx }}
        >
          {kimiAside}
        </div>
        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              onClick={onClose}
              aria-label="Close menu"
            />
            <div className="absolute inset-y-0 left-0 shadow-2xl">{kimiAside}</div>
          </div>
        ) : null}
      </>
    );
  }

  const content = (
    <aside
      className={cn(
        "transovo-sidebar flex h-dvh flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[56px]" : "w-[224px]",
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-0" : "px-4",
        )}
      >
        <Link
          href={
            realtorMode
              ? "/realtor/dashboard"
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
                          : "/app"
          }
          className={cn("flex min-w-0 items-center gap-2", collapsed && "justify-center")}
          onClick={onClose}
          title={collapsed ? "Transovo" : undefined}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#6366f1] text-white">
            <MessageSquare className="h-3.5 w-3.5" fill="currentColor" />
          </span>
          {!collapsed ? (
            <span className="truncate text-[15px] font-semibold tracking-tight text-[#111827]">
              {realtorMode ? "TRANSOVO" : "Transovo"}
            </span>
          ) : null}
        </Link>
      </div>

      {showCallHandlingSwitcher && !realtorMode && !isLauncher && currentProduct !== "numbers" ? (
        <CallHandlingSwitcher collapsed={collapsed} onNavigate={onClose} />
      ) : multiProduct && !realtorMode && !isLauncher && currentProduct !== "numbers" ? (
        <ProductShellSwitcher
          hasMctb={hasMctb}
          hasMassSms={hasMassSms}
          hasAiAfterHours={hasAiAfterHours}
          collapsed={collapsed}
          onNavigate={onClose}
        />
      ) : null}

      {currentProduct === "numbers" && !collapsed ? (
        <div className="px-3 pb-2">
          <Link
            href="/personal/numbers/premium"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#6366f1] px-3 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-[#5558e8]"
          >
            + Add Line
          </Link>
        </div>
      ) : null}

      <nav
        className={cn(
          "transovo-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain py-2",
          collapsed ? "flex flex-col items-center gap-0.5 px-2" : "space-y-0.5 px-2",
        )}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const childActive = sectionHasActiveChild(item.children, pathname, search);
          const tryItOwned =
            (item.label === "Try It" || item.label === "Try Missed Call Text Back") &&
            (pathname.startsWith(MCTB_ROUTES.setupTest) || pathname.startsWith("/voice/try-it"));
          const mctbConfigureOwned =
            item.href === MCTB_ROUTES.setup && pathname.startsWith(MCTB_ROUTES.setup);
          const srSetupOwned =
            item.href === "/smart-routing/setup" && pathname.startsWith("/smart-routing/setup");
          const missedCallsOwned =
            item.label === "Missed Calls" &&
            (pathname.startsWith(MCTB_ROUTES.missedCalls) || pathname.startsWith("/voice/missed-calls"));
          const consentLogOwned =
            item.label === "Consent log" &&
            (pathname.startsWith(MCTB_ROUTES.complianceConsent) ||
              pathname.startsWith("/voice/consent-log"));
          const complianceOwned =
            item.label === "Messaging Compliance" && pathname.startsWith("/compliance");
          const expandKey = itemExpandKey(item);
          const personalOverviewExactOnly =
            currentProduct === "numbers" && item.href === "/personal" && pathname !== "/personal";
          const itemHrefActive = item.matchExact
            ? pathname === hrefPath(item.href)
            : isNavHrefActive(pathname, search, item.href) && !personalOverviewExactOnly;
          const growOwned = item.label === "Grow" && pathname.startsWith("/grow");
          const smsNumbersOwned =
            item.label === "Numbers" &&
            pathname.startsWith("/numbers") &&
            !pathname.startsWith("/numbers/premium") &&
            !pathname.startsWith("/numbers/pools");
          const settingsOwned =
            item.label === "Settings" &&
            (pathname === "/settings" || pathname.startsWith("/settings/"));
          const helpOwned =
            item.label === "Help" &&
            (pathname === "/getting-started" ||
              pathname.startsWith("/getting-started/") ||
              pathname.startsWith("/help") ||
              pathname.startsWith("/contact"));
          const ownedOutcome =
            tryItOwned ||
            mctbConfigureOwned ||
            srSetupOwned ||
            missedCallsOwned ||
            consentLogOwned ||
            complianceOwned ||
            growOwned ||
            smsNumbersOwned ||
            settingsOwned ||
            helpOwned ||
            (currentProduct === "numbers" && item.href === "/personal"
              ? pathname === "/personal"
              : !item.matchExact &&
                (pathname.startsWith(`${hrefPath(item.href)}/`) ||
                  pathname === hrefPath(item.href)));
          const active =
            itemHrefActive ||
            Boolean(childActive) ||
            (item.href !== "/dashboard" &&
              item.href !== "/outcomes" &&
              ownedOutcome &&
              !personalOverviewExactOnly &&
              !navItems.some(
                (other) =>
                  other !== item &&
                  hrefPath(other.href) === hrefPath(item.href) &&
                  linkMatchScore(pathname, search, other.href) >
                    linkMatchScore(pathname, search, item.href),
              ));
          const isOpen = expanded === expandKey;

          return (
            <div key={expandKey}>
              {item.sectionLabel && !collapsed ? (
                <p className="px-2 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted">
                  {item.sectionLabel}
                </p>
              ) : null}
              {item.areaLabel && !collapsed ? (
                <p
                  className={cn(
                    "px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted",
                    !item.sectionLabel && "pt-3",
                  )}
                >
                  {item.areaLabel}
                </p>
              ) : null}
              <div
                className={cn(
                  "group relative flex items-center rounded-md transition",
                  collapsed ? "w-full justify-center" : "",
                )}
              >
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  data-active={active ? "true" : undefined}
                  onClick={() => {
                    if (item.children?.length && !collapsed) setExpanded(expandKey);
                    onClose?.();
                  }}
                  className={cn(
                    "transovo-nav-item flex min-w-0 flex-1 items-center gap-2.5 text-[13px] text-sidebar-muted hover:text-sidebar-foreground",
                    collapsed
                      ? "h-10 w-10 justify-center rounded-md px-0"
                      : "rounded-md px-3 py-[7px]",
                    active && "text-[#4f46e5]",
                  )}
                >
                  <span className="relative shrink-0">
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    {collapsed && item.badge != null ? (
                      <span className="transovo-badge-dot">{item.badge}</span>
                    ) : null}
                  </span>
                  {!collapsed ? <span className="flex-1 truncate text-left">{item.label}</span> : null}
                  {!collapsed && item.badge != null ? (
                    <span className="transovo-badge">{item.badge}</span>
                  ) : null}
                </Link>
                {item.children && !collapsed ? (
                  <button
                    type="button"
                    className="mr-1 rounded-md p-1.5 text-sidebar-muted hover:bg-[#f3f4f6] hover:text-sidebar-foreground"
                    onClick={() =>
                      setExpanded((current) =>
                        current === expandKey ? null : expandKey,
                      )
                    }
                    aria-expanded={isOpen}
                    aria-label={`Toggle ${item.label}`}
                  >
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                ) : null}
              </div>

              {item.children && isOpen && !collapsed ? (
                <div className="mb-0.5 ml-3.5 mt-0.5 space-y-1 border-l border-[#e6e8ef] pl-2.5">
                  {item.children.map((child) => {
                    if (isNavGroup(child)) {
                      return (
                        <div key={child.label} className="pt-1">
                          <p className="px-2.5 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted">
                            {child.label}
                          </p>
                          <div className="space-y-px">
                            {child.children.map((link) => (
                              <NavLinkRow
                                key={link.href + link.label}
                                link={link}
                                sectionHref={item.href}
                                pathname={pathname}
                                search={search}
                                onClose={onClose}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <NavLinkRow
                        key={child.href + child.label}
                        link={child}
                        sectionHref={item.href}
                        pathname={pathname}
                        search={search}
                        onClose={onClose}
                      />
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}

        {!collapsed && !realtorMode && currentProduct === "numbers" ? (
          <div className="mx-2 mt-3 rounded-xl border border-[#e6e8ef] bg-[#f5f3ff] p-3">
            <p className="text-[11px] font-semibold text-[#111827]">Need Missed Call Text Back?</p>
            <Link
              href="/api/products/open?product=voice"
              onClick={() => {
                trackCrossSellClicked("numbers", "voice");
                onClose?.();
              }}
              className="mt-2 inline-block text-[11px] font-semibold text-[#6366f1]"
            >
              Try {productLabel("voice")}
            </Link>
          </div>
        ) : null}

        {currentProduct === "voice" && !hasNumbers && !collapsed ? (
          <div className="mx-2 mt-3 rounded-xl border border-[#e6e8ef] bg-[#f5f3ff] p-3">
            <p className="text-[11px] font-semibold text-[#111827]">
              Want a memorable business number?
            </p>
            <Link
              href="/personal/numbers/premium"
              onClick={() => {
                trackCrossSellClicked("voice", "numbers");
                onClose?.();
              }}
              className="mt-2 inline-block text-[11px] font-semibold text-[#6366f1]"
            >
              Browse {productLabel("numbers")}
            </Link>
          </div>
        ) : null}

        {currentProduct === "numbers" && !collapsed ? (
          <div className="mt-3 space-y-1 px-1">
            <Link
              href="/contact"
              className="block rounded-md px-2.5 py-2 text-[12px] font-medium text-sidebar-muted hover:bg-[#f3f4f6]"
              onClick={onClose}
            >
              Help Center
            </Link>
            <Link
              href="/settings/billing"
              className="block rounded-md px-2.5 py-2 text-[12px] font-medium text-sidebar-muted hover:bg-[#f3f4f6]"
              onClick={onClose}
            >
              Settings
            </Link>
            <div className="mt-3 rounded-xl border border-[#e6e8ef] bg-[#f5f3ff] p-3">
              <p className="text-[11px] font-semibold text-[#111827]">
                Keep your number always within reach.
              </p>
              <p className="mt-1 text-[10px] leading-snug text-[#6b7280]">
                Don&apos;t lose it even if you don&apos;t use it.
              </p>
              <Link
                href="/personal/vault"
                className="mt-2 inline-block text-[11px] font-semibold text-[#6366f1]"
                onClick={onClose}
              >
                Learn More
              </Link>
            </div>
          </div>
        ) : null}

      </nav>

      <div
        className={cn(
          "shrink-0 border-t border-sidebar-border",
          collapsed ? "flex flex-col items-center gap-1 py-3" : "space-y-0.5 px-2 py-2",
        )}
      >
        {collapsed ? (
          <>
            <button
              type="button"
              title={userName}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700"
            >
              {userName
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </button>
            {onToggleCollapse ? (
              <button
                type="button"
                title="Expand sidebar"
                onClick={onToggleCollapse}
                className="transovo-nav-item mt-1 flex h-10 w-10 items-center justify-center rounded-md text-sidebar-muted hover:text-sidebar-foreground"
              >
                <ChevronsRight className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </button>
            ) : null}
          </>
        ) : (
          <>
            {!realtorMode && currentProduct !== "numbers" ? (
              <MessageCreditsCard creditsRemaining={creditsRemaining} />
            ) : null}

            <div className="mt-1 flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-muted/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/avatars/alex.svg"
                alt={userName}
                className="h-7 w-7 shrink-0 rounded-full object-cover ring-2 ring-[#e6e8ef]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-[#111827] leading-tight">
                  {userName}
                </p>
                <p className="truncate text-[11px] text-sidebar-muted leading-tight">
                  {currentProduct === "numbers"
                    ? "Numbers"
                    : multiProduct
                      ? productShellLabel(productShell)
                      : hasMassSms
                        ? productShellLabel("mass_sms")
                        : hasAiAfterHours
                          ? productShellLabel("ai_after_hours")
                          : hasMctb
                            ? productShellLabel("mctb")
                            : realtorMode && workspaceName
                              ? workspaceName
                              : "Account"}
                </p>
              </div>
              {onToggleCollapse ? (
                <button
                  type="button"
                  title="Collapse sidebar"
                  onClick={onToggleCollapse}
                  className="transovo-nav-item flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-muted hover:text-sidebar-foreground"
                >
                  <ChevronsLeft className="h-4 w-4" strokeWidth={1.75} />
                </button>
              ) : !realtorMode ? (
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-md p-1.5 text-sidebar-muted hover:bg-[#eef0f5] hover:text-sidebar-foreground"
                  aria-label="Log out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-sidebar-muted" aria-hidden />
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );

  return (
    <>
      <div
        className={cn(
          "hidden lg:fixed lg:inset-y-0 lg:z-30 lg:flex",
          collapsed ? "lg:w-[56px]" : "lg:w-[224px]",
        )}
      >
        {content}
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            aria-label="Close menu"
          />
          <div className="absolute inset-y-0 left-0 shadow-2xl">{content}</div>
        </div>
      ) : null}
    </>
  );
}
