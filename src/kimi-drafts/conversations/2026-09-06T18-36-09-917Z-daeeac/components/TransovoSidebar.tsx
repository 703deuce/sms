"use client";

import { useState } from "react";
import {
  Bell,
  LifeBuoy,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
  ChevronUp,
} from "lucide-react";
import { NAV_ITEMS, MOCK_USER, MOCK_CREDITS, type NavItem } from "../mock-data";

interface TransovoSidebarProps {
  defaultCollapsed?: boolean;
  defaultActiveId?: string;
  onNavigate?: (href: string) => void;
}

function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2 overflow-hidden">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
        <Zap className="h-4 w-4" strokeWidth={2.5} />
      </div>
      {!compact && (
        <span className="whitespace-nowrap text-[15px] font-semibold tracking-tight text-foreground">
          Transovo
        </span>
      )}
    </div>
  );
}

function Badge({ count }: { count: number }) {
  return (
    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold leading-none text-white">
      {count}
    </span>
  );
}

export default function TransovoSidebar({
  defaultCollapsed = false,
  defaultActiveId = "inbox",
  onNavigate,
}: TransovoSidebarProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [activeId, setActiveId] = useState(defaultActiveId);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    audience: true,
  });
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const usedPct = Math.round(
    ((MOCK_CREDITS.total - MOCK_CREDITS.remaining) / MOCK_CREDITS.total) * 100
  );

  const handleNav = (item: NavItem) => {
    setActiveId(item.id);
    if (item.children && !collapsed) {
      setOpenGroups((s) => ({ ...s, [item.id]: !s[item.id] }));
    }
    onNavigate?.(item.href);
  };

  /* ---------------- Collapsed icon rail ---------------- */
  if (collapsed) {
    return (
      <aside className="tv-sidebar flex h-screen w-14 flex-col items-center border-r border-border bg-card py-3">
        <div className="mb-2">
          <Logo compact />
        </div>

        <nav className="flex flex-1 flex-col items-center gap-1 pt-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item)}
                title={item.label}
                className={`tv-icon-btn relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground ${
                  active ? "active" : ""
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.badge ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-indigo-600 px-0.5 text-[9px] font-bold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="flex flex-col items-center gap-1">
          <button
            title="Notifications"
            className="tv-icon-btn relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground"
          >
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-indigo-600" />
          </button>
          <button
            title="Support"
            className="tv-icon-btn flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground"
          >
            <LifeBuoy className="h-[18px] w-[18px]" />
          </button>
          <button
            title={MOCK_USER.name}
            className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700"
          >
            {MOCK_USER.initials}
          </button>
          <button
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
            className="tv-icon-btn mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      </aside>
    );
  }

  /* ---------------- Expanded sidebar ---------------- */
  return (
    <aside className="tv-sidebar flex h-screen w-[228px] flex-col border-r border-border bg-card">
      {/* Brand row */}
      <div className="flex h-14 items-center justify-between px-4">
        <Logo />
        <button
          onClick={() => setCollapsed(true)}
          title="Collapse sidebar"
          className="tv-icon-btn flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeId === item.id;
          const expanded = !!openGroups[item.id];
          return (
            <div key={item.id}>
              <button
                onClick={() => handleNav(item)}
                className={`tv-nav-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-muted-foreground ${
                  active ? "active" : ""
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate text-left">{item.label}</span>
                {item.badge ? <Badge count={item.badge} /> : null}
                {item.children ? (
                  expanded ? (
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                  )
                ) : null}
              </button>
              {item.children && expanded && (
                <div className="ml-[26px] space-y-0.5 border-l border-border pl-2 pt-0.5">
                  {item.children.map((child) => (
                    <button
                      key={child.href}
                      onClick={() => onNavigate?.(child.href)}
                      className="tv-nav-item flex w-full items-center rounded-md px-2.5 py-1.5 text-[12.5px] text-muted-foreground"
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="space-y-0.5 border-t border-border px-2 py-2">
        <button className="tv-nav-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-muted-foreground">
          <Bell className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Notifications</span>
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
        </button>
        <button className="tv-nav-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-muted-foreground">
          <LifeBuoy className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Support</span>
        </button>
      </div>

      {/* Message credits widget */}
      <div className="mx-3 mb-2 rounded-lg border border-border bg-muted/40 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground">
            Message Credits
          </span>
          <button className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">
            <Zap className="h-3 w-3" />
            Upgrade
          </button>
        </div>
        <div className="mt-2 tv-credits-bar">
          <div className="tv-credits-fill" style={{ width: `${usedPct}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {MOCK_CREDITS.remaining.toLocaleString()} Credits Remaining
        </p>
      </div>

      {/* User profile */}
      <div className="border-t border-border px-3 py-2.5">
        <button
          onClick={() => setUserMenuOpen((s) => !s)}
          className="tv-nav-item flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">
            {MOCK_USER.initials}
          </span>
          <span className="flex-1 overflow-hidden text-left">
            <span className="block truncate text-[13px] font-medium text-foreground">
              {MOCK_USER.name}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {MOCK_USER.plan}
            </span>
          </span>
          <ChevronUp
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
              userMenuOpen ? "" : "rotate-180"
            }`}
          />
        </button>
        {userMenuOpen && (
          <div className="mt-1 space-y-0.5 rounded-lg border border-border bg-card p-1 shadow-sm">
            {["Profile", "Settings", "Log Out"].map((label) => (
              <button
                key={label}
                className="tv-nav-item flex w-full rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-muted-foreground"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
