"use client";

import { appNav } from "@/lib/nav";
import { workspaces } from "@/lib/mock/data";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  CircleHelp,
  CreditCard,
  LogOut,
  MessageSquare,
  Send,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export function Sidebar({
  workspaceId,
  userName,
  open,
  onClose,
}: {
  workspaceId: string;
  userName: string;
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === workspaceId) ?? workspaces[0],
    [workspaceId],
  );

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
    <aside className="flex h-full w-[260px] flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-white/10 px-4 py-4">
        <Link href="/dashboard" className="flex items-start gap-2.5" onClick={onClose}>
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-[0_8px_18px_rgba(16,185,129,0.35)]">
            <MessageSquare className="h-4 w-4" fill="currentColor" />
          </span>
          <span>
            <span className="block text-[15px] font-bold tracking-tight text-white">
              Transovo SMS
            </span>
            <span className="mt-0.5 block text-[11px] text-sidebar-muted">
              Business texting platform
            </span>
          </span>
        </Link>

        <label className="mt-4 block text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted">
          Workspace
        </label>
        <div className="relative mt-1.5">
          <span className="pointer-events-none absolute left-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md bg-violet-500 text-[10px] font-bold text-white">
            H
          </span>
          <select
            className="h-10 w-full appearance-none rounded-[10px] border border-white/10 bg-white/5 py-2 pl-9 pr-8 text-[13px] font-medium text-white outline-none focus:border-primary/40"
            value={activeWorkspace.id}
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

      <div className="px-3 pt-3">
        <Link
          href="/send"
          onClick={onClose}
          className="flex h-10 items-center justify-center gap-2 rounded-[10px] bg-primary px-3 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(16,185,129,0.3)] transition hover:bg-primary-hover"
        >
          <Send className="h-4 w-4" />
          Send campaign
        </Link>
      </div>

      <nav className="mt-3 flex-1 space-y-[2px] overflow-y-auto px-2.5 pb-3">
        {appNav.map((item) => {
          const Icon = item.icon;
          const childActive = item.children?.some(
            (c) => pathname === c.href || pathname.startsWith(c.href + "/"),
          );
          const active =
            pathname === item.href ||
            childActive ||
            (item.href !== "/dashboard" &&
              pathname.startsWith(item.href + "/") &&
              !item.children);
          const isOpen = expanded[item.label] ?? Boolean(childActive);

          return (
            <div key={item.label}>
              <div className="flex items-center">
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "group flex flex-1 items-center gap-2.5 rounded-[10px] px-3 py-[9px] text-[13px] font-medium transition",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-sidebar-foreground/90 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-[17px] w-[17px] shrink-0",
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
                    className="rounded-md p-2 text-sidebar-muted hover:bg-white/5 hover:text-white"
                    onClick={() =>
                      setExpanded((s) => ({ ...s, [item.label]: !isOpen }))
                    }
                    aria-label={`Toggle ${item.label}`}
                  >
                    <ChevronDown
                      className={cn("h-3.5 w-3.5 transition", isOpen && "rotate-180")}
                    />
                  </button>
                ) : null}
              </div>
              {item.children && isOpen ? (
                <div className="mb-1 ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                  {item.children.map((child) => {
                    const childIsActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onClose}
                        className={cn(
                          "block rounded-md px-2.5 py-1.5 text-[12px] transition",
                          childIsActive
                            ? "bg-white/10 text-white"
                            : "text-sidebar-muted hover:bg-white/5 hover:text-white",
                        )}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="space-y-0.5 border-t border-white/10 p-3">
        <Link
          href="/getting-started"
          onClick={onClose}
          className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13px] text-sidebar-muted hover:bg-white/5 hover:text-white"
        >
          <CircleHelp className="h-4 w-4" />
          Help & getting started
        </Link>
        <Link
          href="/settings/billing"
          onClick={onClose}
          className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13px] text-sidebar-muted hover:bg-white/5 hover:text-white"
        >
          <CreditCard className="h-4 w-4" />
          Billing / usage
        </Link>
        <div className="mt-1 flex items-center gap-2.5 rounded-[12px] bg-white/[0.04] px-2.5 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/avatars/alex.svg"
            alt={userName}
            className="h-8 w-8 rounded-full object-cover ring-2 ring-white/10"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white">{userName}</p>
            <p className="text-[11px] text-sidebar-muted">Owner</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-md p-1.5 text-sidebar-muted hover:bg-white/5 hover:text-white"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[260px]">{content}</div>
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
