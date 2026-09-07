"use client";

import React from "react";
import {
  LayoutDashboard, CalendarDays, CalendarPlus, Users, MessageSquare,
  Workflow, Video, CreditCard, BarChart3, Blocks, Settings, Search, Bell, LifeBuoy,
} from "lucide-react";

const navMain = [
  { label: "Home", icon: LayoutDashboard },
  { label: "Appointments", icon: CalendarDays, active: true },
  { label: "Booking", icon: CalendarPlus },
  { label: "Contacts", icon: Users },
  { label: "Messages", icon: MessageSquare },
  { label: "Automations", icon: Workflow },
  { label: "Meetings", icon: Video },
];
const navBusiness = [
  { label: "Payments", icon: CreditCard },
  { label: "Analytics", icon: BarChart3 },
  { label: "Integrations", icon: Blocks },
  { label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="sidebar-logo-mark">T</span>
          Transovo
        </div>
        <nav className="nav-section" aria-label="Main navigation">
          <div className="nav-label">Work</div>
          {navMain.map((i) => (
            <a key={i.label} className={`nav-item${i.active ? " active" : ""}`} href="#" onClick={(e) => e.preventDefault()} aria-current={i.active ? "page" : undefined}>
              <i.icon size={16} strokeWidth={i.active ? 2.2 : 1.8} />
              {i.label}
            </a>
          ))}
          <div className="nav-label">Business</div>
          {navBusiness.map((i) => (
            <a key={i.label} className="nav-item" href="#" onClick={(e) => e.preventDefault()}>
              <i.icon size={16} strokeWidth={1.8} />
              {i.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="avatar">BP</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Bright Plumbing</div>
            <div className="muted small">Owner workspace</div>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-search">
            <Search size={14} />
            <span>Search appointments, contacts…</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <button className="icon-btn" aria-label="Help"><LifeBuoy size={17} /></button>
            <button className="icon-btn" aria-label="Notifications"><Bell size={17} /></button>
            <span className="avatar" style={{ marginLeft: 6 }}>JD</span>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
