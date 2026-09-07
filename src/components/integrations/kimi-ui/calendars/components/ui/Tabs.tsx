"use client";

import { cn } from "./cn";

export function Tabs({
  items,
  activeHref,
  onNavigate,
}: {
  items: Array<{ label: string; href: string; badge?: string | number }>;
  activeHref: string;
  onNavigate?: (href: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Integrations"
      className="mb-6 flex flex-wrap gap-1 overflow-x-auto border-b border-[var(--border)]"
    >
      {items.map((item) => {
        const active = activeHref === item.href;
        return (
          <button
            key={item.href}
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            onClick={() => onNavigate?.(item.href)}
            className={cn(
              "-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-semibold transition-colors",
              active
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted-foreground)] hover:border-[var(--border)] hover:text-[var(--foreground)]",
            )}
          >
            {item.label}
            {item.badge != null ? (
              <span className="rounded-full bg-[var(--info-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--info-text)]">
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
