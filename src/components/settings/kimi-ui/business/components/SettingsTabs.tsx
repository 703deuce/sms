"use client";

import { settingsTabs } from "../types";

export default function SettingsTabs({
  active,
  items,
}: {
  active: string;
  items?: { label: string; href: string }[];
}) {
  const tabs = items ?? settingsTabs;
  return (
    <div className="tabs" role="tablist" aria-label="Settings">
      {tabs.map((tab) => {
        const isActive = tab.label === active;
        return (
          <a
            key={tab.label}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={`tab ${isActive ? "tab-active" : ""}`}
          >
            {tab.label}
          </a>
        );
      })}
    </div>
  );
}
