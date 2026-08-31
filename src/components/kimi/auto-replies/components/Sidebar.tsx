"use client";
import React from "react";
import {
  Home, Users, Megaphone, Inbox, Workflow, BarChart3, Wrench,
  Bell, LifeBuoy, Zap, ChevronDown,
} from "lucide-react";

const nav = [
  { icon: Home, label: "Home" },
  { icon: Users, label: "Audience" },
  { icon: Megaphone, label: "Campaigns" },
  { icon: Inbox, label: "Inbox" },
  { icon: Workflow, label: "Workflows" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Wrench, label: "Tools" },
];

export default function Sidebar() {
  return (
    <aside className="tv-sidebar">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}>
          <Zap size={16} color="#fff" />
        </span>
        <span className="text-[17px] font-bold tracking-tight">Transovo</span>
      </div>
      <nav className="mt-1 flex-1 overflow-y-auto">
        {nav.map((n) => (
          <button key={n.label} className="tv-nav-item" type="button">
            <n.icon size={16} />
            {n.label}
            <ChevronDown size={13} className="ml-auto opacity-50" />
          </button>
        ))}
        <div className="mt-6 border-t border-[#eef0f6] pt-4">
          <button className="tv-nav-item" type="button"><Bell size={16} />Notifications</button>
          <button className="tv-nav-item" type="button"><LifeBuoy size={16} />Support</button>
        </div>
      </nav>
      <div className="border-t border-[#eef0f6] px-4 py-3">
        <div className="flex items-center justify-between px-2 pb-3">
          <div>
            <div className="text-xs font-semibold">Message Credits</div>
            <div className="text-[11px] tv-muted">7,120 Credits Remaining</div>
          </div>
          <button className="text-[11px] font-semibold" style={{ color: "#4f46e5" }}>Upgrade</button>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-[#f4f5fa] cursor-pointer">
          <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "#4f46e5" }}>JD</span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">John Doe</div>
            <div className="truncate text-[11px] tv-muted">Transovo</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
