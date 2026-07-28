"use client";

import { appNav } from "@/lib/nav";
import { workspaces } from "@/lib/mock/data";
import { cn } from "@/lib/utils";
import {
  Building2,
  ChevronDown,
  LogOut,
  Plus,
  Sparkles,
  Megaphone,
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
    <aside className="flex h-full w-[248px] flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-4 pb-2 pt-5">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-[0_6px_16px_rgba(18,185,139,0.4)]">
            <span className="absolute inset-1 rounded-full border border-white/35" />
            <Megaphone className="relative h-3.5 w-3.5" />
          </span>
          <span className="text-[15px] font-bold tracking-tight text-white">
            Transovo SMS
          </span>
        </Link>

        <div className="relative mt-5">
          <Building2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-muted" />
          <select
            className="h-10 w-full appearance-none rounded-lg border border-white/10 bg-[#151d2e] py-2 pl-9 pr-8 text-[13px] font-medium text-white outline-none focus:border-primary/50"
            value={activeWorkspace.id}
            onChange={(e) => switchWorkspace(e.target.value)}
            aria-label="Workspace"
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

      <div className="px-4 pt-3">
        <Link
          href="/send"
          onClick={onClose}
          className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(18,185,139,0.28)] transition hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Add Campaign
        </Link>
      </div>

      <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
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
                    "group flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition",
                    active
                      ? "bg-[#12b98b]/18 text-[#5eead4]"
                      : "text-sidebar-foreground hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0",
                      active ? "text-[#5eead4]" : "text-sidebar-muted group-hover:text-white",
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                  {item.badge != null ? (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
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

      <div className="space-y-1 border-t border-white/10 p-3">
        <Link
          href="/settings/billing"
          onClick={onClose}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-sidebar-muted hover:bg-white/5 hover:text-white"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          Get more features
        </Link>
        <Link
          href="/getting-started"
          onClick={onClose}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-sidebar-muted hover:bg-white/5 hover:text-white"
        >
          <Megaphone className="h-4 w-4" />
          What&apos;s new
        </Link>
        <div className="mt-1 flex items-center gap-2.5 rounded-xl bg-white/5 px-2.5 py-2">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-blue text-[11px] font-bold text-white">
            {userName
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white">{userName}</p>
            <p className="text-[11px] text-sidebar-muted">Admin</p>
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
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[248px]">{content}</div>
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
