"use client";
import { Home, Users, Megaphone, Inbox, Workflow, BarChart3, Wrench, Bell, LifeBuoy, ChevronDown, Sparkles, ChevronsLeft } from "lucide-react";

export type View = "contacts" | "contactEdit" | "fields" | "createField";

export default function Sidebar({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  const item = (label: string, icon: React.ReactNode, active = false, onClick?: () => void, sub = false) => (
    <button key={label} className={`tv-nav-item ${active ? "active" : ""} ${sub ? "tv-nav-sub" : ""}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
  return (
    <aside className="tv-sidebar">
      <div className="tv-logo">
        <span className="tv-logo-mark">T</span>
        <span className="tv-logo-word">Transovo</span>
      </div>
      <nav className="tv-nav">
        {item("Home", <Home size={16} strokeWidth={2} />)}
        <button className="tv-nav-item tv-nav-group-label">
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}><Users size={16} strokeWidth={2} />Audience</span>
          <ChevronDown size={14} />
        </button>
        {item("Contacts", <></>, view === "contacts" || view === "contactEdit", () => onNavigate("contacts"), true)}
        {item("Lists", <></>, false, undefined, true)}
        {item("Segments", <></>, false, undefined, true)}
        {item("Campaigns", <Megaphone size={16} strokeWidth={2} />)}
        {item("Inbox", <Inbox size={16} strokeWidth={2} />)}
        {item("Workflows", <Workflow size={16} strokeWidth={2} />)}
        {item("Analytics", <BarChart3 size={16} strokeWidth={2} />)}
        {item("Tools", <Wrench size={16} strokeWidth={2} />, view === "fields" || view === "createField", () => onNavigate("fields"))}
      </nav>
      <div className="tv-nav-bottom">
        {item("Notifications", <Bell size={16} strokeWidth={2} />)}
        {item("Support", <LifeBuoy size={16} strokeWidth={2} />)}
      </div>
      <div className="tv-sidebar-footer">
        <div className="tv-credits-card">
          <div className="tv-credits-head">
            <span className="tv-credits-label">Message Credits</span>
            <span className="tv-upgrade"><Sparkles size={12} />Upgrade</span>
          </div>
          <div className="tv-credits-bar"><div className="tv-credits-fill" /></div>
          <div className="tv-credits-count">7,006 Credits Remaining</div>
        </div>
        <div className="tv-user-row">
          <div className="tv-avatar">AJ</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tv-user-name">Anthony Johnson</div>
            <div className="tv-user-plan">SMS</div>
          </div>
          <ChevronsLeft size={14} style={{ color: "#a3a8bf", flexShrink: 0 }} />
        </div>
      </div>
    </aside>
  );
}
