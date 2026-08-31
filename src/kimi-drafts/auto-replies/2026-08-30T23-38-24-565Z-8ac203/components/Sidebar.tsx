"use client";
import {
  Home, Users, Megaphone, Inbox, Workflow, BarChart3, Wrench,
  Bell, LifeBuoy, Zap,
} from "lucide-react";

const items = [
  { label: "Home", icon: Home },
  { label: "Audience", icon: Users },
  { label: "Campaigns", icon: Megaphone },
  { label: "Inbox", icon: Inbox },
  { label: "Workflows", icon: Workflow },
  { label: "Analytics", icon: BarChart3 },
  { label: "Tools", icon: Wrench },
];

export default function Sidebar() {
  return (
    <aside className="tv-sidebar">
      <div className="tv-logo">
        <span className="tv-logo-mark">T</span>
        Transovo
      </div>
      <nav className="tv-nav">
        {items.map(({ label, icon: Icon }) => (
          <button key={label} className={`tv-nav-item ${label === "Tools" ? "active" : ""}`}>
            <Icon size={17} />
            {label}
          </button>
        ))}
        <div style={{ height: 14 }} />
        <button className="tv-nav-item"><Bell size={17} />Notifications</button>
        <button className="tv-nav-item"><LifeBuoy size={17} />Support</button>
      </nav>
      <div className="tv-side-foot">
        <div className="tv-credits flex items-center justify-between">
          <span>Message Credits · 7,120</span>
          <span className="flex items-center gap-1" style={{ color: "var(--brand)", fontWeight: 600, cursor: "pointer" }}>
            <Zap size={13} /> Upgrade
          </span>
        </div>
        <div className="tv-user">
          <span className="tv-avatar">JD</span>
          <div>
            <div style={{ fontWeight: 600 }}>John Doe</div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>Transovo Tutorials</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
