"use client";
import { Home, Users, Megaphone, Inbox, Workflow, BarChart2, Wrench, Bell, HelpCircle, ChevronRight, ChevronDown, Zap } from "lucide-react";
import { useState } from "react";

const nav = [
  { icon: Home, label: "Home" },
  { icon: Users, label: "Audience", chevron: true },
  { icon: Megaphone, label: "Campaigns", active: true },
  { icon: Inbox, label: "Inbox" },
  { icon: Workflow, label: "Workflows" },
];

const analyticsSub = ["Audience", "Campaigns", "Inbox", "Workflows", "Messaging"];

export default function Sidebar() {
  const [open, setOpen] = useState(true);
  return (
    <aside className="w-[216px] shrink-0 bg-white border-r border-[#e6e9f0] flex flex-col py-4 sticky top-0 h-screen">
      <div className="flex items-center gap-2 px-5 mb-6">
        <div className="w-6 h-6 rounded-md bg-[#3f4bd8] flex items-center justify-center">
          <Zap size={13} className="text-white" fill="currentColor" />
        </div>
        <span className="font-bold text-[17px] tracking-tight text-[#1a1f36]">Transovo</span>
      </div>
      <nav className="flex-1 px-3 space-y-0.5 text-[13.5px]">
        {nav.map((n) => (
          <button key={n.label} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors ${n.active ? "bg-[#eef0fd] text-[#3f4bd8]" : "text-[#4a5068] hover:bg-[#f5f6fa]"}`}>
            <n.icon size={17} strokeWidth={n.active ? 2.2 : 1.8} />
            {n.label}
            {n.chevron && <ChevronRight size={14} className="ml-auto text-[#9aa1b5]" />}
          </button>
        ))}
        <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-[#4a5068] hover:bg-[#f5f6fa]">
          <BarChart2 size={17} strokeWidth={1.8} />
          Analytics
          <ChevronDown size={14} className={`ml-auto text-[#9aa1b5] transition-transform ${open ? "" : "-rotate-90"}`} />
        </button>
        {open && (
          <div className="ml-9 space-y-0.5 text-[13px]">
            {analyticsSub.map((s) => (
              <button key={s} className="block w-full text-left px-3 py-1.5 rounded-md text-[#6b7288] hover:text-[#1a1f36] hover:bg-[#f5f6fa]">{s}</button>
            ))}
          </div>
        )}
        <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-[#4a5068] hover:bg-[#f5f6fa]">
          <Wrench size={17} strokeWidth={1.8} />
          Tools
          <ChevronRight size={14} className="ml-auto text-[#9aa1b5]" />
        </button>
        <div className="pt-3 mt-3 border-t border-[#eef0f5] space-y-0.5">
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-[#4a5068] hover:bg-[#f5f6fa]"><Bell size={17} strokeWidth={1.8} />Notifications</button>
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-[#4a5068] hover:bg-[#f5f6fa]"><HelpCircle size={17} strokeWidth={1.8} />Help<ChevronRight size={14} className="ml-auto text-[#9aa1b5]" /></button>
        </div>
      </nav>
      <div className="px-5 pt-4 border-t border-[#eef0f5]">
        <div className="flex items-center justify-between text-[12px] font-semibold text-[#1a1f36]">
          <span>Message Credits</span>
          <button className="text-[#3f4bd8] font-semibold text-[11px]">Upgrade</button>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-[#eef0f5] overflow-hidden"><div className="h-full w-[62%] bg-[#3f4bd8] rounded-full" /></div>
        <p className="text-[11px] text-[#6b7288] mt-1">100,046 Credits Remaining</p>
        <div className="flex items-center gap-2 mt-4">
          <div className="w-7 h-7 rounded-full bg-[#3f4bd8] text-white text-[11px] font-bold flex items-center justify-center">JD</div>
          <div>
            <p className="text-[12px] font-semibold text-[#1a1f36]">John Doe</p>
            <p className="text-[10.5px] text-[#6b7288]">Transovo Tutorials</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
