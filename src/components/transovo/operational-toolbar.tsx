import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Compact search + period/filter row for operational pages (Pass 2A).
 * Extend this pattern — do not duplicate per page without cause.
 */
export function TransovoOperationalToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("transovo-operational-toolbar", className)}>{children}</div>
  );
}
