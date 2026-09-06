"use client";

import {
  LayoutGrid, CalendarDays, CalendarClock, Users, MessageSquare,
  Workflow, Video, CreditCard, BarChart3, Plug, Settings, LifeBuoy,
  Search, Bell, ChevronDown,
} from "lucide-react";
import { cn } from "./ui";

const nav = [
  { label: "Home", icon: LayoutGrid },
  { label: "Appointments", icon: CalendarDays },
  { label: "Booking", icon: CalendarClock },
  { label: "Contacts", icon: Users },
  { label: "Messages", icon: MessageSquare, badge: 4 },
  { label: "Automations", icon: Workflow },
  { label: "Meetings", icon: Video, active: true },
  { label: "Payments", icon: CreditCard },
  { label: "Analytics", icon: BarChart3 },
];

const footerNav = [
  { label: "Integrations", icon: Plug },
  { label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[232px] flex-col border-r border-border bg-card">
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-[13px] font-bold text-primary-foreground">
            T
          </div>
          <span className="font-display text-[15px] font-bold tracking-tight">Transovo</span>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3" aria-label="Main navigation">
          {nav.map((item) => (
            <a
              key={item.label}
              href="#"
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors",
                item.active
                  ? "bg-[hsl(234_62%_54%/0.09)] text-[hsl(234_62%_46%)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" strokeWidth={item.active ? 2.2 : 1.8} />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {item.badge}
                </span>
              ) : null}
            </a>
          ))}

          {itemGroup("Meetings", [
            { label: "Upcoming", active: false },
            { label: "Recaps", active: true },
          ])}

          <div className="pt-3">
            {footerNav.map((item) => (
              <a
                key={item.label}
                href="#"
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="border-t border-border p-2.5">
          <a
            href="#"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LifeBuoy className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            Help & getting started
          </a>
          <button className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(234_62%_54%/0.14)] text-[11px] font-bold text-[hsl(234_62%_46%)]">
              DR
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-foreground">Dr. Rivera</p>
              <p className="truncate text-[11px] text-muted-foreground">Rivera Home Services</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="ml-[232px] flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-[hsl(var(--background)/0.85)] px-6 backdrop-blur">
          <div className="flex h-9 w-full max-w-md items-center gap-2 rounded-[10px] border border-border bg-card px-3 text-sm text-muted-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <Search className="h-4 w-4" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/80"
              placeholder="Search appointments, contacts, meetings…"
              aria-label="Search"
            />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              aria-label="Notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[hsl(0_72%_51%)]" />
            </button>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );

  function itemGroup(parent: string, items: Array<{ label: string; active: boolean }>) {
    return (
      <div className="ml-[26px] mt-0.5 space-y-0.5 border-l border-border pl-2.5" aria-label={`${parent} navigation`}>
        {items.map((sub) => (
          <a
            key={sub.label}
            href="#"
            aria-current={sub.active ? "page" : undefined}
            className={cn(
              "block rounded-md px-2 py-[5px] text-[12.5px] font-medium transition-colors",
              sub.active
                ? "text-[hsl(234_62%_46%)]"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {sub.label}
          </a>
        ))}
      </div>
    );
  }
}
