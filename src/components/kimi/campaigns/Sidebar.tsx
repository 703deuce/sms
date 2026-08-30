"use client";
import { Home, Users, Megaphone, Inbox, Workflow, BarChart2, Wrench, Bell, HelpCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

const analyticsSubs = ["Audience", "Campaigns", "Inbox", "Workflows", "Messaging"];

export default function Sidebar() {
  const [open, setOpen] = useState(true);
  const item = (icon: React.ReactNode, label: string, active = false, chevron?: boolean) => (
    <div className={`st-nav-item flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] cursor-pointer text-gray-600 hover:bg-gray-100 ${active ? "active font-medium" : ""}`}>
      {icon}<span className="flex-1">{label}</span>{chevron && <ChevronRight size={14} className="text-gray-400" />}
    </div>
  );
  return (
    <aside className="st-sidebar h-screen bg-white border-r border-border flex flex-col text-foreground">
      <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">T</div>
        <span className="font-semibold text-[15px]">Transovo</span>
      </div>
      <nav className="flex-1 overflow-y-auto st-scroll px-2 py-3 space-y-0.5">
        {item(<Home size={17} />, "Home")}
        {item(<Users size={17} />, "Audience", false, true)}
        {item(<Megaphone size={17} />, "Campaigns", true)}
        {item(<Inbox size={17} />, "Inbox")}
        {item(<Workflow size={17} />, "Workflows")}
        <div>
          <div onClick={() => setOpen(!open)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] cursor-pointer text-gray-600 hover:bg-gray-100">
            <BarChart2 size={17} /><span className="flex-1">Analytics</span>
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`} />
          </div>
          {open && (
            <div className="ml-9 mt-0.5 space-y-0.5">
              {analyticsSubs.map((s) => (
                <div key={s} className={`px-3 py-1.5 rounded-lg text-[13px] cursor-pointer ${s === "Campaigns" ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-500 hover:bg-gray-100"}`}>{s}</div>
              ))}
            </div>
          )}
        </div>
        {item(<Wrench size={17} />, "Tools")}
      </nav>
      <div className="px-2 pb-2 space-y-0.5">
        {item(<Bell size={17} />, "Notifications")}
        {item(<HelpCircle size={17} />, "Help", false, true)}
      </div>
      <div className="px-4 py-3 border-t border-border">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-gray-600">Message Credits</span>
          <span className="text-indigo-600 text-xs cursor-pointer">Upgrade</span>
        </div>
        <div className="text-[11px] text-gray-400 mt-0.5">100,046 Credits Remaining</div>
      </div>
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold">JD</div>
        <div>
          <div className="text-[13px] font-medium">John Doe</div>
          <div className="text-[11px] text-gray-400">Transovo Tutorials</div>
        </div>
      </div>
    </aside>
  );
}
