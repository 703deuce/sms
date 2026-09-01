'use client'

import {
  Home, Users, Megaphone, Inbox, Workflow, BarChart3, Wrench,
  Bell, LifeBuoy, ChevronRight, Zap,
} from 'lucide-react'

const nav = [
  { label: 'Home', icon: Home, active: false },
  { label: 'Audience', icon: Users, active: false },
  { label: 'Campaigns', icon: Megaphone, active: true },
  { label: 'Inbox', icon: Inbox, active: false },
  { label: 'Workflows', icon: Workflow, active: false },
  { label: 'Analytics', icon: BarChart3, active: false },
  { label: 'Tools', icon: Wrench, active: false },
]

export default function Sidebar() {
  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Zap size={15} strokeWidth={2.5} />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-foreground">Transovo</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
        {nav.map((item) => (
          <button
            key={item.label}
            className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition ${
              item.active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <item.icon size={16} className={item.active ? 'text-primary' : ''} />
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronRight
              size={13}
              className="text-muted-foreground/50 opacity-0 transition group-hover:opacity-100"
            />
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="space-y-0.5 border-t border-border px-2.5 py-3">
        <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
          <Bell size={16} />
          <span>Notifications</span>
        </button>
        <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
          <LifeBuoy size={16} />
          <span>Support</span>
        </button>

        <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Message Credits</span>
            <button className="text-[11px] font-semibold text-primary transition hover:text-primary/80">
              Upgrade
            </button>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
            <div className="h-full w-[58%] rounded-full bg-primary" />
          </div>
          <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
            5,884 Credits Remaining
          </p>
        </div>

        <div className="mt-2 flex items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-muted">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            JD
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-foreground">John Doe</p>
            <p className="truncate text-[11px] text-muted-foreground">Transovo Tutorials</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
