'use client';
import {
  Home, Users, Megaphone, Inbox, Workflow, BarChart3, Wrench,
  Bell, LifeBuoy, Zap, ChevronRight,
} from 'lucide-react';
import { stats } from '../mock-data';

const nav = [
  { icon: Home, label: 'Home' },
  { icon: Users, label: 'Audience' },
  { icon: Megaphone, label: 'Campaigns' },
  { icon: Inbox, label: 'Inbox' },
  { icon: Workflow, label: 'Workflows' },
  { icon: BarChart3, label: 'Analytics', chevron: true },
  { icon: Wrench, label: 'Tools', active: true },
];

export default function Sidebar() {
  return (
    <aside className="tv-sidebar">
      <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
        <div className="tv-logo">T</div>
        <span className="font-semibold text-foreground">Transovo</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {nav.map((n) => (
          <button key={n.label} className={`tv-nav-item ${n.active ? 'tv-nav-active' : ''}`}>
            <n.icon size={16} />
            <span className="flex-1 text-left">{n.label}</span>
            {n.chevron && <ChevronRight size={14} className="text-muted-foreground" />}
          </button>
        ))}
        <div className="mt-6 border-t border-border pt-3">
          <button className="tv-nav-item"><Bell size={16} /><span>Notifications</span></button>
          <button className="tv-nav-item"><LifeBuoy size={16} /><span>Support</span></button>
        </div>
      </nav>
      <div className="border-t border-border p-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">Message Credits</span>
          <button className="text-xs font-medium text-primary flex items-center gap-1"><Zap size={11} />Upgrade</button>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full w-[30%] rounded-full bg-primary" />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">{stats.creditsRemaining}</p>
        <div className="flex items-center gap-2 mt-3">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">JD</div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">John Doe</p>
            <p className="text-[11px] text-muted-foreground truncate">Transovo</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
