import { TransovoProductPage } from "@/components/transovo/product-page";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Canonical Voice/MCTB page shell — Pass 3B operational redesign family. */
export function OperationalPage({
  children,
  className,
  narrow,
}: {
  children: ReactNode;
  className?: string;
  narrow?: boolean;
}) {
  return (
    <TransovoProductPage
      narrow={narrow}
      className={cn("transovo-operational-redesign", className)}
    >
      {children}
    </TransovoProductPage>
  );
}

export function OperationalPageHeader({
  title,
  description,
  actions,
  period,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  period?: ReactNode;
}) {
  return (
    <header className="transovo-op-page-top">
      <div className="transovo-op-title-row">
        <div className="min-w-0">
          <h1 className="transovo-op-page-title">{title}</h1>
          {description ? <p className="transovo-op-page-desc mt-1">{description}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {period ? <div className="transovo-op-period">{period}</div> : null}
          {actions}
        </div>
      </div>
    </header>
  );
}
