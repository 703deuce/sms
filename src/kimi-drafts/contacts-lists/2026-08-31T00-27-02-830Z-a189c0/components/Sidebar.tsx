"use client";
import { Home, Users, Megaphone, Inbox, Workflow, BarChart3, Wrench, Bell, LifeBuoy, ChevronDown, Zap } from "lucide-react";

export type Page = "lists" | "createList" | "contacts" | "tools" | "keyword";

interface Props {
  page: Page;
  navigate: (p: Page) => void;
}

export default function Sidebar({ page, navigate }: Props) {
  const audienceOpen = true;
  return (
    <aside className="w-[210px] shrink-0 h-screen sticky top-0 border-r border-[#eceef5] bg-white flex flex-col">
      <div className="flex items-center gap-2 px-4 h-[56px] border-b border-[#eceef5]">
        <div className="w-7 h-7 rounded-lg bg-[#3b4ef5] flex items-center justify-center">
          <Zap size={15} className="text-white" fill="white" />
        </div>
        <span className="font-bold text-[16px] text-[#0f1b3d]">Transovo</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
        <div className="sidebar-link"><Home size={16} /> Home</div>
        <div className="sidebar-link active-parent">
          <div className="sidebar-link w-full" style={{ padding: 0 }}>
            <Users size={16} /> Audience <ChevronDown size={13} className="ml-auto" />
          </div>
        </div>
        {audienceOpen && (
          <div className="ml-4 pl-3 border-l border-[#eceef5] space-y-0.5 py-1">
            <div className={`sidebar-link ${page === "contacts" ? "active" : ""}`} onClick={() => navigate("contacts")}>Contacts</div>
            <div className={`sidebar-link ${page === "lists" || page === "createList" ? "active" : ""}`} onClick={() => navigate("lists")}>Lists</div>
            <div className="sidebar-link">Segments</div>
          </div>
        )}
        <div className="sidebar-link"><Megaphone size={16} /> Campaigns</div>
        <div className="sidebar-link"><Inbox size={16} /> Inbox</div>
        <div className="sidebar-link"><Workflow size={16} /> Workflows</div>
        <div className="sidebar-link"><BarChart3 size={16} /> Analytics</div>
        <div className={`sidebar-link ${page === "tools" || page === "keyword" ? "active" : ""}`} onClick={() => navigate("tools")}><Wrench size={16} /> Tools</div>
      </nav>
      <div className="px-2.5 pb-2 space-y-0.5">
        <div className="sidebar-link"><Bell size={16} /> Notifications</div>
        <div className="sidebar-link"><LifeBuoy size={16} /> Support</div>
      </div>
      <div className="mx-3 mb-2 rounded-xl bg-[#f6f7fb] p-3">
        <div className="flex items-center justify-between text-[12px] font-semibold text-[#0f1b3d]">
          Message Credits <span className="text-[#3b4ef5] text-[11px] cursor-pointer">Upgrade</span>
        </div>
        <div className="text-[11px] text-[#7a85a8] mt-1">7,120 Credits Remaining</div>
      </div>
      <div className="flex items-center gap-2.5 px-4 py-3 border-t border-[#eceef5]">
        <div className="w-7 h-7 rounded-full bg-[#3b4ef5] text-white text-[11px] font-bold flex items-center justify-center">JD</div>
        <div>
          <div className="text-[12.5px] font-semibold text-[#0f1b3d]">John Doe</div>
          <div className="text-[10.5px] text-[#7a85a8]">Transovo Sandbox</div>
        </div>
      </div>
    </aside>
  );
}
