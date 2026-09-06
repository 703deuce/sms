"use client";

import { settingsTabs } from "../mock-data";

export function SettingsTabs() {
  return (
    <div className="tv-tabs" role="tablist" aria-label="Settings">
      {settingsTabs.map((t) => (
        <button
          key={t.href}
          role="tab"
          aria-selected={t.label === "Billing"}
          className={t.label === "Billing" ? "tv-tab active" : "tv-tab"}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
