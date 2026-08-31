"use client";
import React, { useEffect, useRef, useState } from "react";
import { Home, Users, Megaphone, Inbox as InboxIcon, Workflow, BarChart3, Wrench, Bell, LifeBuoy, ChevronDown, Zap, MessageSquare, UserCog, Settings2, LogOut } from "lucide-react";
import { NAV } from "../mock-data";

const ICONS: Record<string, React.ReactNode> = {
  home: <Home size={17} />, users: <Users size={17} />, megaphone: <Megaphone size={17} />,
  inbox: <InboxIcon size={17} />, workflow: <Workflow size={17} />, chart: <BarChart3 size={17} />, wrench: <Wrench size={17} />,
};

export default function AppSidebar({ onOpenSettings }:{ onOpenSettings?: ()=>void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <aside style={{ width: 216, background: "#fff", borderRight: "1px solid var(--tv-border)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 16px 12px" }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: "linear-gradient(135deg,#14b8a6,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MessageSquare size={14} color="#fff" fill="#fff" />
        </div>
        <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: -0.3 }}>Transovo</span>
      </div>
      <nav className="ref-scroll" style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
        {NAV.map((n) => {
          const active = n.label === "Inbox";
          return (
            <div key={n.label}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 7,
                fontSize: 13.5, fontWeight: active ? 600 : 500, cursor: "pointer",
                background: active ? "#eef2ff" : "transparent", color: active ? "var(--tv-primary)" : "#374151",
              }}>
                <span style={{ color: active ? "var(--tv-primary)" : "#6b7280", display: "flex" }}>{ICONS[n.icon]}</span>
                <span style={{ flex: 1 }}>{n.label}</span>
                {n.badge ? <span style={{ background: "var(--tv-primary)", color: "#fff", fontSize: 10.5, fontWeight: 700, borderRadius: 9999, padding: "1px 7px" }}>{n.badge}</span> : null}
                {n.children ? <ChevronDown size={13} color="#9ca3af" /> : null}
              </div>
              {n.children && (
                <div style={{ paddingLeft: 37 }}>
                  {n.children.map((c) => (
                    <div key={c} style={{ padding: "5px 0", fontSize: 13, color: "#4b5563", cursor: "pointer" }}>{c}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div style={{ borderTop: "1px solid var(--tv-border)", padding: "8px 12px" }}>
        {[{ i: <Bell size={15} />, t: "Notifications" }, { i: <LifeBuoy size={15} />, t: "Support" }].map((x) => (
          <div key={x.t} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 6px", fontSize: 13, color: "#4b5563", cursor: "pointer" }}>{x.i}{x.t}</div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0", padding: "8px", background: "#f9fafb", borderRadius: 8, border: "1px solid var(--tv-border)" }}>
          <Zap size={14} color="var(--tv-primary)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>Message Credits</div>
            <div style={{ fontSize: 11.5, fontWeight: 600 }}>7,082 Remaining</div>
          </div>
          <span style={{ fontSize: 11, color: "var(--tv-primary)", fontWeight: 700, cursor: "pointer" }}>Upgrade</span>
        </div>
        <div ref={menuRef} style={{ position: "relative" }}>
          <div onClick={() => setMenuOpen(!menuOpen)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px", borderRadius: 8, cursor: "pointer", background: menuOpen ? "#f3f4f6" : "transparent" }}>
            <span className="tv-avatar" style={{ width: 26, height: 26, fontSize: 10, background: "#4f46e5" }}>JD</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>John Doe</div>
              <div style={{ fontSize: 10.5, color: "#6b7280" }}>Transovo Tutorials</div>
            </div>
          </div>
          {menuOpen && (
            <div className="ref-pop" style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, width: 190, background: "#fff", border: "1px solid var(--tv-border)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.12)", padding: 6, zIndex: 60 }}>
              {[
                { i: <UserCog size={14} color="#6b7280" />, t: "Manage Profile", fn: () => setMenuOpen(false) },
                { i: <Settings2 size={14} color="#6b7280" />, t: "Inbox Settings", fn: () => { setMenuOpen(false); onOpenSettings?.(); } },
                { i: <LogOut size={14} color="#6b7280" />, t: "Log Out", fn: () => setMenuOpen(false) },
              ].map((x) => (
                <div key={x.t} onClick={x.fn} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", fontSize: 13, color: "#374151", borderRadius: 6, cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")} onMouseLeave={(e) => (e.currentTarget.style.background = "")}>{x.i}{x.t}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
