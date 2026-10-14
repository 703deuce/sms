"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { INBOX_TAB_ROUTES } from "@/lib/products/business-messaging-nav";
import { isBusinessMessagingUnifiedNav } from "@/lib/workspace/platform-launch";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Conversations", href: INBOX_TAB_ROUTES.conversations },
  { label: "Missed Calls", href: INBOX_TAB_ROUTES.missedCalls },
  { label: "Voicemail", href: INBOX_TAB_ROUTES.voicemail },
  { label: "Held Replies", href: INBOX_TAB_ROUTES.heldReplies },
] as const;

function inboxTabActive(pathname: string, search: string, href: string): boolean {
  const path = href.split("?")[0];
  if (href.includes("view=held")) {
    return (
      (pathname === path || pathname.startsWith(`${path}/`)) && search.includes("view=held")
    );
  }
  if (pathname === path || pathname.startsWith(`${path}/`)) {
    if (path.includes("responses") && search.includes("view=held")) return false;
    return true;
  }
  if (href === INBOX_TAB_ROUTES.conversations) {
    return pathname === "/inbox" || pathname.startsWith("/inbox/");
  }
  return false;
}

export function InboxWorkspaceTabs({ className }: { className?: string }) {
  if (!isBusinessMessagingUnifiedNav()) return null;

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString() ? `?${searchParams.toString()}` : "";

  return (
    <div className={cn("border-b bg-muted/20", className)}>
      <div className="mx-auto max-w-[1600px] px-4 py-2 md:px-6">
        <nav aria-label="Inbox views">
          <ul className="flex flex-wrap gap-1">
            {TABS.map((tab) => {
              const active = inboxTabActive(pathname, search, tab.href);
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    className={cn(
                      "inline-flex h-8 items-center rounded-md px-2.5 text-sm font-medium",
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
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
