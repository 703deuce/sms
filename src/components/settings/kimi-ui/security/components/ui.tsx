"use client";

import { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode, forwardRef } from "react";

/* ---------- cn ---------- */
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Button ---------- */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "tv-btn-primary",
  secondary: "tv-btn-secondary",
  ghost: "tv-btn-ghost",
  danger: "tv-btn-danger",
  outline: "tv-btn-outline",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn("tv-btn", variants[variant], size === "sm" && "tv-btn-sm", className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

/* ---------- Card ---------- */
export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("tv-card", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="tv-card-header">
      <div>
        <h3 className="tv-card-title">{title}</h3>
        {description ? <p className="tv-card-desc">{description}</p> : null}
      </div>
      {action ? <div className="tv-card-action">{action}</div> : null}
    </div>
  );
}

/* ---------- Input / Label ---------- */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn("tv-input", className)} {...props} />
  ),
);
Input.displayName = "Input";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("tv-label", className)} {...props} />;
}

/* ---------- Status chip ---------- */
const chipStyles: Record<string, string> = {
  Active: "tv-chip tv-chip-success",
  "This device": "tv-chip tv-chip-accent",
  Enabled: "tv-chip tv-chip-success",
  "Not enabled": "tv-chip tv-chip-neutral",
  Pending: "tv-chip tv-chip-warning",
};

export function StatusChip({ status }: { status: string }) {
  const cls = chipStyles[status] ?? "tv-chip tv-chip-neutral";
  return (
    <span className={cls}>
      <span className="tv-chip-dot" aria-hidden />
      {status}
    </span>
  );
}

/* ---------- Inline alert ---------- */
export function InlineAlert({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: ReactNode;
}) {
  return (
    <div className={cn("tv-alert", `tv-alert-${tone}`)} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

/* ---------- Skeleton ---------- */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="tv-skeleton-stack" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="tv-skeleton-row" />
      ))}
    </div>
  );
}
