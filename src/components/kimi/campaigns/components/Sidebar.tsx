/** @deprecated Unused Kimi scaffold sidebar — app shell provides navigation. */
"use client";
import { Home, Users, Megaphone, Inbox, Workflow, BarChart3, Wrench, Bell, HelpCircle, ChevronRight, ChevronDown, Zap } from "lucide-react";

export default function Sidebar({ active }: { active: string }) {
  return (
    <aside className="tv-sidebar h-screen sticky top-0 bg-white border-r border-slate-200 flex flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-[17px] text-slate-900">Transovo</span>
      </div>
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        <div className="nav-item"><Home className="w-4 h-4" /> Home <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400" /></div>
        <div className="nav-item"><Users className="w-4 h-4" /> Audience <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400" /></div>
        <div className={`nav-item ${active === "campaigns" ? "active" : ""}`}><Megaphone className="w-4 h-4" /> Campaigns</div>
        <div className="nav-item"><Inbox className="w-4 h-4" /> Inbox</div>
        <div className="nav-item"><Workflow className="w-4 h-4" /> Workflows</div>
        <div className="nav-item"><BarChart3 className="w-4 h-4" /> Analytics <ChevronDown className="w-3.5 h-3.5 ml-auto text-slate-400" /></div>
        <div className="sub-item">Audience</div>
        <div className={`sub-item ${active === "campaigns" ? "active" : ""}`}>Campaigns</div>
        <div className="sub-item">Inbox</div>
        <div className="sub-item">Workflows</div>
        <div className="sub-item">Messaging</div>
        <div className="nav-item mt-1"><Wrench className="w-4 h-4" /> Tools <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400" /></div>
      </nav>
      <div className="px-3 pb-2 space-y-0.5">
        <div className="nav-item"><Bell className="w-4 h-4" /> Notifications <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400" /></div>
        <div className="nav-item"><HelpCircle className="w-4 h-4" /> Help <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400" /></div>
      </div>
      <div className="mx-3 mb-3 rounded-xl border border-slate-200 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">Message Credits</span>
          <button className="text-[11px] font-semibold text-indigo-600">Upgrade</button>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 w-1/2 rounded-full bg-indigo-500" /></div>
        <p className="mt-1.5 text-[11px] text-slate-500">100,046 Credits Remaining</p>
      </div>
      <div className="flex items-center gap-2.5 px-4 py-3 border-t border-slate-200">
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">JD</div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-800 truncate">John Doe</p>
          <p className="text-[11px] text-slate-500 truncate">Transovo Tutorials</p>
        </div>
      </div>
    </aside>
  );
}
