"use client";

import {
  Home, CalendarDays, BookOpen, Users, MessageSquare, Zap, Video,
  CreditCard, BarChart3, Plug, Settings, Search, Bell, HelpCircle, ChevronDown,
} from "lucide-react";
import { sidebarNav } from "../mock-data";

const iconMap: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  home: Home,
  calendar: CalendarDays,
  book: BookOpen,
  users: Users,
  message: MessageSquare,
  zap: Zap,
  video: Video,
  card: CreditCard,
  chart: BarChart3,
  plug: Plug,
  gear: Settings,
};

export default function AppShell({
  children,
  activeNav,
}: {
  children: React.ReactNode;
  activeNav: string;
}) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">T</span>
          <span className="brand-name">Transovo</span>
        </div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {sidebarNav.map((item) => {
            const Icon = iconMap[item.icon];
            const active = item.label === activeNav;
            return (
              <a
                key={item.label}
                href={item.href}
                className={`nav-item ${active ? "nav-item-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                <span>{item.label}</span>
                {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
              </a>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <a href="/getting-started" className="nav-item">
            <HelpCircle size={17} strokeWidth={1.8} />
            <span>Help</span>
          </a>
          <div className="sidebar-user">
            <span className="user-avatar">MC</span>
            <div className="user-meta">
              <span className="user-name">Maya Chen</span>
              <span className="user-ws">Brightline Dental</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="workspace-switch" type="button">
            <span className="ws-dot" />
            Brightline Dental Studio
            <ChevronDown size={14} />
          </button>
          <div className="topbar-right">
            <div className="topbar-search">
              <Search size={14} />
              <input placeholder="Search appointments, contacts…" aria-label="Search" />
            </div>
            <button className="icon-btn" aria-label="Notifications">
              <Bell size={17} />
            </button>
            <span className="user-avatar sm">MC</span>
          </div>
        </header>
        <main className="content" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
