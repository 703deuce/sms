"use client";

import type { DashboardMetrics, PhoneNumber } from "@/lib/types";
import { formatNumber, formatPhone } from "@/lib/utils";
import {
  Bell,
  CircleHelp,
  Coins,
  Menu,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type SearchResult = {
  id: string;
  type: "contact" | "campaign" | "conversation";
  title: string;
  subtitle: string;
  href: string;
};

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export function Header({
  title,
  userName,
  phoneNumbers,
  metrics,
  activeFromNumberId,
  unreadNotifications = 0,
  onMenuClick,
}: {
  title: string;
  userName: string;
  phoneNumbers: PhoneNumber[];
  metrics: DashboardMetrics;
  activeFromNumberId?: string | null;
  unreadNotifications?: number;
  onMenuClick: () => void;
}) {
  const router = useRouter();
  const [numberId, setNumberId] = useState(
    activeFromNumberId || phoneNumbers[0]?.id || "",
  );

  // Search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Notifications
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(unreadNotifications);
  const notifRef = useRef<HTMLDivElement>(null);

  // Account menu
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      // Defer the reset to a callback so we don't call setState synchronously in the effect body.
      const clear = setTimeout(() => {
        setResults([]);
        setSearching(false);
      }, 0);
      return () => clearTimeout(clear);
    }
    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((j) => {
          setResults(j.data || []);
          setSearchOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function persistNumber(id: string) {
    setNumberId(id);
    try {
      await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeFromNumberId: id }),
      });
    } catch {
      // best-effort; selection stays in UI
    }
  }

  async function openNotifications() {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) {
      try {
        const res = await fetch("/api/notifications?limit=15");
        const json = await res.json();
        setNotifications(json.data || []);
        setUnread(json.unread ?? 0);
      } catch {
        // ignore
      }
    }
  }

  async function markAllRead() {
    setUnread(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      // ignore
    }
  }

  async function openNotification(n: NotificationItem) {
    setNotifOpen(false);
    if (!n.readAt) {
      setUnread((u) => Math.max(0, u - 1));
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      }).catch(() => undefined);
    }
    if (n.href) router.push(n.href);
  }

  function goToResult(href: string) {
    setSearchOpen(false);
    setQuery("");
    router.push(href);
  }

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

        {title ? (
          <h1 className="shrink-0 text-[18px] font-bold tracking-tight text-foreground">
            {title}
          </h1>
        ) : (
          <span className="shrink-0" aria-hidden />
        )}

        <div className="mx-auto hidden w-full max-w-[440px] flex-1 md:block" ref={searchRef}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-full border border-border bg-[#f7f8fb] pl-10 pr-4 text-[13px] outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-ring/20"
              placeholder="Search contacts, campaigns, messages..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length && setSearchOpen(true)}
            />
            {searchOpen && query.trim().length >= 2 ? (
              <div className="absolute left-0 right-0 top-12 z-40 max-h-96 overflow-auto rounded-xl border border-border bg-card p-1 shadow-lg">
                {searching && results.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">Searching…</p>
                ) : results.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">No results for “{query}”.</p>
                ) : (
                  results.map((r) => (
                    <button
                      key={`${r.type}-${r.id}`}
                      type="button"
                      onClick={() => goToResult(r.href)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{r.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                        {r.type}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {phoneNumbers.length > 0 ? (
            <select
              className="hidden h-9 max-w-[170px] rounded-full border border-border bg-card px-3 text-[12px] font-medium outline-none focus:border-primary sm:block"
              value={numberId}
              onChange={(e) => persistNumber(e.target.value)}
              aria-label="Sending number"
            >
              {phoneNumbers.map((n) => (
                <option key={n.id} value={n.id}>
                  {formatPhone(n.number)}
                </option>
              ))}
            </select>
          ) : null}

          <Link
            href="/settings/billing"
            className="hidden h-9 items-center gap-1.5 rounded-full bg-emerald-50 px-3 text-[12px] font-semibold text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100 sm:inline-flex"
          >
            <Coins className="h-3.5 w-3.5" />
            {formatNumber(metrics.creditsRemaining)} credits
          </Link>

          <div className="relative" ref={notifRef}>
            <button
              type="button"
              className="relative rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Notifications"
              onClick={openNotifications}
            >
              <Bell className="h-5 w-5" />
              {unread > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </button>

            {notifOpen ? (
              <div className="absolute right-0 top-12 z-40 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <p className="text-sm font-semibold">Notifications</p>
                  {unread > 0 ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline"
                      onClick={markAllRead}
                    >
                      Mark all read
                    </button>
                  ) : null}
                </div>
                <div className="max-h-96 overflow-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                      You&apos;re all caught up.
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => openNotification(n)}
                        className={`flex w-full flex-col items-start gap-0.5 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted ${
                          n.readAt ? "" : "bg-primary/5"
                        }`}
                      >
                        <span className="text-sm font-medium">{n.title}</span>
                        {n.body ? (
                          <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
                        ) : null}
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <Link
            href="/getting-started"
            className="hidden rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground sm:block"
            aria-label="Help"
          >
            <CircleHelp className="h-5 w-5" />
          </Link>

          <div className="relative" ref={accountRef}>
            <button
              type="button"
              onClick={() => setAccountOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-[12px] font-bold text-muted-foreground ring-1 ring-border hover:bg-muted/80"
              aria-label="Account menu"
              aria-expanded={accountOpen}
            >
              {initials}
            </button>
            {accountOpen ? (
              <div className="absolute right-0 top-12 z-40 w-56 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg">
                {[
                  { label: "Workspace", href: "/settings/workspaces" },
                  { label: "Team", href: "/settings/users" },
                  { label: "Usage & Credits", href: "/settings/limits" },
                  { label: "Billing", href: "/settings/billing" },
                  { label: "Plan", href: "/settings/billing" },
                  { label: "Notifications", href: "/settings/notifications" },
                  { label: "Settings", href: "/settings/business" },
                ].map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setAccountOpen(false)}
                    className="block px-3.5 py-2 text-[13px] font-medium text-foreground hover:bg-muted"
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="my-1 border-t border-border" />
                <button
                  type="button"
                  onClick={async () => {
                    setAccountOpen(false);
                    await fetch("/api/auth/logout", { method: "POST" });
                    router.push("/login");
                    router.refresh();
                  }}
                  className="block w-full px-3.5 py-2 text-left text-[13px] font-medium text-rose-600 hover:bg-rose-50"
                >
                  Sign Out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
