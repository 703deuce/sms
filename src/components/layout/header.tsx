"use client";

import { metrics, phoneNumbers } from "@/lib/mock/data";
import { formatNumber, formatPhone } from "@/lib/utils";
import {
  Bell,
  CircleHelp,
  Coins,
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
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

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

        <h1 className="shrink-0 text-[18px] font-bold tracking-tight text-foreground">
          {title}
        </h1>

        <div className="mx-auto hidden w-full max-w-[440px] flex-1 md:block">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-full border border-border bg-[#f7f8fb] pl-10 pr-4 text-[13px] outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-ring/20"
              placeholder="Search contacts, campaigns, messages..."
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <select
            className="hidden h-9 max-w-[170px] rounded-full border border-border bg-card px-3 text-[12px] font-medium outline-none focus:border-primary sm:block"
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
            className="hidden h-9 items-center gap-1.5 rounded-full bg-emerald-50 px-3 text-[12px] font-semibold text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100 sm:inline-flex"
          >
            <Coins className="h-3.5 w-3.5" />
            {formatNumber(metrics.creditsRemaining)} credits
          </Link>

          <button
            type="button"
            className="relative rounded-full p-2.5 text-foreground hover:bg-muted"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger ring-2 ring-white" />
          </button>

          <Link
            href="/getting-started"
            className="rounded-full p-2.5 text-foreground hover:bg-muted"
            aria-label="Help"
          >
            <CircleHelp className="h-[18px] w-[18px]" />
          </Link>

          <Link
            href="/settings/users"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-sky-500 text-[11px] font-bold text-white"
            title={userName}
          >
            {initials}
          </Link>
        </div>
      </div>
    </header>
  );
}
