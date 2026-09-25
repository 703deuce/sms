import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Standard Transovo product page — Pass 3 surface-first canvas. */
export function TransovoProductPage({
  children,
  className,
  narrow,
}: {
  children: ReactNode;
  className?: string;
  narrow?: boolean;
}) {
  return (
    <div className="transovo-product-canvas transovo-product-surface-first min-h-full">
      <div
        className={cn(
          "transovo-page-container transovo-page-stack",
          narrow && "transovo-page-container--narrow",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
