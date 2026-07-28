"use client";

import { adminNav } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
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

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="lg:fixed lg:inset-y-0 lg:flex lg:w-[260px]">
        <aside className="flex h-full w-[260px] flex-col bg-sidebar text-sidebar-foreground">
          <div className="border-b border-white/10 px-4 py-5">
            <Link href="/admin" className="block">
              <div className="font-display text-lg font-semibold tracking-tight text-white">
                Transovo Admin
              </div>
              <p className="text-xs text-sidebar-muted">Platform operations</p>
            </Link>
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
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
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
                    active
                      ? "bg-sidebar-active text-white"
                      : "text-sidebar-foreground/90 hover:bg-white/5",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-90" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-3">
            <div className="flex items-center justify-between rounded-lg px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{userName}</p>
                <p className="text-xs text-sidebar-muted">Platform admin</p>
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
            <Link
              href="/dashboard"
              className="mt-1 block rounded-lg px-3 py-2 text-sm text-sidebar-muted hover:bg-white/5 hover:text-white"
            >
              ← Back to app
            </Link>
          </div>
        </aside>
      </div>

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex h-14 items-center px-4 lg:px-6">
            <p className="font-display text-sm font-semibold text-foreground">Transovo Admin</p>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
