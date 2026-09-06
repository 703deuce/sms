"use client";

import { settingsTabs } from "../mock-data";

export default function SettingsTabs({ active }: { active: string }) {
  return (
    <div className="tabs" role="tablist" aria-label="Settings">
      {settingsTabs.map((tab) => {
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
