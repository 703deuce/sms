"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
} from "lucide-react";
import type { KimiCredits, KimiNavItem, KimiSidebarUser } from "./types";
import { findBestNavMatch } from "@/lib/nav-active";
import { cn } from "@/lib/utils";

function hasPositiveBadge(badge: string | number | undefined): boolean {
  if (badge == null) return false;
  if (typeof badge === "number") return badge > 0;
  return badge.trim().length > 0;
}

/** Kimi sessions 2026-08-30T22-24-04-122Z-b95821 (initial), 2026-09-06T18-36-09-917Z-daeeac (Stage D refresh) — production wiring only. */
export interface TransovoSidebarProps {
  navItems: KimiNavItem[];
  activeRoute?: string;
  search?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  credits: KimiCredits;
  user: KimiSidebarUser;
  upgradeHref?: string;
  homeHref?: string;
  /** Rendered between Transovo identity and product-local navigation. */
  productSwitcher?: ReactNode;
  /** Overview visual test — default 224. */
  expandedWidthPx?: number;
  /** Appointments overview — slate nav (inline; avoids teal `text-primary`). */
  appointmentsOverviewShell?: boolean;
  /** MCTB product — muted indigo mark in sidebar header. */
  mctbBrandMark?: boolean;
}

function Logo({
  collapsed,
  homeHref,
  neutralMark,
  mctbBrandMark,
}: {
  collapsed: boolean;
  homeHref: string;
  neutralMark?: boolean;
  mctbBrandMark?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 h-14 border-b border-border shrink-0 ${
        collapsed ? "justify-center px-0" : "px-4"
      }`}
      style={neutralMark ? { borderColor: "#dde1e5" } : undefined}
    >
      <Link href={homeHref} className="flex items-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-[6px] shrink-0 ${
            mctbBrandMark
              ? "border border-[var(--mctb-brand-ring)] bg-[var(--mctb-brand-soft)] text-[var(--mctb-brand-strong)]"
              : neutralMark
                ? "border border-[#d4d8dc] bg-[#e8eaed] text-[#1b1e23]"
                : "bg-indigo-600 text-white"
          }`}
        >
          {neutralMark || mctbBrandMark ? (
            <span className="text-[11px] font-bold leading-none tracking-tight" aria-hidden>
              T
            </span>
          ) : (
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          )}
        </span>
        {!collapsed && (
          <span
            className={`text-[15px] font-semibold tracking-tight whitespace-nowrap ${
              neutralMark ? "text-[#1b1e23]" : "text-foreground"
            }`}
          >
            Transovo
          </span>
        )}
      </Link>
    </div>
  );
}

const OVERVIEW_NAV_ACTIVE = { backgroundColor: "#e2e6ea", color: "#1b1e23" } as const;
const OVERVIEW_NAV_ICON_ACTIVE = { color: "#2a2e34" } as const;

function overviewNavRowStyle(
  active: boolean,
  appointmentsOverviewShell?: boolean,
  mctbBrandMark?: boolean,
) {
  if (!appointmentsOverviewShell || !active || mctbBrandMark) return undefined;
  return OVERVIEW_NAV_ACTIVE;
}

function overviewNavIconStyle(
  active: boolean,
  appointmentsOverviewShell?: boolean,
  mctbBrandMark?: boolean,
) {
  if (!appointmentsOverviewShell || !active || mctbBrandMark) return undefined;
  return OVERVIEW_NAV_ICON_ACTIVE;
}

