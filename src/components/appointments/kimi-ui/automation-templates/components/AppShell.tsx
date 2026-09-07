"use client";

import {
  Calendar,
  CalendarCheck,
  Users,
  MessageSquare,
  Zap,
  Video,
  CreditCard,
  BarChart3,
  Blocks,
  Settings,
  Home,
  Search,
  Bell,
  HelpCircle,
} from "lucide-react";
import { ReactNode } from "react";

const NAV = [
  { id: "home", label: "Home", icon: Home },
  { id: "appointments", label: "Appointments", icon: Calendar },
  { id: "booking", label: "Booking", icon: CalendarCheck },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "automations", label: "Automations", icon: Zap },
  { id: "meetings", label: "Meetings", icon: Video },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

const AUTOMATIONS_LOCAL = [
  { id: "reminders", label: "Reminder Sequences" },
  { id: "workflows", label: "Workflows" },
  { id: "templates", label: "Templates" },
  { id: "activity", label: "Activity" },
];

export function AppShell({
  children,
  activeDomain,
  activeLocal,
}: {
  children: ReactNode;
  activeDomain: string;
  activeLocal: string;
}) {
  return (
    <div className="tv-shell">
      <aside className="tv-sidebar">
        <div className="tv-brand">
          <div className="tv-brand-mark">T</div>
          <span className="tv-brand-name">Transovo</span>
        </div>
        <nav className="tv-nav" aria-label="Main navigation">
          {NAV.map((item) => (
            <div key={item.id}>
              <button
                className={`tv-nav-item ${item.id === activeDomain ? "active" : ""}`}
                aria-current={item.id === activeDomain ? "page" : undefined}
              >
                <item.icon size={17} strokeWidth={1.9} />
                {item.label}
              </button>
              {item.id === activeDomain && item.id === "automations" && (
                <div className="tv-subnav">
                  {AUTOMATIONS_LOCAL.map((sub) => (
                    <button
                      key={sub.id}
                      className={`tv-subnav-item ${sub.id === activeLocal ? "active" : ""}`}
                      aria-current={sub.id === activeLocal ? "page" : undefined}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="tv-nav-divider" />
          <button className="tv-nav-item">
            <Blocks size={17} strokeWidth={1.9} />
            Integrations
          </button>
          <button className="tv-nav-item">
            <Settings size={17} strokeWidth={1.9} />
            Settings
          </button>
          <button className="tv-nav-item">
            <HelpCircle size={17} strokeWidth={1.9} />
            Help
          </button>
        </nav>
        <div className="tv-sidebar-footer">
          <div className="tv-avatar">JD</div>
          <div>
            <div className="tv-sidebar-footer-name">John Doe</div>
            <div className="tv-sidebar-footer-role">Owner</div>
          </div>
        </div>
      </aside>

      <div className="tv-main">
        <header className="tv-header">
          <span className="tv-header-crumb">
            Automations / <b>Templates</b>
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="tv-search-wrap" style={{ width: 220 }}>
              <Search size={15} />
              <input className="tv-input" style={{ height: 32 }} placeholder="Search…" aria-label="Global search" />
            </div>
            <button className="tv-icon-btn" aria-label="Notifications" style={{ width: 34, height: 34 }}>
              <Bell size={17} />
            </button>
          </div>
        </header>
        <main className="tv-content">{children}</main>
      </div>
    </div>
  );
}
