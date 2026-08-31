"use client";

import {
  Home,
  Users,
  Megaphone,
  Inbox,
  Workflow,
  BarChart3,
  Wrench,
  Bell,
  LifeBuoy,
  Zap,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";

const nav = [
  { icon: Home, label: "Home" },
  { icon: Users, label: "Audience", chevron: true },
  { icon: Megaphone, label: "Campaigns", chevron: true },
  { icon: Inbox, label: "Inbox" },
  { icon: Workflow, label: "Workflows" },
  { icon: BarChart3, label: "Analytics", chevron: true },
  { icon: Wrench, label: "Tools", active: true },
];

export default function Sidebar() {
  return (
    <aside
      style={{
        width: 232,
        flexShrink: 0,
        background: "#fff",
        borderRight: "1px solid #e9ebf4",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
      }}
    >
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 20px 14px" }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: "linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Zap size={16} color="#fff" fill="#fff" />
        </div>
        <span style={{ fontSize: 16.5, fontWeight: 800, color: "#1f2440", letterSpacing: -0.3 }}>
          Transovo
        </span>
      </div>

      {/* Nav */}
      <nav style={{ padding: "4px 10px", flex: 1 }}>
        {nav.map((item) => (
          <button
            key={item.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              width: "100%",
              border: "none",
              background: item.active ? "#eef0fd" : "transparent",
              color: item.active ? "#4f46e5" : "#4a5070",
              fontSize: 13.5,
              fontWeight: item.active ? 700 : 500,
              padding: "9px 12px",
              borderRadius: 8,
              cursor: "pointer",
              marginBottom: 2,
              textAlign: "left",
            }}
          >
            <item.icon size={17} strokeWidth={item.active ? 2.4 : 2} />
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.chevron && <ChevronRight size={14} color="#a3a8c0" />}
          </button>
        ))}
      </nav>

      {/* Bottom section */}
      <div style={{ padding: "8px 10px 12px", borderTop: "1px solid #f0f1f8" }}>
        <button
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            width: "100%",
            border: "none",
            background: "transparent",
            color: "#4a5070",
            fontSize: 13.5,
            fontWeight: 500,
            padding: "9px 12px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          <Bell size={17} /> Notifications
        </button>
        <button
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            width: "100%",
            border: "none",
            background: "transparent",
            color: "#4a5070",
            fontSize: 13.5,
            fontWeight: 500,
            padding: "9px 12px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          <LifeBuoy size={17} /> Support
        </button>

        {/* Credits */}
        <div style={{ padding: "12px 12px 10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#3c4260" }}>Message Credits</span>
            <button style={{ border: "none", background: "transparent", color: "#4f46e5", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
              <Zap size={11} /> Upgrade
            </button>
          </div>
          <div style={{ height: 5, borderRadius: 99, background: "#eceef6", overflow: "hidden" }}>
            <div style={{ width: "42%", height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#4f46e5,#8b5cf6)" }} />
          </div>
          <div style={{ fontSize: 11, color: "#8a8fa8", marginTop: 5 }}>5,881 Credits Remaining</div>
        </div>

        {/* User */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px 2px",
            borderTop: "1px solid #f0f1f8",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: "#4f46e5",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            JD
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1f2440" }}>John Doe</div>
            <div style={{ fontSize: 11, color: "#8a8fa8" }}>Transovo Tutorials</div>
          </div>
          <MoreHorizontal size={16} color="#a3a8c0" />
        </div>
      </div>
    </aside>
  );
}
