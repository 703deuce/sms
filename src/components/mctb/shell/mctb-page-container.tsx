import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MctbPageContainerProps = {
  children: ReactNode;
  className?: string;
  /** Full-bleed workspace (calendar, setup hub) — keeps vertical padding, drops horizontal max-width cap. */
  flush?: boolean;
};

/** Standard MCTB page padding + max-width (shell-level). */
export function MctbPageContainer({ children, className, flush }: MctbPageContainerProps) {
  return (
    <div className="mctb-page-canvas transovo-product-surface-first min-h-full">
      <div
        className={cn(
          "mctb-page-container transovo-page-stack",
          flush && "mctb-page-container--flush",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
