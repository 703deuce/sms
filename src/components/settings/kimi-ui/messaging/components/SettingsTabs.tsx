"use client";

type Tab = { label: string; href: string };

export function SettingsTabs({ items, active }: { items: Tab[]; active: string }) {
  return (
    <nav className="ref-tabs" aria-label="Settings">
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className={`ref-tab${item.href === active ? " active" : ""}`}
          aria-current={item.href === active ? "page" : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
