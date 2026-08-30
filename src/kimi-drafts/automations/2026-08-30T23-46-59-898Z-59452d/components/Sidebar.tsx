"use client";

import React from "react";
import {
  Home,
  Users,
  Megaphone,
  Inbox,
  Workflow,
  BarChart3,
  Wrench,
  Bell,
  LifeBuoy,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { label: "Home", icon: Home },
  { label: "Audience", icon: Users },
  { label: "Campaigns", icon: Megaphone },
  { label: "Inbox", icon: Inbox },
  { label: "Automations", icon: Workflow, active: true },
  { label: "Analytics", icon: BarChart3 },
  { label: "Tools", icon: Wrench },
];

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <path d="M6 20c-2-4 0-9 5-11 4-1.6 8-0.5 10 2.5C18 10 13 12 12 16.5 11 21 8 22 6 20Z" fill="#14b8a6" />
        <path d="M26 12c2 4 0 9-5 11-4 1.6-8 0.5-10-2.5 3 1.5 8-0.5 9-5 1-4.5 4-5.5 6-3.5Z" fill="#4f46e5" />
        <circle cx="16" cy="16" r="4" fill="#1e2a5a" />
      </svg>
      {!compact && (
        <span className="text-lg font-bold tracking-tight" style={{ color: "var(--navy)" }}>
          Transovo
        </span>
      )}
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="flex w-[210px] shrink-0 flex-col border-r border-border bg-card">
      <div className="px-4 py-4">
        <Logo />
      </div>
      <nav className="flex-1 space-y-0.5 px-2">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
              item.active
                ? "bg-indigo-50 text-indigo-700"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon size={16} strokeWidth={item.active ? 2.2 : 1.8} />
            {item.label}
            {item.active && <ChevronRight size={14} className="ml-auto opacity-60" />}
          </button>
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-border px-2 py-3">
        <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-muted">
          <Bell size={16} /> Notifications
        </button>
        <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-muted">
          <LifeBuoy size={16} /> Support
        </button>
      </div>
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between text-[11px] font-semibold text-foreground">
          <span>Message Credits</span>
          <span className="text-indigo-600">Upgrade</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[42%] rounded-full bg-indigo-600" />
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">5,681 Credits Remaining</p>
      </div>
      <div className="flex items-center gap-2.5 border-t border-border px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
          JD
        </div>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-foreground">John Doe</p>
          <p className="truncate text-[10px] text-muted-foreground">Transovo Tutorials</p>
        </div>
      </div>
    </aside>
  );
}
