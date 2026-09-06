"use client";
import { Calendar, Users, MessageSquare, Workflow, Video, CreditCard, BarChart3, Plug, Settings, LifeBuoy, Zap, ChevronDown, CalendarDays } from "lucide-react";

export type Page = "lists" | "createList" | "contacts" | "tools" | "keyword";

interface Props {
  page: Page;
  navigate: (p: Page) => void;
}

export default function Sidebar({ page, navigate }: Props) {
  const contactsActive = page === "contacts" || page === "lists" || page === "createList";
  return (
    <aside className="w-[216px] shrink-0 h-screen sticky top-0 border-r border-[#eceef5] bg-white flex flex-col">
      <div className="flex items-center gap-2 px-4 h-[56px] border-b border-[#eceef5]">
        <div className="w-7 h-7 rounded-lg bg-[#3b4ef5] flex items-center justify-center">
          <Zap size={15} className="text-white" fill="white" />
        </div>
        <span className="font-bold text-[16px] text-[#0f1b3d]">Transovo</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5" aria-label="Main navigation">
        <div className="sidebar-link"><Calendar size={16} /> Home</div>
        <div className="sidebar-link"><CalendarDays size={16} /> Appointments</div>
        <div className="sidebar-link"><Users size={16} /> Booking</div>
        <div className={`sidebar-link ${contactsActive ? "active-parent" : ""}`} aria-expanded="true">
          <Users size={16} /> Contacts <ChevronDown size={13} className="ml-auto" />
        </div>
        <div className="ml-4 pl-3 border-l border-[#eceef5] space-y-0.5 py-1">
          <div className={`sidebar-link ${page === "contacts" ? "active" : ""}`} onClick={() => navigate("contacts")} aria-current={page === "contacts" ? "page" : undefined}>All Contacts</div>
          <div className={`sidebar-link ${page === "lists" || page === "createList" ? "active" : ""}`} onClick={() => navigate("lists")} aria-current={page === "lists" || page === "createList" ? "page" : undefined}>Lists</div>
          <div className="sidebar-link">Segments</div>
          <div className="sidebar-link">Imports</div>
        </div>
        <div className="sidebar-link"><MessageSquare size={16} /> Messages</div>
        <div className="sidebar-link"><Workflow size={16} /> Automations</div>
        <div className="sidebar-link"><Video size={16} /> Meetings</div>
        <div className="sidebar-link"><CreditCard size={16} /> Payments</div>
        <div className="sidebar-link"><BarChart3 size={16} /> Analytics</div>
        <div className="sidebar-link"><Plug size={16} /> Integrations</div>
        <div className="sidebar-link"><Settings size={16} /> Settings</div>
      </nav>
      <div className="px-2.5 pb-2">
        <div className="sidebar-link"><LifeBuoy size={16} /> Help</div>
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
