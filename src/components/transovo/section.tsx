import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Open page section — spacing + typography, not a card (Pass 3). */
export function TransovoSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("transovo-section", className)}>
      {(title || actions) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? <h2 className="transovo-section-title">{title}</h2> : null}
            {description ? <p className="transovo-section-desc mt-1">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

export function TransovoHairline({ className }: { className?: string }) {
  return <hr className={cn("transovo-hairline", className)} />;
}
