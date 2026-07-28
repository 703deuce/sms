"use client";

import { phoneNumbers, metrics } from "@/lib/mock/data";
import { formatNumber, formatPhone } from "@/lib/utils";
import {
  Bell,
  CircleHelp,
  Menu,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function Header({
  title,
  userName,
  onMenuClick,
}: {
  title: string;
  userName: string;
  onMenuClick: () => void;
}) {
  const [numberId, setNumberId] = useState(phoneNumbers[0]?.id);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-header/95 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
        <button
          type="button"
          className="rounded-lg p-2 text-foreground hover:bg-muted lg:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-semibold tracking-tight">
            {title}
          </h1>
        </div>

        <div className="hidden max-w-xs flex-1 md:block lg:max-w-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              placeholder="Search contacts, campaigns..."
            />
          </div>
        </div>

        <select
          className="hidden h-10 max-w-[180px] rounded-lg border border-border bg-card px-2 text-xs font-medium outline-none focus:border-primary sm:block"
          value={numberId}
          onChange={(e) => setNumberId(e.target.value)}
          aria-label="Sending number"
        >
          {phoneNumbers.map((n) => (
            <option key={n.id} value={n.id}>
              {formatPhone(n.number)}
            </option>
          ))}
        </select>

        <Link
          href="/settings/billing"
          className="hidden rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted sm:inline-flex"
        >
          {formatNumber(metrics.creditsRemaining)} credits
        </Link>

        <button
          type="button"
          className="relative rounded-lg p-2 text-foreground hover:bg-muted"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-teal-500" />
        </button>

        <Link
          href="/getting-started"
          className="rounded-lg p-2 text-foreground hover:bg-muted"
          aria-label="Help"
        >
          <CircleHelp className="h-5 w-5" />
        </Link>

        <Link
          href="/settings/users"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
          title={userName}
        >
          {userName
            .split(" ")
            .map((p) => p[0])
            .join("")
            .slice(0, 2)}
        </Link>
      </div>
    </header>
  );
}
