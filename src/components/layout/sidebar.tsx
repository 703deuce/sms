"use client";

import { appNav, flattenNavLinks, isNavGroup } from "@/lib/nav";
import type { NavChild, NavLink } from "@/lib/nav";
import type { Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  CircleHelp,
  CreditCard,
  LogOut,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function isNavHrefActive(pathname: string, search: string, href: string): boolean {
  const [pathPart, queryPart] = href.split("?");
  const have = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  if (queryPart) {
    if (pathname !== pathPart) return false;
    const want = new URLSearchParams(queryPart);
    for (const [key, value] of want) {
      if (have.get(key) !== value) return false;
    }
    return true;
  }

  if (pathname === pathPart) {
    // Bare path links stay inactive when a query sibling (e.g. surveys?type=) is selected.
    if (have.has("type")) return false;
    return true;
  }

  return pathname.startsWith(`${pathPart}/`);
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
  const exactOrQuery = isNavHrefActive(pathname, search, link.href);
  const prefix =
    !link.href.includes("?") &&
    link.href !== sectionHref &&
    pathname.startsWith(`${link.href}/`);
  const active = exactOrQuery || prefix;

  return (
    <Link
      href={link.href}
      onClick={onClose}
      className={cn(
        "block rounded-md px-2.5 py-1 text-[12px] transition",
        active
          ? "bg-white/10 font-medium text-white"
          : "text-sidebar-muted hover:bg-white/5 hover:text-white",
      )}
    >
      {link.label}
    </Link>
  );
}

export function Sidebar({
  workspaceId,
  userName,
  workspaces,
  open,
  onClose,
}: {
  workspaceId: string;
  userName: string;
  workspaces: Workspace[];
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : "";
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === workspaceId) ?? workspaces[0],
    [workspaceId, workspaces],
  );

  // Keep only the section for the current route open (accordion).
  useEffect(() => {
    const match = appNav.find((item) => {
      if (sectionHasActiveChild(item.children, pathname, search)) return true;
      if (pathname === item.href) return true;
      if (
        item.href !== "/dashboard" &&
        !item.children &&
        pathname.startsWith(`${item.href}/`)
      ) {
        return true;
      }
      return pathname.startsWith(`${item.href}/`) && Boolean(item.children);
    });
    setExpanded(match?.label ?? null);
  }, [pathname, search]);

  async function switchWorkspace(id: string) {
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: id }),
    });
    router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const content = (
    <aside className="flex h-dvh w-[260px] flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
      {/* Brand + workspace — fixed top */}
      <div className="shrink-0 px-3.5 pb-2.5 pt-3.5">
        <Link href="/dashboard" className="flex items-start gap-2.5" onClick={onClose}>
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-white shadow-[0_8px_18px_rgba(16,185,129,0.35)]">
            <MessageSquare className="h-3.5 w-3.5" fill="currentColor" />
          </span>
          <span>
            <span className="block text-[14px] font-bold tracking-tight text-white">
              Transovo SMS
            </span>
            <span className="mt-0.5 block text-[10px] leading-tight text-sidebar-muted">
              Business texting platform
            </span>
          </span>
        </Link>

        <label className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted">
          Workspace
        </label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md bg-violet-500 text-[10px] font-bold text-white">
            {activeWorkspace?.name?.slice(0, 1).toUpperCase() ?? "W"}
          </span>
          <select
            className="h-9 w-full appearance-none rounded-[10px] border border-white/10 bg-white/5 py-1.5 pl-9 pr-8 text-[12px] font-medium text-white outline-none focus:border-primary/40"
            value={activeWorkspace?.id ?? workspaceId}
            onChange={(e) => switchWorkspace(e.target.value)}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id} className="text-foreground">
                {w.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-muted" />
        </div>
      </div>

      {/* Nav — only this region scrolls, and only when needed */}
      <nav className="sidebar-nav min-h-0 flex-1 space-y-px overflow-y-auto overscroll-contain px-2 pb-1.5">
        {appNav.map((item) => {
          const Icon = item.icon;
          const childActive = sectionHasActiveChild(item.children, pathname, search);
          const active =
            isNavHrefActive(pathname, search, item.href) ||
            Boolean(childActive) ||
            (item.href !== "/dashboard" &&
              pathname.startsWith(`${item.href}/`) &&
              !item.children);
          const isOpen = expanded === item.label;

          return (
            <div key={item.label}>
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
                  onClick={onClose}
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
                                key={link.href}
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
                        key={child.href}
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
      </nav>

      {/* Footer — pinned bottom, never scrolls away */}
      <div className="shrink-0 space-y-px border-t border-white/10 p-2.5">
        <Link
          href="/getting-started"
          onClick={onClose}
          className="flex items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[12px] text-sidebar-muted hover:bg-white/5 hover:text-white"
        >
          <CircleHelp className="h-3.5 w-3.5" />
          Help & getting started
        </Link>
        <Link
          href="/settings/billing"
          onClick={onClose}
          className="flex items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[12px] text-sidebar-muted hover:bg-white/5 hover:text-white"
        >
          <CreditCard className="h-3.5 w-3.5" />
          Billing / usage
        </Link>
        <div className="mt-1 flex items-center gap-2 rounded-[12px] bg-white/[0.04] px-2 py-1.5">
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
