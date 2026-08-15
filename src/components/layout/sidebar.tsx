"use client";

import { flattenNavLinks, isNavGroup } from "@/lib/nav";
import type { NavChild, NavItem, NavLink } from "@/lib/nav";
import {
  buildProductNav,
  isReceptionistSectionPath,
  isSmartRoutingSectionPathExport,
  type SolutionNavInstance,
} from "@/lib/solutions-nav";
import { smartRoutingFlowIdFromPath } from "@/lib/smart-routing/display";
import { buildRealtorNav } from "@/lib/realtor/nav";
import { buildPersonalNav } from "@/lib/workspace/personal-nav";
import { voiceAgentIdFromPath } from "@/lib/voice/shell-nav";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronLeft, LogOut, MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
      item.href === "/voice/receptionist" &&
      isReceptionistSectionPath(pathname)
    ) {
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

function PlanBalanceCard({ creditsRemaining }: { creditsRemaining?: number }) {
  // Wallet credits (header) are separate from plan balance in the mockup sidebar widget.
  const used =
    typeof creditsRemaining === "number" && creditsRemaining <= PLAN_BALANCE_LIMIT
      ? PLAN_BALANCE_LIMIT - creditsRemaining
      : 90;
  const pct = Math.min(100, Math.round((used / PLAN_BALANCE_LIMIT) * 100));

  return (
    <div className="mx-1 rounded-xl border border-[#e6e8ef] bg-[#f8f9fc] p-3">
      <div className="flex items-center justify-between text-[11px] font-semibold text-[#374151]">
        <span>Plan Balance</span>
        <span className="text-[#6b7280]">{used}/{PLAN_BALANCE_LIMIT}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e6e8ef]">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <Link
        href="/settings/billing"
        className="mt-2 inline-block text-[11px] font-semibold text-primary hover:text-primary-hover"
      >
        Upgrade Plan
      </Link>
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
  personalMode = false,
  inboxBadge = 0,
  collapsed = false,
  onToggleCollapse,
  creditsRemaining,
}: {
  userName: string;
  workspaceName?: string;
  open?: boolean;
  onClose?: () => void;
  outcomeInstances?: Record<string, SolutionNavInstance[]>;
  primaryVoiceAgentId?: string | null;
  realtorMode?: boolean;
  personalMode?: boolean;
  inboxBadge?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  creditsRemaining?: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : "";
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  const navItems: NavItem[] = useMemo(() => {
    if (realtorMode) return buildRealtorNav(inboxBadge);
    if (personalMode) return buildPersonalNav();
    const pathAgentId = voiceAgentIdFromPath(pathname);
    const agentId = pathAgentId ?? primaryVoiceAgentId ?? null;
    const smartRoutingFlowId =
      smartRoutingFlowIdFromPath(pathname) ?? null;
    return buildProductNav({
      primaryVoiceAgentId: agentId,
      primarySmartRoutingFlowId: smartRoutingFlowId,
      inboxBadge,
    });
  }, [primaryVoiceAgentId, pathname, realtorMode, personalMode, inboxBadge]);

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

  const content = (
    <aside
      className={cn(
        "flex h-dvh flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      <div className="shrink-0 px-3.5 pb-2.5 pt-3.5">
        <Link
          href={
            realtorMode
              ? "/realtor/dashboard"
              : personalMode
                ? "/personal"
                : "/outcomes"
          }
          className="flex items-start gap-2.5"
          onClick={onClose}
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#6366f1] text-white shadow-[0_8px_18px_rgba(99,102,241,0.35)]">
            <MessageSquare className="h-3.5 w-3.5" fill="currentColor" />
          </span>
          {!collapsed ? (
            <span>
              <span className="block text-[14px] font-bold tracking-[0.04em] text-[#111827]">
                {realtorMode ? "TRANSOVO" : "TransOvo"}
              </span>
              {!realtorMode ? (
                <span className="mt-0.5 block text-[10px] leading-tight text-sidebar-muted">
                  {personalMode ? "Your phone numbers" : "AI receptionist + SMS"}
                </span>
              ) : null}
            </span>
          ) : null}
        </Link>
      </div>

      <nav className="sidebar-nav min-h-0 flex-1 space-y-px overflow-y-auto overscroll-contain px-2 pb-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const childActive = sectionHasActiveChild(item.children, pathname, search);
          const receptionistOwned =
            item.label === "AI Receptionist" && isReceptionistSectionPath(pathname);
          const callsOwned =
            item.label === "Calls" &&
            (pathname === "/voice/calls" || pathname.startsWith("/voice/calls/"));
          const smsOwned =
            item.label === "SMS" &&
            (pathname === "/inbox" ||
              pathname.startsWith("/inbox/") ||
              pathname.startsWith("/send") ||
              pathname.startsWith("/campaigns") ||
              pathname.startsWith("/templates"));
          const smartRoutingOwned =
            item.label === "Smart Routing" && isSmartRoutingSectionPathExport(pathname);
          const ownedOutcome =
            receptionistOwned ||
            callsOwned ||
            smsOwned ||
            smartRoutingOwned ||
            pathname.startsWith(`${hrefPath(item.href)}/`) ||
            pathname === hrefPath(item.href);
          const expandKey = itemExpandKey(item);
          const itemHrefActive = isNavHrefActive(pathname, search, item.href);
          const active =
            itemHrefActive ||
            Boolean(childActive) ||
            (item.href !== "/dashboard" &&
              item.href !== "/outcomes" &&
              ownedOutcome &&
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
              {item.sectionLabel ? (
                <p className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted">
                  {item.sectionLabel}
                </p>
              ) : null}
              {item.areaLabel ? (
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
                  "group relative flex items-center rounded-[10px] transition",
                  active
                    ? item.label === "Calls" || realtorMode
                      ? "bg-[#6366f1] text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)]"
                      : "bg-primary/10 text-primary"
                    : "text-sidebar-foreground hover:bg-[#f3f4f6]",
                )}
              >
                {active && !realtorMode && item.label !== "Calls" ? (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary" />
                ) : null}
                <Link
                  href={item.href}
                  onClick={() => {
                    if (item.children?.length) setExpanded(expandKey);
                    onClose?.();
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2.5 py-[7px] pl-3 pr-1 text-[13px] font-medium"
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active
                        ? item.label === "Calls" || realtorMode
                          ? "text-white"
                          : "text-primary"
                        : "text-sidebar-muted group-hover:text-sidebar-foreground",
                    )}
                  />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                  {!collapsed && item.badge != null ? (
                    <span
                      className={cn(
                        "ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                        active && realtorMode
                          ? "bg-white text-[#6366f1]"
                          : "bg-danger text-white",
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
                {item.children ? (
                  <button
                    type="button"
                    className={cn(
                      "mr-1.5 rounded-md p-1.5 transition",
                      active
                        ? item.label === "Calls" || realtorMode
                          ? "text-white hover:bg-white/15"
                          : "text-primary hover:bg-primary/10"
                        : "text-sidebar-muted hover:bg-[#f3f4f6] hover:text-sidebar-foreground",
                    )}
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

              {item.children && isOpen ? (
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

        {!collapsed && !realtorMode ? (
          <div className="mt-3 px-1">
            <PlanBalanceCard creditsRemaining={creditsRemaining} />
          </div>
        ) : null}

        <div className="mt-3 border-t border-[#e6e8ef] px-1 pb-3 pt-3">
          <div className="flex items-center gap-2 rounded-[12px] bg-[#f8f9fc] px-2 py-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/avatars/alex.svg"
              alt={userName}
              className="h-7 w-7 shrink-0 rounded-full object-cover ring-2 ring-[#e6e8ef]"
            />
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-[#111827]">{userName}</p>
                <p className="truncate text-[10px] text-sidebar-muted">
                  {realtorMode && workspaceName ? workspaceName : "Owner"}
                </p>
              </div>
            ) : null}
            {!collapsed && !realtorMode ? (
              <button
                type="button"
                onClick={logout}
                className="rounded-md p-1.5 text-sidebar-muted hover:bg-[#eef0f5] hover:text-sidebar-foreground"
                aria-label="Log out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            ) : !collapsed ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-sidebar-muted" aria-hidden />
            ) : null}
          </div>
          {realtorMode && onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={cn(
                "mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[12px] font-medium text-sidebar-muted hover:bg-[#f3f4f6] hover:text-sidebar-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              <ChevronLeft className={cn("h-4 w-4", collapsed && "rotate-180")} />
              {!collapsed ? "Collapse" : null}
            </button>
          ) : null}
        </div>
      </nav>
    </aside>
  );

  return (
    <>
      <div
        className={cn(
          "hidden lg:fixed lg:inset-y-0 lg:z-30 lg:flex",
          collapsed ? "lg:w-[72px]" : "lg:w-[260px]",
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
