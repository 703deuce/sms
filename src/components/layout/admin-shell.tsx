"use client";

import { adminNav } from "@/lib/nav";
import { cn } from "@/lib/utils";
import {
  Bell,
  CircleHelp,
  LogOut,
  MessageSquare,
  Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function AdminShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[260px]">
        <aside className="flex h-full w-[260px] flex-col bg-sidebar text-sidebar-foreground">
          <div className="border-b border-white/10 px-4 py-4">
            <Link href="/admin" className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-[0_8px_18px_rgba(16,185,129,0.35)]">
                <MessageSquare className="h-4 w-4" fill="currentColor" />
              </span>
              <span>
                <span className="block text-[15px] font-bold tracking-tight text-white">
                  Transovo Admin
                </span>
                <span className="mt-0.5 block text-[11px] text-sidebar-muted">
                  Platform operations
                </span>
              </span>
            </Link>
          </div>

          <nav className="mt-3 flex-1 space-y-[2px] overflow-y-auto px-2.5 pb-3">
            {adminNav.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href + "/"));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-[10px] px-3 py-[9px] text-[13px] font-medium transition",
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
                </Link>
              );
            })}
          </nav>

          <div className="space-y-0.5 border-t border-white/10 p-3">
            <div className="flex items-center gap-2.5 rounded-[12px] bg-white/[0.04] px-2.5 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/avatars/alex.svg"
                alt={userName}
                className="h-8 w-8 rounded-full object-cover ring-2 ring-white/10"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-white">{userName}</p>
                <p className="text-[11px] text-sidebar-muted">Platform admin</p>
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
            <Link
              href="/dashboard"
              className="mt-1 block rounded-[10px] px-3 py-2 text-[13px] text-sidebar-muted hover:bg-white/5 hover:text-white"
            >
              ← Back to app
            </Link>
          </div>
        </aside>
      </div>

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-30 border-b border-border bg-header/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
            <div className="mx-auto hidden w-full max-w-[520px] flex-1 md:block">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="h-10 w-full rounded-full border border-border bg-[#f7f8fb] pl-10 pr-4 text-[13px] outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-ring/20"
                  placeholder="Search customers, accounts, campaigns..."
                />
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="relative rounded-full p-2.5 text-foreground hover:bg-muted"
                aria-label="Notifications"
              >
                <Bell className="h-[18px] w-[18px]" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger ring-2 ring-white" />
              </button>

              <Link
                href="/admin/support"
                className="rounded-full p-2.5 text-foreground hover:bg-muted"
                aria-label="Help"
              >
                <CircleHelp className="h-[18px] w-[18px]" />
              </Link>

              <Link
                href="/admin/settings"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-sky-500 text-[11px] font-bold text-white"
                title={userName}
              >
                {initials}
              </Link>
            </div>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