function ExpandedNavRow({
  item,
  active,
  expanded,
  onToggleExpand,
  appointmentsOverviewShell,
  mctbBrandMark,
}: {
  item: KimiNavItem;
  active: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  appointmentsOverviewShell?: boolean;
  mctbBrandMark?: boolean;
}) {
  const Icon = item.icon;
  const hasChildren = !!item.children?.length;
  const className = mctbBrandMark
    ? "transovo-nav-item mctb-sidebar-nav-item"
    : appointmentsOverviewShell
      ? "transovo-nav-item flex w-full items-center gap-2 rounded-[6px] px-2.5 py-0 text-[13px] font-medium leading-[18px] text-[#626872] hover:bg-[#e8ebee] hover:text-[#1b1e23] min-h-[34px]"
      : "transovo-nav-item flex w-full items-center gap-2.5 rounded-md px-3 py-[7px] text-[13px] text-muted-foreground hover:text-foreground";
  const iconClassName = mctbBrandMark
    ? "mctb-sidebar-nav-icon shrink-0"
    : "h-4 w-4 shrink-0";
  const rowStyle = overviewNavRowStyle(active, appointmentsOverviewShell, mctbBrandMark);
  const iconStyle = overviewNavIconStyle(active, appointmentsOverviewShell, mctbBrandMark);

  if (hasChildren) {
    return (
      <button
        type="button"
        data-active={active ? "true" : undefined}
        onClick={onToggleExpand}
        className={className}
        style={rowStyle}
      >
        <Icon className={iconClassName} strokeWidth={1.75} style={iconStyle} />
        <span className="flex-1 text-left whitespace-nowrap">{item.label}</span>
        {item.badge != null && Number(item.badge) > 0 && (
          <span className="transovo-badge">{item.badge}</span>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
    );
  }

  return (
    <Link
      href={item.href}
      data-active={active ? "true" : undefined}
      className={className}
      style={rowStyle}
    >
      <Icon className={iconClassName} strokeWidth={1.75} style={iconStyle} />
      <span className="flex-1 text-left whitespace-nowrap">{item.label}</span>
      {hasPositiveBadge(item.badge) && (
        <span className="transovo-badge">{item.badge}</span>
      )}
    </Link>
  );
}

function CollapsedNavButton({
  item,
  active,
  appointmentsOverviewShell,
  mctbBrandMark,
}: {
  item: KimiNavItem;
  active: boolean;
  appointmentsOverviewShell?: boolean;
  mctbBrandMark?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      data-active={active ? "true" : undefined}
      title={item.label}
      className="transovo-nav-item relative flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
      style={overviewNavRowStyle(active, appointmentsOverviewShell, mctbBrandMark)}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      {hasPositiveBadge(item.badge) && (
        <span className="transovo-badge-dot">{item.badge}</span>
      )}
    </Link>
  );
}

function isChildNavActive(childHref: string, bestMatch: ReturnType<typeof findBestNavMatch>) {
  return bestMatch?.isChild === true && bestMatch.href === childHref;
}

export function TransovoSidebar({
  navItems,
  activeRoute = "/conversations",
  search = "",
  collapsed = false,
  onToggleCollapse,
  credits,
  user,
  upgradeHref = "/settings/billing",
  homeHref = "/dashboard",
  productSwitcher,
  expandedWidthPx = 224,
  appointmentsOverviewShell = false,
  mctbBrandMark = false,
}: TransovoSidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const routeSyncKey = `${activeRoute}|${search}`;
  const prevRouteSyncKey = useRef("");

  const toggleGroup = (label: string) =>
    setExpandedGroups((prev) => {
      const willOpen = !prev[label];
      if (!willOpen) return { ...prev, [label]: false };
      return { [label]: true };
    });

  const bestMatch = useMemo(
    () => findBestNavMatch(navItems, activeRoute, search),
    [navItems, activeRoute, search],
  );

  useEffect(() => {
    if (prevRouteSyncKey.current === routeSyncKey) return;
    prevRouteSyncKey.current = routeSyncKey;
    if (!bestMatch) {
      setExpandedGroups({});
      return;
    }
    if (bestMatch.isChild) {
      const parent = navItems.find((item) =>
        item.children?.some((child) => child.href === bestMatch.href),
      );
      setExpandedGroups(parent ? { [parent.label]: true } : {});
      return;
    }
    const parent = navItems.find((item) => item.href === bestMatch.href);
    if (parent?.children?.length) {
      setExpandedGroups({ [parent.label]: true });
      return;
    }
    setExpandedGroups({});
  }, [routeSyncKey, bestMatch, navItems]);

  const isActive = (item: KimiNavItem) =>
    bestMatch?.isChild === false && bestMatch.href === item.href;

  const creditsPct = Math.min(
    100,
    Math.round((credits.remaining / Math.max(credits.total, 1)) * 100),
  );

  return (
    <aside
      className={cn(
        "transovo-sidebar flex h-screen flex-col border-r border-border bg-card",
        appointmentsOverviewShell && "transovo-sidebar-soft-slate",
        mctbBrandMark && "mctb-sidebar-shell",
      )}
      style={{
        width: collapsed ? 56 : expandedWidthPx,
        ...(appointmentsOverviewShell && !collapsed
          ? { backgroundColor: "#eef0f2", borderColor: "#dde1e5" }
          : {}),
      }}
    >
      <Logo
        collapsed={collapsed}
        homeHref={homeHref}
        neutralMark={appointmentsOverviewShell && !mctbBrandMark}
        mctbBrandMark={mctbBrandMark}
      />

      {productSwitcher ? (
        <div className={collapsed ? "px-1" : "px-0"}>{productSwitcher}</div>
      ) : null}

      <nav
        className={`transovo-scroll flex-1 overflow-y-auto py-2 ${
          collapsed ? "px-2 flex flex-col items-center gap-0.5" : "px-2 space-y-0.5"
        }`}
      >
        {navItems.map((item) => {
          const active = isActive(item);
          if (collapsed) {
            return (
              <CollapsedNavButton
                key={item.label}
                item={item}
                active={active}
                appointmentsOverviewShell={appointmentsOverviewShell}
                mctbBrandMark={mctbBrandMark}
              />
            );
          }
          const expanded = expandedGroups[item.label] === true;
          // Expandable parents are never the active row — only a leaf child highlights.
          const rowActive = item.children?.length ? false : active;
          return (
            <div key={item.label}>
              {item.sectionLabel ? (
                <p
                  className={
                    mctbBrandMark
                      ? "mctb-sidebar-section-label"
                      : "px-2 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  }
                >
                  {item.sectionLabel}
                </p>
              ) : null}
              {item.areaLabel ? (
                <p
                  className={`px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground ${
                    item.sectionLabel ? "" : "pt-3"
                  }`}
                >
                  {item.areaLabel}
                </p>
              ) : null}
              <ExpandedNavRow
                item={item}
                active={rowActive}
                expanded={expanded}
                onToggleExpand={() => toggleGroup(item.label)}
                appointmentsOverviewShell={appointmentsOverviewShell}
                mctbBrandMark={mctbBrandMark}
              />
              {item.children && expanded && (
                <div className="ml-[26px] mt-0.5 space-y-0.5 border-l border-border pl-2">
                  {item.children.map((child) => (
                    <Link
                      key={child.label}
                      href={child.href}
                      data-active={isChildNavActive(child.href, bestMatch) ? "true" : undefined}
                      className="transovo-nav-item flex w-full items-center rounded-md px-2 py-[6px] text-[13px] text-muted-foreground hover:text-foreground"
                      style={overviewNavRowStyle(
                        isChildNavActive(child.href, bestMatch),
                        appointmentsOverviewShell,
                        mctbBrandMark,
                      )}
                    >
                      <span className="whitespace-nowrap">{child.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div
        className={`shrink-0 border-t border-border ${
          collapsed ? "flex flex-col items-center gap-1 py-3" : "px-2 py-2 space-y-0.5"
        }`}
      >
        {collapsed ? (
          <>
            <span
              title={user.name}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold ${
                mctbBrandMark
                  ? "mctb-sidebar-user-avatar"
                  : appointmentsOverviewShell
                    ? "bg-[#e2e6ea] text-[#1b1e23]"
                    : "bg-indigo-100 text-indigo-700"
              }`}
            >
              {user.initials}
            </span>
            {onToggleCollapse ? (
              <button
                type="button"
                title="Expand sidebar"
                onClick={onToggleCollapse}
                className="transovo-nav-item mt-1 flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              >
                <ChevronsRight className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </button>
            ) : null}
          </>
        ) : (
          <>
            <div
              className={
                mctbBrandMark
                  ? "mctb-sidebar-footer-card"
                  : appointmentsOverviewShell
                    ? "rounded-lg border border-[#dee2e6] bg-white px-2.5 py-2.5"
                    : "rounded-lg border border-border bg-muted/40 px-3 py-2.5"
              }
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-foreground">{credits.label}</span>
                <Link
                  href={upgradeHref}
                  className={
                    mctbBrandMark
                      ? "mctb-sidebar-upgrade-link"
                      : appointmentsOverviewShell
                        ? "text-[11px] font-medium text-[#1b1e23] hover:underline"
                        : "text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
                  }
                >
                  Upgrade
                </Link>
              </div>
              <div className="transovo-credits-bar mt-1.5 h-1">
                <div className="transovo-credits-fill" style={{ width: `${creditsPct}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground whitespace-nowrap">
                {credits.remaining.toLocaleString()} credits remaining
              </p>
            </div>

            <div className="mt-1 flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-muted/60 cursor-pointer">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  mctbBrandMark
                    ? "mctb-sidebar-user-avatar"
                    : appointmentsOverviewShell
                      ? "bg-[#e2e6ea] text-[#1b1e23]"
                      : "bg-indigo-100 text-indigo-700"
                }`}
              >
                {user.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground leading-tight">
                  {user.name}
                </p>
                <p className="truncate text-[11px] text-muted-foreground leading-tight">
                  {user.plan}
                </p>
              </div>
              {onToggleCollapse ? (
                <button
                  type="button"
                  title="Collapse sidebar"
                  onClick={onToggleCollapse}
                  className="transovo-nav-item flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                >
                  <ChevronsLeft className="h-4 w-4" strokeWidth={1.75} />
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
