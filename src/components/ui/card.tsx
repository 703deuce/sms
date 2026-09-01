import { cn } from "@/lib/utils";
import { HTMLAttributes, ReactNode } from "react";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("surface rounded-xl bg-card p-5", className)}
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
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className="surface block rounded-xl bg-card p-5 transition-all duration-150 hover:border-primary/40 hover:shadow-md"
      >
        {content}
      </a>
    );
  }

  return <Card>{content}</Card>;
}
