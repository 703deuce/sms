"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PhoneCall } from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { initialsForName } from "@/components/kimi/sidebar/map-nav";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import type { Workspace } from "@/lib/types";
import { groupNavItemsBySection } from "./group-nav-items";
import type { ReactNode } from "react";

function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.matchExact) return pathname === item.href;
  if (pathname === item.href) return true;
  if (item.href !== "/" && pathname.startsWith(item.href + "/")) return true;
  return false;
}

export type NewUiAppSidebarProps = {
  navItems: NavItem[];
  homeHref: string;
  workspaceName: string;
  workspaces?: Workspace[];
  workspaceId?: string;
  userName: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  productSwitcher?: ReactNode;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function NewUiAppSidebar({
  navItems,
  homeHref,
  workspaceName,
  workspaces = [],
  workspaceId,
  userName,
  collapsed = false,
  productSwitcher,
  mobileOpen = false,
  onMobileClose,
}: NewUiAppSidebarProps) {
  const pathname = usePathname();
  const sections = groupNavItemsBySection(navItems);
  const initials = initialsForName(userName || workspaceName);

  const aside = (
    <aside
      className={cn(
        "newui-shell-sidebar flex h-dvh flex-col border-r",
        collapsed ? "w-14" : "w-[16rem]",
      )}
      aria-label="Primary"
    >
      <div className="flex flex-col gap-3 px-3 pt-4">
        <Link href={homeHref} className="flex items-center gap-2.5 px-1">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]"
          >
            <PhoneCall className="size-4" aria-hidden="true" />
          </span>
          {!collapsed ? (
            <span className="text-[15px] font-semibold tracking-tight text-[var(--sidebar-accent-foreground)]">
              Transovo
            </span>
          ) : null}
        </Link>

        {!collapsed && workspaces.length > 0 && workspaceId ? (
          <div className="newui-workspace-switcher rounded-lg border border-[var(--sidebar-border)] bg-[var(--sidebar-accent)]/40 p-1">
            <WorkspaceSwitcher
              workspaceId={workspaceId}
              workspaceName={workspaceName}
              workspaces={workspaces}
              className="w-full [&_button]:w-full [&_button]:text-[var(--sidebar-accent-foreground)] [&_button]:hover:bg-[var(--sidebar-accent)]"
            />
          </div>
        ) : !collapsed ? (
          <div className="flex w-full items-center gap-2 rounded-lg border border-[var(--sidebar-border)] bg-[var(--sidebar-accent)]/50 px-2.5 py-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-[var(--sidebar-border)] text-[11px] font-semibold">
              {initials.slice(0, 2)}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium">{workspaceName}</span>
          </div>
        ) : null}

        {productSwitcher && !collapsed ? <div className="px-0.5">{productSwitcher}</div> : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {sections.map((section) => (
          <div key={section.label} className="mb-4 last:mb-0">
            {!collapsed ? (
              <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-[var(--sidebar-muted)]">
                {section.label}
              </p>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isNavItemActive(pathname, item);
                const Icon = item.icon;
                return (
                  <li key={item.href + item.label}>
                    <Link
                      href={item.href}
                      onClick={onMobileClose}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-[var(--sidebar-accent)] font-medium text-[var(--sidebar-accent-foreground)]"
                          : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]/60",
                        collapsed && "justify-center px-2",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className={cn("size-4 shrink-0", active && "text-[var(--sidebar-primary)]")} aria-hidden />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                      {!collapsed && item.badge != null && String(item.badge).length > 0 ? (
                        <span className="ml-auto rounded-full bg-[var(--sidebar-primary)]/15 px-1.5 text-[10px] text-[var(--sidebar-primary)]">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {!collapsed ? (
        <div className="border-t border-[var(--sidebar-border)] px-3 py-3 text-[11px] text-[var(--sidebar-muted)]">
          {userName}
        </div>
      ) : null}
    </aside>
  );

  return (
    <>
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex">{aside}</div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={onMobileClose}
            aria-label="Close menu"
          />
          <div className="absolute inset-y-0 left-0 shadow-2xl">{aside}</div>
        </div>
      ) : null}
    </>
  );
}
