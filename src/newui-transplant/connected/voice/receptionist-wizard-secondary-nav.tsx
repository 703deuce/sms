"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export function ReceptionistWizardSecondaryNav<T extends string>({
  items,
  activeId,
  hrefFor,
  ariaLabel,
}: {
  items: Array<{ id: T; label: string }>;
  activeId: T;
  hrefFor: (id: T) => string;
  ariaLabel: string;
}) {
  return (
    <nav aria-label={ariaLabel} className="mb-6 border-b border-border">
      <ul className="flex flex-wrap gap-6">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <Link
                href={hrefFor(item.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex pb-2.5 text-sm transition-colors",
                  active
                    ? "border-b-2 border-primary font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
