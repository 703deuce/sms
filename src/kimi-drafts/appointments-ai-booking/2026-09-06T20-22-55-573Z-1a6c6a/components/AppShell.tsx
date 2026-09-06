"use client";

import type { ReactNode } from "react";
import {
  LayoutGrid, CalendarDays, CalendarCheck, Users, MessageSquare, Workflow,
  Video, CreditCard, BarChart3, Plug, Settings, LifeBuoy, Search, Bell,
  BookOpen, ChevronDown,
} from "lucide-react";

const NAV = [
  { icon: LayoutGrid, label: "Home" },
  { icon: CalendarDays, label: "Appointments" },
  { icon: CalendarCheck, label: "Booking", active: true, expanded: true },
  { icon: Users, label: "Contacts" },
  { icon: MessageSquare, label: "Messages" },
  { icon: Workflow, label: "Automations" },
  { icon: Video, label: "Meetings" },
  { icon: CreditCard, label: "Payments" },
  { icon: BarChart3, label: "Analytics" },
];

const BOOKING_SUB = [
  "Booking Types",
  "Booking Pages",
  "Availability",
  "AI Booking",
  "Routing",
  "Meeting Polls",
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-mark">T</span>
          Transovo
        </div>
        <nav className="nav-scroll" aria-label="Main navigation">
          {NAV.map((item) => (
            <div key={item.label}>
              <div className={`nav-item${item.active ? " active" : ""}`}>
                <item.icon size={16} strokeWidth={2} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.expanded ? <ChevronDown size={13} /> : null}
              </div>
              {item.expanded ? (
                <div className="nav-sub">
                  {BOOKING_SUB.map((sub) => (
                    <span
                      key={sub}
                      className={`nav-sub-item${sub === "AI Booking" ? " active" : ""}`}
                      aria-current={sub === "AI Booking" ? "page" : undefined}
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          <div style={{ height: 10 }} />
          <div className="nav-item"><Plug size={16} strokeWidth={2} />Integrations</div>
          <div className="nav-item"><Settings size={16} strokeWidth={2} />Settings</div>
          <div className="nav-item"><LifeBuoy size={16} strokeWidth={2} />Help</div>
        </nav>
        <div className="sidebar-footer">
          <span className="avatar">JD</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>Jordan Diaz</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Brightpath Home Services</div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-search">
            <Search size={14} />
            Search appointments, contacts…
          </div>
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost btn-sm" aria-label="Notifications">
            <Bell size={16} />
          </button>
          <button className="btn btn-outline btn-sm">
            <BookOpen size={14} />
            Documentation
          </button>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
