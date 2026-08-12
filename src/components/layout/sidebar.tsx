"use client";

import { flattenNavLinks, isNavGroup } from "@/lib/nav";
import type { NavChild, NavItem, NavLink } from "@/lib/nav";
import {
  buildSolutionsNav,
  type SolutionNavInstance,
} from "@/lib/solutions-nav";
import { buildRealtorNav } from "@/lib/realtor/nav";
import { cn } from "@/lib/utils";
import { ChevronDown, LogOut, MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
        "block rounded-md px-2.5 py-1 text-[12px] transition",
        active
          ? "bg-primary/10 font-semibold text-primary"
          : "text-sidebar-muted hover:bg-white/5 hover:text-white",
      )}
    >
      {link.label}
    </Link>
  );
}

export function Sidebar({
  userName,
  open,
  onClose,
  outcomeInstances = {},
  realtorMode = false,
}: {
  userName: string;
  open?: boolean;
  onClose?: () => void;
  outcomeInstances?: Record<string, SolutionNavInstance[]>;
  realtorMode?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : "";
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  const navItems: NavItem[] = useMemo(
    () => (realtorMode ? buildRealtorNav() : buildSolutionsNav({ instancesBySolution: outcomeInstances })),
    [outcomeInstances, realtorMode],
  );

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
    <aside className="flex h-dvh w-[260px] flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
      <div className="shrink-0 px-3.5 pb-2.5 pt-3.5">
        <Link
          href={realtorMode ? "/realtor/dashboard" : "/outcomes"}
          className="flex items-start gap-2.5"
          onClick={onClose}
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-white shadow-[0_8px_18px_rgba(16,185,129,0.35)]">
            <MessageSquare className="h-3.5 w-3.5" fill="currentColor" />
          </span>
          <span>
            <span className="block text-[14px] font-bold tracking-tight text-white">
              {realtorMode ? "Transovo Real Estate" : "Transovo SMS"}
            </span>
            <span className="mt-0.5 block text-[10px] leading-tight text-sidebar-muted">
              {realtorMode ? "Lead → AI works it → you step in" : "Solutions-first workspace"}
            </span>
          </span>
        </Link>
      </div>

      <nav className="sidebar-nav min-h-0 flex-1 space-y-px overflow-y-auto overscroll-contain px-2 pb-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const childActive = sectionHasActiveChild(item.children, pathname, search);
          const ownedOutcome =
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
                <p className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted/80">
                  {item.sectionLabel}
                </p>
              ) : null}
              {item.areaLabel ? (
                <p
                  className={cn(
                    "px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted/80",
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
                    ? "bg-primary/15 text-primary"
                    : "text-sidebar-foreground/90 hover:bg-white/5 hover:text-white",
                )}
              >
                {active ? (
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
                      active ? "text-primary" : "text-sidebar-muted group-hover:text-white",
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                  {item.badge != null ? (
                    <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
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
                        ? "text-primary hover:bg-primary/10"
                        : "text-sidebar-muted hover:bg-white/5 hover:text-white",
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
                <div className="mb-0.5 ml-3.5 mt-0.5 space-y-1 border-l border-white/10 pl-2.5">
                  {item.children.map((child) => {
                    if (isNavGroup(child)) {
                      return (
                        <div key={child.label} className="pt-1">
                          <p className="px-2.5 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted/80">
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

        <div className="mt-3 border-t border-white/10 px-1 pb-3 pt-3">
          <div className="flex items-center gap-2 rounded-[12px] bg-white/[0.04] px-2 py-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/avatars/alex.svg"
              alt={userName}
              className="h-7 w-7 rounded-full object-cover ring-2 ring-white/10"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-white">{userName}</p>
              <p className="text-[10px] text-sidebar-muted">Owner</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-md p-1.5 text-sidebar-muted hover:bg-white/5 hover:text-white"
              aria-label="Log out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </nav>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-30 lg:flex lg:w-[260px]">
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
