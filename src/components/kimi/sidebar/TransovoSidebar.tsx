"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
} from "lucide-react";
import type { KimiCredits, KimiNavItem, KimiSidebarUser } from "./types";
import { isAppointmentsNavItemActive } from "@/lib/products/appointments-routes";

function hasPositiveBadge(badge: string | number | undefined): boolean {
  if (badge == null) return false;
  if (typeof badge === "number") return badge > 0;
  return badge.trim().length > 0;
}

/** Kimi sessions 2026-08-30T22-24-04-122Z-b95821 (initial), 2026-09-06T18-36-09-917Z-daeeac (Stage D refresh) — production wiring only. */
export interface TransovoSidebarProps {
  navItems: KimiNavItem[];
  activeRoute?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  credits: KimiCredits;
  user: KimiSidebarUser;
  upgradeHref?: string;
  homeHref?: string;
}

function Logo({ collapsed, homeHref }: { collapsed: boolean; homeHref: string }) {
  return (
    <div
      className={`flex items-center gap-2 h-14 border-b border-border shrink-0 ${
        collapsed ? "justify-center px-0" : "px-4"
      }`}
    >
      <Link href={homeHref} className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white shrink-0">
          <Sparkles className="h-4 w-4" />
        </span>
        {!collapsed && (
          <span className="text-[15px] font-semibold tracking-tight text-foreground whitespace-nowrap">
            Transovo
          </span>
        )}
      </Link>
    </div>
  );
}

function ExpandedNavRow({
  item,
  active,
  expanded,
  onToggleExpand,
}: {
  item: KimiNavItem;
  active: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const Icon = item.icon;
  const hasChildren = !!item.children?.length;
  const className =
    "transovo-nav-item flex w-full items-center gap-2.5 rounded-md px-3 py-[7px] text-[13px] text-muted-foreground hover:text-foreground";

  if (hasChildren) {
    return (
      <button
        type="button"
        data-active={active ? "true" : undefined}
        onClick={onToggleExpand}
        className={className}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
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
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      <span className="flex-1 text-left whitespace-nowrap">{item.label}</span>
      {hasPositiveBadge(item.badge) && (
        <span className="transovo-badge">{item.badge}</span>
      )}
    </Link>
  );
}

function CollapsedNavButton({ item, active }: { item: KimiNavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      data-active={active ? "true" : undefined}
      title={item.label}
      className="transovo-nav-item relative flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      {hasPositiveBadge(item.badge) && (
        <span className="transovo-badge-dot">{item.badge}</span>
      )}
    </Link>
  );
}

function isChildNavActive(childHref: string, activeRoute: string): boolean {
  const childPath = childHref.split("?")[0];
  const routePath = activeRoute.split("?")[0];
  if (routePath === childPath) return true;
  if (childPath !== "/contacts" && routePath.startsWith(`${childPath}/`)) return true;
  return false;
}

export function TransovoSidebar({
  navItems,
  activeRoute = "/conversations",
  collapsed = false,
  onToggleCollapse,
  credits,
  user,
  upgradeHref = "/settings/billing",
  homeHref = "/dashboard",
}: TransovoSidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (label: string) =>
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  const isActive = (item: KimiNavItem) => {
    if (item.href === "/appointments" || item.href.startsWith("/appointments/")) {
      return isAppointmentsNavItemActive(item.href, activeRoute);
    }
    return (
      activeRoute === item.href ||
      item.children?.some((c) => activeRoute === c.href) ||
      activeRoute.startsWith(`${item.href}/`)
    );
  };

  const creditsPct = Math.min(
    100,
    Math.round((credits.remaining / Math.max(credits.total, 1)) * 100),
  );

  return (
    <aside
      className="transovo-sidebar flex h-screen flex-col border-r border-border bg-card"
      style={{ width: collapsed ? 56 : 224 }}
    >
      <Logo collapsed={collapsed} homeHref={homeHref} />

      <nav
        className={`transovo-scroll flex-1 overflow-y-auto py-2 ${
          collapsed ? "px-2 flex flex-col items-center gap-0.5" : "px-2 space-y-0.5"
        }`}
      >
        {navItems.map((item) => {
          const active = isActive(item);
          if (collapsed) {
            return <CollapsedNavButton key={item.label} item={item} active={active} />;
          }
          const expanded = expandedGroups[item.label] ?? active;
          return (
            <div key={item.label}>
              {item.sectionLabel ? (
                <p className="px-2 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
                active={active}
                expanded={expanded}
                onToggleExpand={() => toggleGroup(item.label)}
              />
              {item.children && expanded && (
                <div className="ml-[26px] mt-0.5 space-y-0.5 border-l border-border pl-2">
                  {item.children.map((child) => (
                    <Link
                      key={child.label}
                      href={child.href}
                      data-active={isChildNavActive(child.href, activeRoute) ? "true" : undefined}
                      className="transovo-nav-item flex w-full items-center rounded-md px-2 py-[6px] text-[13px] text-muted-foreground hover:text-foreground"
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
              className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700"
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
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-foreground">{credits.label}</span>
                <Link
                  href={upgradeHref}
                  className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Upgrade
                </Link>
              </div>
              <div className="transovo-credits-bar mt-2">
                <div className="transovo-credits-fill" style={{ width: `${creditsPct}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground whitespace-nowrap">
                {credits.remaining.toLocaleString()} Credits Remaining
              </p>
            </div>

            <div className="mt-1 flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-muted/60 cursor-pointer">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">
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
