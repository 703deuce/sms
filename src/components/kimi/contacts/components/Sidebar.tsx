"use client";
import {
  Home, Users, Megaphone, Inbox, Workflow, BarChart3, Wrench,
  Bell, LifeBuoy, ChevronDown, Zap,
} from "lucide-react";

const nav = [
  { label: "Home", icon: Home },
  { label: "Audience", icon: Users, children: ["Contacts", "Lists", "ChartPie"], active: true },
  { label: "Campaigns", icon: Megaphone },
  { label: "Inbox", icon: Inbox },
  { label: "Workflows", icon: Workflow },
  { label: "Analytics", icon: BarChart3 },
  { label: "Tools", icon: Wrench },
];

export default function Sidebar() {
  return (
    <aside className="w-60 shrink-0 bg-card border-r border-border flex flex-col h-screen sticky top-0">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-border">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
          <Zap className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-lg text-foreground">Transovo</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {nav.map((item) => (
          <div key={item.label}>
            <button
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                item.active ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.children && <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {item.children && (
              <div className="ml-9 mt-0.5 space-y-0.5">
                {item.children.map((c) => (
                  <button
                    key={c}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-sm ${
                      c === "Contacts" ? "text-primary font-semibold bg-accent" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      <div className="px-3 py-2 space-y-0.5 border-t border-border">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent">
          <Bell className="w-4 h-4" /> Notifications
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent">
          <LifeBuoy className="w-4 h-4" /> Support
        </button>
      </div>
      <div className="px-4 py-3 border-t border-border">
        <div className="text-xs text-muted-foreground mb-1">Message Credits</div>
        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full w-[14%] bg-primary rounded-full" />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[11px] text-muted-foreground">7/50 Credits Remaining</span>
          <span className="text-[11px] text-primary font-medium cursor-pointer">Upgrade</span>
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 py-3 border-t border-border">
        <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">JD</div>
        <div>
          <div className="text-sm font-medium text-foreground">John Doe</div>
          <div className="text-[11px] text-muted-foreground">Sign Out</div>
        </div>
      </div>
    </aside>
  );
}
