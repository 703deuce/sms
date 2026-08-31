"use client";

import {
  Home, Users, Megaphone, Inbox, Workflow, BarChart3, Wrench,
  Bell, HelpCircle, ChevronDown, ChevronRight,
} from "lucide-react";

const analyticsSubs = ["Audience", "Campaigns", "Inbox", "Workflows", "Messaging"];

export default function Sidebar({ active }: { active: string }) {
  return (
    <aside className="w-[228px] shrink-0 bg-white border-r border-border flex flex-col h-full">
      <div className="px-4 py-4 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
          <span className="text-white text-sm font-bold">T</span>
        </div>
        <span className="font-bold text-[15px] text-foreground">Transovo</span>
      </div>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        <div className="sidebar-item"><Home size={16} /> Home</div>
        <div className="sidebar-item justify-between">
          <span className="flex items-center gap-3"><Users size={16} /> Audience</span>
          <ChevronRight size={13} />
        </div>
        <div className={`sidebar-item ${active === "campaigns" ? "active" : ""}`}>
          <Megaphone size={16} /> Campaigns
        </div>
        <div className="sidebar-item"><Inbox size={16} /> Inbox</div>
        <div className="sidebar-item"><Workflow size={16} /> Workflows</div>
        <div className="sidebar-item justify-between">
          <span className="flex items-center gap-3"><BarChart3 size={16} /> Analytics</span>
          <ChevronDown size={13} />
        </div>
        <div className="space-y-0.5 pb-1">
          {analyticsSubs.map((s) => (
            <div key={s} className={`sidebar-sub ${s === "Campaigns" && active === "campaigns" ? "active" : ""}`}>
              {s}
            </div>
          ))}
        </div>
        <div className="sidebar-item justify-between">
          <span className="flex items-center gap-3"><Wrench size={16} /> Tools</span>
          <ChevronRight size={13} />
        </div>
        <div className="pt-3 space-y-0.5">
          <div className="sidebar-item"><Bell size={16} /> Notifications</div>
          <div className="sidebar-item justify-between">
            <span className="flex items-center gap-3"><HelpCircle size={16} /> Help</span>
            <ChevronRight size={13} />
          </div>
        </div>
      </nav>

      <div className="px-4 py-3 border-t border-border">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-semibold text-foreground">Message Credits</span>
          <span className="text-indigo-600 font-semibold cursor-pointer">Upgrade</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full w-[70%] bg-indigo-500 rounded-full" />
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">100,046 Credits Remaining</div>
      </div>

      <div className="px-4 py-3 border-t border-border flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
          JD
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-foreground truncate">John Doe</div>
          <div className="text-[11px] text-muted-foreground truncate">Transovo Tutorials</div>
        </div>
      </div>
    </aside>
  );
}
