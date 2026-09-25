import { cn } from "@/lib/utils";
import { HTMLAttributes, ReactNode } from "react";

export function Card({
  className,
  contained,
  ...props
}: HTMLAttributes<HTMLDivElement> & { /** Pass 3: only modals/warnings/charts that need a box */ contained?: boolean }) {
  return (
    <div
      className={cn(
        contained ? "transovo-surface--contained transovo-surface-flat bg-card p-4" : "transovo-surface-flat",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-display text-sm font-semibold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint?: ReactNode;
  href?: string;
}) {
  const content = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className="transovo-surface-flat block bg-card p-4 transition-colors duration-150 hover:border-[var(--transovo-brand)]"
      >
        {content}
      </a>
    );
  }

  return <Card>{content}</Card>;
}
