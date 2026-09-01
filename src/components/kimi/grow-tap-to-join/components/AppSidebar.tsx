"use client";

import { useState } from "react";
import {
  Home, Users, Megaphone, Inbox, Workflow, BarChart3, Wrench,
  Bell, HelpCircle, ChevronDown, Zap,
} from "lucide-react";
import { navSections, toolsSubNav, stats } from "../mock-data";

const iconMap: Record<string, any> = { Home, Users, Megaphone, Inbox, Workflow, BarChart3 };

interface Props {
  active: string;
  onNavigate: (key: string) => void;
}

export default function AppSidebar({ active, onNavigate }: Props) {
  const [toolsOpen, setToolsOpen] = useState(true);

  return (
    <aside className="ttj-sidebar">
      <div className="ttj-logo">
        <div className="ttj-logo-mark">
          <Zap size={16} fill="#fff" color="#fff" />
        </div>
        <span className="ttj-logo-text">Transovo</span>
      </div>

      <nav className="ttj-nav">
        {navSections[0].items.map((item) => {
          const Icon = iconMap[item.icon];
          return (
            <button key={item.key} className="ttj-nav-item transition-colors" onClick={() => onNavigate(item.key)}>
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}

        <button
          className="ttj-nav-item ttj-nav-parent transition-colors"
          onClick={() => setToolsOpen(!toolsOpen)}
          aria-expanded={toolsOpen}
        >
          <Wrench size={16} />
          <span>Tools</span>
          <ChevronDown size={14} className={`ttj-chevron transition-transform duration-150 ${toolsOpen ? "open" : ""}`} />
        </button>

        {toolsOpen && (
          <div className="ttj-subnav">
            {toolsSubNav.map((sub) => (
              <button
                key={sub.key}
                className={`ttj-subnav-item transition-colors ${active === sub.key ? "active" : ""}`}
                onClick={() => onNavigate(sub.key)}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}
      </nav>

      <div className="ttj-sidebar-footer">
        <button className="ttj-nav-item transition-colors">
          <Bell size={16} />
          <span>Notifications</span>
          <span className="ttj-badge">8</span>
        </button>
        <button className="ttj-nav-item transition-colors">
          <HelpCircle size={16} />
          <span>Help</span>
        </button>
        <div className="ttj-credits">
          <div className="ttj-credits-row">
            <span>Message Credits</span>
            <button className="ttj-upgrade">Upgrade</button>
          </div>
          <span className="ttj-credits-count">{stats.messageCredits} Credits Remaining</span>
        </div>
        <div className="ttj-user">
          <div className="ttj-avatar">JD</div>
          <div className="ttj-user-info">
            <span className="ttj-user-name">John Doe</span>
            <span className="ttj-user-sub">Transovo Marketing</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
