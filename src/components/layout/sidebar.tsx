"use client";

import { appNav } from "@/lib/nav";
import { workspaces } from "@/lib/mock/data";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  CircleHelp,
  CreditCard,
  LogOut,
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
    <aside className="flex h-full w-[280px] flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-white/10 px-4 py-4">
        <Link href="/dashboard" className="block" onClick={onClose}>
          <div className="font-display text-lg font-semibold tracking-tight text-white">
            Transovo SMS
          </div>
          <p className="text-xs text-sidebar-muted">Business texting platform</p>
        </Link>
        <label className="mt-4 block text-[11px] font-medium uppercase tracking-wide text-sidebar-muted">
          Workspace
        </label>
        <select
          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-teal-400"
          value={activeWorkspace.id}
          onChange={(e) => switchWorkspace(e.target.value)}
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id} className="text-foreground">
              {w.name}
            </option>
          ))}
        </select>
      </div>

      <div className="px-3 pt-3">
        <Link
          href="/send"
          onClick={onClose}
          className="flex items-center justify-center gap-2 rounded-lg bg-teal-500 px-3 py-2.5 text-sm font-semibold text-teal-950 transition hover:bg-teal-400"
        >
          <Send className="h-4 w-4" />
          Send campaign
        </Link>
      </div>

      <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {appNav.map((item) => {
          const Icon = item.icon;
          const childActive = item.children?.some(
            (c) => pathname === c.href || pathname.startsWith(c.href + "/"),
          );
          const active =
            pathname === item.href ||
            childActive ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
          const isOpen = expanded[item.label] ?? Boolean(childActive);

          return (
            <div key={item.label}>
              <div className="flex items-center">
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
                    active
                      ? "bg-sidebar-active text-white"
                      : "text-sidebar-foreground/90 hover:bg-white/5",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-90" />
                  <span className="truncate">{item.label}</span>
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
                      className={cn("h-4 w-4 transition", isOpen && "rotate-180")}
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
                          "block rounded-md px-2.5 py-1.5 text-[13px] transition",
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

      <div className="space-y-1 border-t border-white/10 p-3">
        <Link
          href="/getting-started"
          onClick={onClose}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-muted hover:bg-white/5 hover:text-white"
        >
          <CircleHelp className="h-4 w-4" />
          Help & getting started
        </Link>
        <Link
          href="/settings/billing"
          onClick={onClose}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-muted hover:bg-white/5 hover:text-white"
        >
          <CreditCard className="h-4 w-4" />
          Billing / usage
        </Link>
        <div className="flex items-center justify-between rounded-lg px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{userName}</p>
            <p className="text-xs text-sidebar-muted">Owner</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-md p-2 text-sidebar-muted hover:bg-white/5 hover:text-white"
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
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[280px]">
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
