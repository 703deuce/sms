"use client";

export function Tabs({
  items,
  active,
}: {
  items: Array<{ label: string; href: string }>;
  active: string;
}) {
  return (
    <div className="tv-tabs" role="tablist" aria-label="Integrations">
      {items.map((item) => {
        const isActive = item.href === active;
        return (
          <a
            key={item.href}
            href={item.href}
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
            className={`tv-tab ${isActive ? "tv-tab--active" : ""}`}
            onClick={(e) => e.preventDefault()}
          >
            {item.label}
          </a>
        );
      })}
    </div>
  );
}
