import React from "react";
import {
  CalendarDays, CalendarCheck, Users, MessageSquare, Workflow, Video,
  CreditCard, BarChart3, Plug, Settings, Home, ChevronDown, Search, Bell, LifeBuoy,
} from "lucide-react";

const bookingSubnav = [
  { label: "Booking types", active: false },
  { label: "Booking pages", active: false },
  { label: "Availability", active: false },
  { label: "AI booking", active: false },
  { label: "Routing", active: false },
  { label: "Meeting polls", active: false },
  { label: "Team booking pages", active: true },
];

const nav = [
  { icon: Home, label: "Home" },
  { icon: CalendarDays, label: "Appointments" },
  { icon: CalendarCheck, label: "Booking", active: true },
  { icon: Users, label: "Contacts" },
  { icon: MessageSquare, label: "Messages" },
  { icon: Workflow, label: "Automations" },
  { icon: Video, label: "Meetings" },
  { icon: CreditCard, label: "Payments" },
  { icon: BarChart3, label: "Analytics" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside className="sidebar" aria-label="Main navigation">
        <div style={{ padding: "16px 14px 12px", display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: "var(--primary)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 14,
          }}>T</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Transovo</div>
        </div>
        <div style={{ padding: "4px 10px", display: "grid", gap: 2 }}>
          {nav.map((n) => (
            <div key={n.label}>
              <div className={`nav-item${n.active ? " active" : ""}`}>
                <n.icon size={16} strokeWidth={2} />
                <span style={{ flex: 1 }}>{n.label}</span>
                {n.active && <ChevronDown size={14} />}
              </div>
              {n.active && (
                <div style={{ marginTop: 2, display: "grid", gap: 1 }}>
                  {bookingSubnav.map((s) => (
                    <span key={s.label} className={`sub-item${s.active ? " active" : ""}`} aria-current={s.active ? "page" : undefined}>
                      {s.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, padding: "12px 10px 0", borderTop: "1px solid var(--border)", display: "grid", gap: 2 }}>
          <div className="nav-item"><Plug size={16} /><span>Integrations</span></div>
          <div className="nav-item"><Settings size={16} /><span>Settings</span></div>
          <div className="nav-item"><LifeBuoy size={16} /><span>Help</span></div>
        </div>
      </aside>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{
          height: 52, background: "var(--card)", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 12, padding: "0 20px", flex: "none",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, background: "var(--muted)",
            borderRadius: 8, height: 32, padding: "0 11px", color: "var(--fg-faint)",
            fontSize: 13, width: 260,
          }}>
            <Search size={14} /> Search
          </div>
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost btn-sm" aria-label="Notifications"><Bell size={16} /></button>
          <div style={{
            width: 30, height: 30, borderRadius: "50%", background: "var(--primary-soft)",
            color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700,
          }}>BD</div>
        </header>
        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}
