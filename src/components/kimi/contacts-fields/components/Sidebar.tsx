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
      <div className="tv-logo"><span className="tv-logo-mark">T</span>Transovo</div>
      <nav className="tv-nav">
        {item("Home", <Home size={16} />)}
        <button className="tv-nav-item tv-nav-group-label">
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}><Users size={16} />Audience</span>
          <ChevronDown size={14} />
        </button>
        {item("Contacts", <></>, view === "contacts" || view === "contactEdit", () => onNavigate("contacts"), true)}
        {item("Lists", <></>, false, undefined, true)}
        {item("Segments", <></>, false, undefined, true)}
        {item("Campaigns", <Megaphone size={16} />)}
        {item("Inbox", <Inbox size={16} />)}
        {item("Workflows", <Workflow size={16} />)}
        {item("Analytics", <BarChart3 size={16} />)}
        {item("Tools", <Wrench size={16} />, view === "fields" || view === "createField", () => onNavigate("fields"))}
      </nav>
      <div style={{ padding: "0 12px 8px", display: "flex", flexDirection: "column", gap: 1 }}>
        {item("Notifications", <Bell size={16} />)}
        {item("Support", <LifeBuoy size={16} />)}
      </div>
      <div className="tv-sidebar-footer">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, color: "#454a63" }}>Message Credits</span>
          <span style={{ color: "var(--tv-purple)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}><Sparkles size={12} />Upgrade</span>
        </div>
        <div className="tv-credits-bar"><div className="tv-credits-fill" /></div>
        <div style={{ marginTop: 6 }}>7,006 Credits Remaining</div>
        <div className="tv-user-row">
          <div className="tv-avatar">AJ</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--tv-text)" }}>Anthony Johnson</div>
            <div style={{ fontSize: 11 }}>SMS</div>
          </div>
          <ChevronsLeft size={14} style={{ color: "#a0a4b8" }} />
        </div>
      </div>
    </aside>
  );
}
