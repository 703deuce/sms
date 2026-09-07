"use client";

import { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, forwardRef, HTMLAttributes, ReactNode } from "react";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

const variantStyles: Record<Variant, React.CSSProperties> = {};
const variantClasses: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover",
  secondary: "bg-muted text-foreground hover:bg-border/70",
  ghost: "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
  danger: "bg-danger text-danger-foreground shadow-sm hover:opacity-90",
  outline: "border border-border bg-card text-foreground shadow-sm hover:bg-muted/60",
};
const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-5 text-sm",
  icon: "h-9 w-9",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", style, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      style={{ ...variantStyles[variant], ...style }}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("surface rounded-xl bg-card p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-display text-sm font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition-colors placeholder:text-muted-foreground/80 focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-70",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-[13px] font-semibold tracking-tight text-foreground/90", className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-[10px] border border-border bg-card px-3 py-2.5 text-sm leading-relaxed shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition-colors placeholder:text-muted-foreground/80 focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}

type ChipTone = "success" | "warning" | "danger" | "info" | "neutral";
const chipTones: Record<ChipTone, string> = {
  success: "bg-[hsl(152_56%_36%/0.1)] text-[hsl(152_56%_30%)] border-[hsl(152_56%_36%/0.25)]",
  warning: "bg-[hsl(32_90%_44%/0.1)] text-[hsl(32_90%_36%)] border-[hsl(32_90%_44%/0.25)]",
  danger: "bg-[hsl(0_72%_51%/0.08)] text-[hsl(0_72%_44%)] border-[hsl(0_72%_51%/0.22)]",
  info: "bg-[hsl(234_62%_54%/0.08)] text-[hsl(234_62%_46%)] border-[hsl(234_62%_54%/0.22)]",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function StatusChip({
  tone = "neutral",
  children,
  pulse,
}: {
  tone?: ChipTone;
  children: ReactNode;
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight",
        chipTones[tone],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", pulse && "ts-pulse-dot")} />
      {children}
    </span>
  );
}

export function artifactTone(status?: string): ChipTone {
  switch (status) {
    case "ready": return "success";
    case "processing": return "info";
    case "failed": return "danger";
    default: return "neutral";
  }
}
