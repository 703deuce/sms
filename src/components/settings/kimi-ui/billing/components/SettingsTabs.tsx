"use client";

import { settingsTabs } from "../types";

export function SettingsTabs({ items }: { items?: { label: string; href: string }[] }) {
  const tabs = items ?? settingsTabs;
  return (
    <div className="tv-tabs" role="tablist" aria-label="Settings">
      {tabs.map((t) => (
        <a
          key={t.href}
          href={t.href}
          role="tab"
          aria-selected={t.label === "Billing"}
          className={t.label === "Billing" ? "tv-tab active" : "tv-tab"}
        >
          {t.label}
        </a>
      ))}
    </div>
  );
}
