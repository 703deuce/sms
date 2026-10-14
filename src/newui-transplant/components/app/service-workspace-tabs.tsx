"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ServiceTab } from "@/lib/products/business-messaging-nav";
import { hrefPath, scoreNavHref } from "@/lib/nav-active";
import { cn } from "@/lib/utils";

function tabActive(pathname: string, search: string, tab: ServiceTab, allTabs: ServiceTab[]): boolean {
  const prefix = tab.matchPrefix ?? hrefPath(tab.href);
  if (tab.matchExact) {
    return scoreNavHref(pathname, search, tab.href, true) >= 0;
  }
  const pathScore = scoreNavHref(pathname, search, tab.href);
  if (pathScore >= 0) return true;
  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
    if (tab.href.includes("?")) return pathScore >= 0;
    const longer = allTabs.some(
      (other) =>
        other.href !== tab.href &&
        !other.matchExact &&
        (pathname === hrefPath(other.matchPrefix ?? other.href) ||
          pathname.startsWith(`${hrefPath(other.matchPrefix ?? other.href)}/`)) &&
        hrefPath(other.matchPrefix ?? other.href).length > prefix.length,
    );
    if (longer) return false;
    return true;
  }
  return false;
}

export function ServiceWorkspaceTabs({
  title,
  description,
  tabs,
  actions,
  className,
  compact,
}: {
  title: string;
  description?: string;
  tabs: ServiceTab[];
  actions?: React.ReactNode;
  className?: string;
  /** Tabs only — no service title row (e.g. MCTB Activity reuse overview header). */
  compact?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString() ? `?${searchParams.toString()}` : "";

  return (
    <div className={cn("border-b bg-gradient-to-b from-card to-muted/20", className)}>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 md:px-6">
        {!compact ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">{title}</h1>
              {description ? (
                <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        ) : actions ? (
          <div className="flex justify-end">{actions}</div>
        ) : null}
        <nav aria-label={`${title} sections`} className="-mb-px overflow-x-auto">
          <ul className="flex min-w-0 gap-1 pb-px">
            {tabs.map((tab) => {
              const active = tabActive(pathname, search, tab, tabs);
              return (
                <li key={tab.href} className="shrink-0">
                  <Link
                    href={tab.href}
                    className={cn(
                      "inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
