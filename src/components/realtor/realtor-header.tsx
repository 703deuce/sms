"use client";

import type { PhoneNumber, Workspace } from "@/lib/types";
import { formatPhone } from "@/lib/utils";
import {
  Bell,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  Menu,
  Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export function RealtorHeader({
  userName,
  isAdmin,
  workspaceId,
  workspaceName,
  workspaces = [],
  phoneNumbers,
  activeFromNumberId,
  unreadNotifications = 0,
  onMenuClick,
}: {
  userName: string;
  isAdmin?: boolean;
  workspaceId?: string;
  workspaceName: string;
  workspaces?: Workspace[];
  phoneNumbers: PhoneNumber[];
  activeFromNumberId?: string | null;
  unreadNotifications?: number;
  onMenuClick: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isSetup = pathname.startsWith("/realtor/setup");
  const isLeadDetail =
    pathname.startsWith("/realtor/leads/") && pathname !== "/realtor/leads";

  const [numberId, setNumberId] = useState(activeFromNumberId || phoneNumbers[0]?.id || "");
  const activeNumber = phoneNumbers.find((n) => n.id === numberId) || phoneNumbers[0];

  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(unreadNotifications);
  const notifRef = useRef<HTMLDivElement>(null);

  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const [siteOpen, setSiteOpen] = useState(false);
  const siteRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLFormElement>(null);

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (workspaceRef.current && !workspaceRef.current.contains(e.target as Node)) {
        setWorkspaceOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
      if (siteRef.current && !siteRef.current.contains(e.target as Node)) {
        setSiteOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        // keep search open while typing
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function switchWorkspace(id: string) {
    setWorkspaceOpen(false);
    try {
      await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: id }),
      });
      router.refresh();
    } catch {
      // ignore
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
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })),
    );
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

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) router.push(`/realtor/leads?q=${encodeURIComponent(q)}`);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const el = searchRef.current?.querySelector("input");
        el?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-[#e6e8ef] bg-white/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <button
          type="button"
          className="rounded-lg p-2 text-[#374151] hover:bg-[#f3f4f6] lg:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="relative shrink-0" ref={workspaceRef}>
          <button
            type="button"
            onClick={() => setWorkspaceOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-[#111827] hover:bg-[#f3f4f6]"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#eff6ff] text-[11px] font-bold text-[#6366f1]">
              {workspaceName.slice(0, 1)}
            </span>
            <span className="max-w-[160px] truncate">{workspaceName}</span>
            <ChevronDown className="h-4 w-4 text-[#9ca3af]" />
          </button>
          {workspaceOpen && workspaces.length > 1 ? (
            <div className="absolute left-0 top-11 z-40 w-56 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white py-1 shadow-lg">
              {workspaces.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => switchWorkspace(w.id)}
                  className={`block w-full px-3.5 py-2 text-left text-[13px] hover:bg-[#f9fafb] ${
                    w.id === workspaceId ? "font-semibold text-[#6366f1]" : "text-[#374151]"
                  }`}
                >
                  {w.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {isLeadDetail ? (
          <form
            ref={searchRef}
            onSubmit={onSearchSubmit}
            className="mx-auto hidden w-full max-w-[480px] flex-1 md:block"
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input
                className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-[#f9fafb] pl-10 pr-16 text-[13px] outline-none focus:border-[#6366f1] focus:bg-white focus:ring-2 focus:ring-[#6366f1]/20"
                placeholder="Search anything..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-[#e5e7eb] bg-white px-1.5 py-0.5 text-[10px] text-[#9ca3af]">
                ⌘ K
              </span>
            </div>
          </form>
        ) : (
          <span className="hidden flex-1 md:block" />
        )}

        <div className="ml-auto flex items-center gap-2">
          {!isSetup && activeNumber ? (
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-[13px] font-medium text-[#374151]">
                {formatPhone(activeNumber.number)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-100">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                {pathname.startsWith("/realtor/dashboard") ? "Live" : "Online"}
              </span>
            </div>
          ) : null}

          <Link
            href="/getting-started"
            className="rounded-full p-2 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827]"
            aria-label="Help"
          >
            <CircleHelp className="h-5 w-5" />
          </Link>

          <div className="relative" ref={notifRef}>
            <button
              type="button"
              className="relative rounded-full p-2 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827]"
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
              <div className="absolute right-0 top-12 z-40 w-80 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-2.5">
                  <p className="text-sm font-semibold">Notifications</p>
                  {unread > 0 ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-[#6366f1] hover:underline"
                      onClick={markAllRead}
                    >
                      Mark all read
                    </button>
                  ) : null}
                </div>
                <div className="max-h-96 overflow-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-[#6b7280]">
                      You&apos;re all caught up.
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          setNotifOpen(false);
                          if (n.href) router.push(n.href);
                        }}
                        className={`flex w-full flex-col items-start gap-0.5 border-b border-[#f3f4f6] px-4 py-3 text-left last:border-b-0 hover:bg-[#f9fafb] ${
                          n.readAt ? "" : "bg-[#eff6ff]/50"
                        }`}
                      >
                        <span className="text-sm font-medium">{n.title}</span>
                        {n.body ? (
                          <span className="line-clamp-2 text-xs text-[#6b7280]">{n.body}</span>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {isSetup ? (
            <div className="relative" ref={siteRef}>
              <button
                type="button"
                onClick={() => setSiteOpen((v) => !v)}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#e5e7eb] px-3 text-[13px] font-semibold text-[#374151] hover:bg-[#f9fafb]"
              >
                View your site
                <ChevronDown className="h-4 w-4 text-[#9ca3af]" />
              </button>
              {siteOpen ? (
                <div className="absolute right-0 top-11 z-40 w-48 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white py-1 shadow-lg">
                  <Link
                    href="/"
                    className="flex items-center gap-2 px-3.5 py-2 text-[13px] text-[#374151] hover:bg-[#f9fafb]"
                    onClick={() => setSiteOpen(false)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Marketing site
                  </Link>
                  <Link
                    href="/grow/forms"
                    className="block px-3.5 py-2 text-[13px] text-[#374151] hover:bg-[#f9fafb]"
                    onClick={() => setSiteOpen(false)}
                  >
                    Lead capture forms
                  </Link>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg pl-1 pr-2 py-1 hover:bg-[#f3f4f6]"
                aria-expanded={accountOpen}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e5e7eb] text-[11px] font-bold text-[#374151]">
                  {initials}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-[13px] font-semibold leading-tight text-[#111827]">
                    {userName}
                  </span>
                  {isAdmin ? (
                    <span className="block text-[11px] text-[#6b7280]">Admin</span>
                  ) : null}
                </span>
                <ChevronDown className="hidden h-4 w-4 text-[#9ca3af] sm:block" />
              </button>
              {accountOpen ? (
                <div className="absolute right-0 top-12 z-40 w-56 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white py-1 shadow-lg">
                  <Link
                    href="/settings"
                    className="block px-3.5 py-2 text-[13px] font-medium hover:bg-[#f9fafb]"
                    onClick={() => setAccountOpen(false)}
                  >
                    Settings
                  </Link>
                  <Link
                    href="/settings/workspaces"
                    className="block px-3.5 py-2 text-[13px] font-medium hover:bg-[#f9fafb]"
                    onClick={() => setAccountOpen(false)}
                  >
                    Workspace
                  </Link>
                  <div className="my-1 border-t border-[#e5e7eb]" />
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
          )}
        </div>
      </div>
    </header>
  );
}
