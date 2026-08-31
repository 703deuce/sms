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
    <aside className="st-sidebar">
      <div className="st-logo">
        <div className="st-logo-mark">
          <Zap size={18} strokeWidth={2.5} />
        </div>
        <span className="st-logo-text">Transovo</span>
      </div>

      <nav className="st-nav">
        {nav.map((item) => (
          <button key={item.label} className={`st-nav-item ${item.active ? 'active' : ''}`}>
            <item.icon size={17} />
            <span>{item.label}</span>
            <ChevronRight size={14} className="st-nav-chevron" />
          </button>
        ))}
      </nav>

      <div className="st-sidebar-footer">
        <button className="st-nav-item">
          <Bell size={17} />
          <span>Notifications</span>
        </button>
        <button className="st-nav-item">
          <LifeBuoy size={17} />
          <span>Support</span>
        </button>
        <div className="st-credits">
          <div className="st-credits-row">
            <span>Message Credits</span>
            <span className="st-upgrade">⚡ Upgrade</span>
          </div>
          <div className="st-credits-bar">
            <div className="st-credits-fill" />
          </div>
          <span className="st-credits-count">5,884 Credits Remaining</span>
        </div>
        <div className="st-user">
          <div className="st-avatar">JD</div>
          <div className="st-user-info">
            <span className="st-user-name">John Doe</span>
            <span className="st-user-sub">Transovo Tutorials</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
