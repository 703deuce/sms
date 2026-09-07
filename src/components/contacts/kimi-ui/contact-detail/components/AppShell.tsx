"use client";

import React from "react";
import {
  Calendar,
  CalendarClock,
  Users,
  MessageSquare,
  Workflow,
  Video,
  CreditCard,
  BarChart3,
  Blocks,
  Settings,
  LayoutDashboard,
  Search,
  Bell,
  LifeBuoy,
} from "lucide-react";
import { cn } from "./ui";

const NAV = [
  { label: "Home", icon: LayoutDashboard },
  { label: "Appointments", icon: CalendarClock },
  { label: "Booking", icon: Calendar },
  { label: "Contacts", icon: Users },
  { label: "Messages", icon: MessageSquare, badge: 2 },
  { label: "Automations", icon: Workflow },
  { label: "Meetings", icon: Video },
  { label: "Payments", icon: CreditCard },
  { label: "Analytics", icon: BarChart3 },
];

const NAV_BOTTOM = [
  { label: "Integrations", icon: Blocks },
  { label: "Settings", icon: Settings },
];

export function AppShell({
  children,
  activeNav,
}: {
  children: React.ReactNode;
  activeNav: string;
}) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 232,
          flexShrink: 0,
          background: "var(--card)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "16px 18px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "var(--primary)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            T
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>Transovo</span>
        </div>

        <nav style={{ flex: 1, padding: "10px 10px", overflowY: "auto" }}>
          {NAV.map((item) => {
            const active = item.label === activeNav;
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href="#"
                aria-current={active ? "page" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 10px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  color: active ? "var(--primary)" : "var(--muted-foreground)",
                  background: active ? "rgba(67,56,202,0.08)" : "transparent",
                  textDecoration: "none",
                  marginBottom: 2,
                }}
              >
                <Icon style={{ width: 16, height: 16 }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge ? (
                  <span
                    style={{
                      background: "var(--primary)",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 999,
                      padding: "1px 7px",
                    }}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </a>
            );
          })}

          <div
            style={{
              margin: "14px 10px 6px",
              borderTop: "1px solid var(--border)",
              paddingTop: 12,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--muted-foreground)",
              textTransform: "uppercase",
            }}
          >
            Workspace
          </div>
          {NAV_BOTTOM.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href="#"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 10px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--muted-foreground)",
                  textDecoration: "none",
                  marginBottom: 2,
                }}
              >
                <Icon style={{ width: 16, height: 16 }} />
                {item.label}
              </a>
            );
          })}
        </nav>

        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: "#e0e7ff",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            DC
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Dana Cole</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--muted-foreground)" }}>Brookside Services</p>
          </div>
        </div>
      </aside>

      {/* Main region */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Global header */}
        <header
          style={{
            height: 52,
            flexShrink: 0,
            background: "var(--card)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 20px",
            position: "sticky",
            top: 0,
            zIndex: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--muted)",
              borderRadius: 8,
              padding: "6px 12px",
              width: 300,
              color: "var(--muted-foreground)",
              fontSize: 13,
            }}
          >
            <Search style={{ width: 14, height: 14 }} />
            <span>Search contacts, appointments…</span>
          </div>
          <div style={{ flex: 1 }} />
          <button
            className="btn btn-ghost"
            aria-label="Notifications"
            style={{ padding: 7 }}
          >
            <Bell style={{ width: 16, height: 16 }} />
          </button>
          <button className="btn btn-ghost" aria-label="Help" style={{ padding: 7 }}>
            <LifeBuoy style={{ width: 16, height: 16 }} />
          </button>
        </header>

        <main style={{ flex: 1 }}>{children}</main>
      </div>
    </div>
  );
}
