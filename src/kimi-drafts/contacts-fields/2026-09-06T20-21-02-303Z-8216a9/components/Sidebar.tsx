"use client";
import { useRouter } from "next/navigation";
import { Home, Users, CalendarDays, CalendarClock, Inbox, Workflow, Video, CreditCard, BarChart3, Plug, Settings, Bell, LifeBuoy, ChevronDown, Sparkles, ChevronsLeft } from "lucide-react";

export type View = "contacts" | "contactEdit" | "fields" | "createField";

export default function Sidebar({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  const router = useRouter();
  const item = (label: string, icon: React.ReactNode, active = false, onClick?: () => void, sub = false) => (
    <button key={label} className={`tv-nav-item ${active ? "active" : ""} ${sub ? "tv-nav-sub" : ""}`} onClick={onClick} aria-current={active ? "page" : undefined}>
      {icon}
      <span>{label}</span>
    </button>
  );
  const contactsActive = view === "contacts" || view === "contactEdit" || view === "fields" || view === "createField";
  return (
    <aside className="tv-sidebar" aria-label="Main navigation">
      <div className="tv-logo">
        <span className="tv-logo-mark">T</span>
        <span className="tv-logo-word">Transovo</span>
      </div>
      <nav className="tv-nav">
        {item("Home", <Home size={16} strokeWidth={2} />, false, () => router.push("/appointments/overview"))}
        {item("Appointments", <CalendarDays size={16} strokeWidth={2} />, false, () => router.push("/appointments"))}
        {item("Booking", <CalendarClock size={16} strokeWidth={2} />, false, () => router.push("/appointments/types"))}
        <button className="tv-nav-item tv-nav-group-label" aria-expanded="true" onClick={() => onNavigate("contacts")}>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}><Users size={16} strokeWidth={2} />Contacts</span>
          <ChevronDown size={14} />
        </button>
        {item("All Contacts", <></>, view === "contacts" || view === "contactEdit", () => onNavigate("contacts"), true)}
        {item("Lists", <></>, false, () => router.push("/contacts/lists"), true)}
        {item("Segments", <></>, false, () => router.push("/contacts/segments"), true)}
        {item("Custom Fields", <></>, contactsActive && (view === "fields" || view === "createField"), () => onNavigate("fields"), true)}
        {item("Imports", <></>, false, () => router.push("/contacts/imports"), true)}
        {item("Messages", <Inbox size={16} strokeWidth={2} />, false, () => router.push("/conversations"))}
        {item("Automations", <Workflow size={16} strokeWidth={2} />, false, () => router.push("/appointments/workflows"))}
        {item("Meetings", <Video size={16} strokeWidth={2} />, false, () => router.push("/meetings"))}
        {item("Payments", <CreditCard size={16} strokeWidth={2} />, false, () => router.push("/payments/transactions"))}
        {item("Analytics", <BarChart3 size={16} strokeWidth={2} />, false, () => router.push("/appointments/analytics"))}
        {item("Integrations", <Plug size={16} strokeWidth={2} />, false, () => router.push("/integrations/calendars"))}
      </nav>
      <div className="tv-nav-bottom">
        {item("Notifications", <Bell size={16} strokeWidth={2} />)}
        {item("Help", <LifeBuoy size={16} strokeWidth={2} />, false, () => router.push("/getting-started"))}
        {item("Settings", <Settings size={16} strokeWidth={2} />, false, () => router.push("/settings/business"))}
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
            <div className="tv-user-plan">Appointments</div>
          </div>
          <ChevronsLeft size={14} style={{ color: "#a3a8bf", flexShrink: 0 }} />
        </div>
      </div>
    </aside>
  );
}
