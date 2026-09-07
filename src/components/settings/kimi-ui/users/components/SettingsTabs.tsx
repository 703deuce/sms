"use client";

import { SETTINGS_TABS } from "../types";

export function SettingsTabs({
  active,
  items,
}: {
  active: string;
  items?: { label: string; href: string }[];
}) {
  const tabs = items ?? SETTINGS_TABS;
  return (
    <nav
      aria-label="Settings"
      style={{
        display: "flex",
        gap: 2,
        borderBottom: "1px solid var(--border)",
        marginBottom: 20,
        overflowX: "auto",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.label === active;
        return (
          <a
            key={tab.label}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            style={{
              padding: "9px 14px",
              fontSize: 13,
              fontWeight: isActive ? 650 : 500,
              color: isActive ? "var(--accent)" : "var(--text-secondary)",
              textDecoration: "none",
              borderBottom: isActive
                ? "2px solid var(--accent)"
                : "2px solid transparent",
              marginBottom: -1,
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </a>
        );
      })}
    </nav>
  );
}
