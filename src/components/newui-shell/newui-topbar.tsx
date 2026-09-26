"use client";

import { Bell, HelpCircle, Menu, Search } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { initialsForName } from "@/components/kimi/sidebar/map-nav";

export type NewUiTopbarProps = {
  sectionLabel: string;
  pageLabel: string;
  userName: string;
  unreadNotifications?: number;
  onMenuClick?: () => void;
  showSearch?: boolean;
};

export function NewUiTopbar({
  sectionLabel,
  pageLabel,
  userName,
  unreadNotifications = 0,
  onMenuClick,
  showSearch = true,
}: NewUiTopbarProps) {
  const initials = initialsForName(userName);

  return (
    <header
      className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-6"
    >
      <button
        type="button"
        className="inline-flex size-9 items-center justify-center rounded-md border lg:hidden"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="size-4" />
      </button>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        {sectionLabel ? (
          <span className="hidden truncate text-muted-foreground sm:inline">{sectionLabel}</span>
        ) : null}
        {pageLabel ? (
          <>
            {sectionLabel ? (
              <span className="hidden text-muted-foreground/50 sm:inline" aria-hidden="true">/</span>
            ) : null}
            <span className="truncate font-medium">{pageLabel}</span>
          </>
        ) : null}
      </nav>
      <div className="ml-auto flex items-center gap-1.5">
        {showSearch ? (
          <label className="relative hidden md:block">
            <span className="sr-only">Search</span>
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Search callers, numbers…"
              className="h-8 w-64 rounded-md border bg-card pl-8 pr-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring/40"
              disabled
              aria-disabled="true"
              title="Global search coming soon"
            />
          </label>
        ) : null}
        <Link
          href="/settings"
          className="inline-flex size-9 items-center justify-center rounded-md hover:bg-muted"
          aria-label="Help"
        >
          <HelpCircle className="size-4" />
        </Link>
        <Link
          href="/notifications"
          className="relative inline-flex size-9 items-center justify-center rounded-md hover:bg-muted"
          aria-label={unreadNotifications ? `${unreadNotifications} unread notifications` : "Notifications"}
        >
          <Bell className="size-4" />
          {unreadNotifications > 0 ? (
            <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" aria-hidden="true" />
          ) : null}
        </Link>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold",
          )}
          aria-hidden="true"
        >
          {initials}
        </span>
      </div>
    </header>
  );
}
