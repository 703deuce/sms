"use client";

import { appNav, flattenNavLinks, isNavGroup } from "@/lib/nav";
import type { NavChild, NavItem, NavLink } from "@/lib/nav";
import type { NavView } from "@/lib/nav-view";
import {
  buildSolutionsNav,
  type SolutionNavInstance,
} from "@/lib/solutions-nav";
import { cn } from "@/lib/utils";
import { ChevronDown, LogOut, MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

function hrefPath(href: string) {
  return href.split("?")[0] || href;
}

function isNavHrefActive(pathname: string, search: string, href: string): boolean {
  const pathPart = hrefPath(href);
  const queryPart = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
  const have = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  if (queryPart) {
    // Path must match; query params are optional context (e.g. agentId).
    if (pathname !== pathPart && !pathname.startsWith(`${pathPart}/`)) {
      return false;
    }
    if (pathname === pathPart || pathname.startsWith(`${pathPart}/`)) {
      const want = new URLSearchParams(queryPart);
      // If the URL includes the link's query keys, require them to match.
      // If not, still treat the path as active so the menu stays oriented.
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
    return true;
  }

  return pathname.startsWith(`${pathPart}/`);
}

/** Higher score = better owner of the current route for accordion expansion. */
function linkMatchScore(pathname: string, search: string, href: string): number {
  if (!isNavHrefActive(pathname, search, href)) return -1;
  const pathPart = hrefPath(href);
  if (pathname === pathPart) return 20_000 + pathPart.length;
  if (pathname.startsWith(`${pathPart}/`)) return 10_000 + pathPart.length;
  return pathPart.length;
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

function bestExpandedLabel(
  navItems: NavItem[],
  pathname: string,
  search: string,
): string | null {
  // Solutions routes always keep their owning solution open.
  const outcomesSlug = pathname.match(/^\/outcomes\/([^/]+)/)?.[1];
  if (outcomesSlug) {
    const owned = navItems.find((item) => hrefPath(item.href) === `/outcomes/${outcomesSlug}`);
    if (owned?.children?.length) return owned.label;
  }

  let bestLabel: string | null = null;
  let bestScore = -1;

  for (const item of navItems) {
    let score = -1;

    for (const link of flattenNavLinks(item.children)) {
      score = Math.max(score, linkMatchScore(pathname, search, link.href));
    }

    if (pathname === hrefPath(item.href)) {
      score = Math.max(score, 5_000 + hrefPath(item.href).length);
    } else if (
      item.href !== "/dashboard" &&
      item.href !== "/outcomes" &&
      pathname.startsWith(`${hrefPath(item.href)}/`)
    ) {
      // Prefer items with children (solution sections) over leaf Shared links
      // when both could claim a prefix match.
      const base = hrefPath(item.href).length + (item.children?.length ? 2_000 : 0);
      score = Math.max(score, base);
    }

    // Prefer solution sections over Advanced when scores tie (e.g. /voice/agents/:id).
    if (score > bestScore || (score === bestScore && item.children?.length && score >= 0)) {
      if (score > bestScore) {
        bestScore = score;
        bestLabel = item.label;
      }
    }
  }

  return bestScore >= 0 ? bestLabel : null;
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
    pathPart !== sectionPath && pathname.startsWith(`${pathPart}/`);
  // Exact page the user is on (not a parent overview covering a deeper child path).
  const isCurrentPage = pathname === pathPart && matched;
  const active = isCurrentPage || (prefix && matched);

  return (
    <Link
      href={link.href}
      onClick={onClose}
      data-nav-active={isCurrentPage ? "true" : undefined}
      className={cn(
        "block rounded-md px-2.5 py-1 text-[12px] transition",
        isCurrentPage
          ? "bg-white/15 font-semibold text-white"
          : active || matched
            ? "bg-white/10 font-medium text-white"
            : "text-sidebar-muted hover:bg-white/5 hover:text-white",
      )}
    >
      {link.label}
    </Link>
  );
}

function ViewToggle({
  view,
  onChange,
  pending,
}: {
  view: NavView;
  onChange: (view: NavView) => void;
  pending: boolean;
}) {
  return (
    <div className="mt-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted">
        Navigation
      </p>
      <div
        className={cn(
          "mt-1 grid grid-cols-2 rounded-[10px] border border-white/10 bg-white/5 p-0.5",
          pending && "opacity-70",
        )}
        role="tablist"
        aria-label="Navigation view"
      >
        {(
          [
            { id: "solutions", label: "Solutions" },
            { id: "platform", label: "Platform" },
          ] as const
        ).map((option) => {
          const active = view === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={pending}
              onClick={() => onChange(option.id)}
              className={cn(
                "rounded-[8px] px-2 py-1.5 text-[12px] font-semibold transition",
                active
                  ? "bg-primary text-white shadow-sm"
                  : "text-sidebar-muted hover:text-white",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Sidebar({
  userName,
  open,
  onClose,
  initialNavView = "solutions",
  outcomeInstances = {},
}: {
  userName: string;
  open?: boolean;
  onClose?: () => void;
  initialNavView?: NavView;
  outcomeInstances?: Record<string, SolutionNavInstance[]>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : "";
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [navView, setNavView] = useState<NavView>(initialNavView);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setNavView(initialNavView);
  }, [initialNavView]);

  const navItems: NavItem[] = useMemo(() => {
    if (navView === "platform") return appNav;
    return buildSolutionsNav({ instancesBySolution: outcomeInstances });
  }, [navView, outcomeInstances]);

  // Keep the section that owns the current route open (and prefer Solutions over Advanced).
  useEffect(() => {
    setExpanded(bestExpandedLabel(navItems, pathname, search));
  }, [pathname, search, navItems]);

  // Scroll the active child into view inside the sidebar.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('[data-nav-active="true"]');
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname, search, expanded, navView]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function switchNavView(next: NavView) {
    if (next === navView) return;
    setNavView(next);
    startTransition(async () => {
      await fetch("/api/nav-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ view: next }),
      });
      if (next === "solutions" && !pathname.startsWith("/outcomes")) {
        router.push("/outcomes");
      } else if (next === "platform" && pathname.startsWith("/outcomes")) {
        router.push("/dashboard");
      } else {
        router.refresh();
      }
    });
  }

  const content = (
    <aside className="flex h-dvh w-[260px] flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
      {/* Brand + view toggle — fixed top */}
      <div className="shrink-0 px-3.5 pb-2.5 pt-3.5">
        <Link
          href={navView === "solutions" ? "/outcomes" : "/dashboard"}
          className="flex items-start gap-2.5"
          onClick={onClose}
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-white shadow-[0_8px_18px_rgba(16,185,129,0.35)]">
            <MessageSquare className="h-3.5 w-3.5" fill="currentColor" />
          </span>
          <span>
            <span className="block text-[14px] font-bold tracking-tight text-white">
              Transovo SMS
            </span>
            <span className="mt-0.5 block text-[10px] leading-tight text-sidebar-muted">
              {navView === "solutions"
                ? "Business outcomes"
                : "Business texting platform"}
            </span>
          </span>
        </Link>

        <ViewToggle view={navView} onChange={switchNavView} pending={pending} />
      </div>

      {/* Nav — only this region scrolls, and only when needed */}
      <nav className="sidebar-nav min-h-0 flex-1 space-y-px overflow-y-auto overscroll-contain px-2 pb-1.5">
        {navView === "platform" ? (
          <div className="mb-1.5 px-1">
            <Link
              href="/send"
              onClick={onClose}
              className="flex items-center justify-center gap-2 rounded-[10px] bg-primary px-3 py-2 text-[12px] font-semibold text-white shadow-[0_8px_18px_rgba(16,185,129,0.25)] transition hover:bg-primary/90"
            >
              Send Campaign
            </Link>
          </div>
        ) : null}

        {navItems.map((item) => {
          const Icon = item.icon;
          const childActive = sectionHasActiveChild(item.children, pathname, search);
          const ownedOutcome =
            pathname.startsWith(`${hrefPath(item.href)}/`) ||
            pathname === hrefPath(item.href);
          const active =
            isNavHrefActive(pathname, search, item.href) ||
            Boolean(childActive) ||
            (item.href !== "/dashboard" &&
              item.href !== "/outcomes" &&
              ownedOutcome);
          const isOpen = expanded === item.label;

          return (
            <div key={`${navView}-${item.label}`}>
              {item.sectionLabel ? (
                <p className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted/80">
                  {item.sectionLabel}
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
                    if (item.children?.length) setExpanded(item.label);
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
                        current === item.label ? null : item.label,
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

        {/* Account sits at the end of the scrollable nav — not a pinned footer. */}
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
