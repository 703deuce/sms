"use client";

import { Panel } from "@/newui-transplant/components/app/kit";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

export function SelectableCard({
  selected,
  onClick,
  title,
  description,
  icon,
  children,
  className,
  disabled,
  variant = "legacy",
}: {
  selected?: boolean;
  onClick?: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  variant?: "legacy" | "opus";
}) {
  const opusSelected = variant === "opus" && selected;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative flex w-full flex-col rounded-xl border bg-card p-4 text-left transition",
        variant === "opus"
          ? opusSelected
            ? "border-primary bg-accent/40"
            : "border-border hover:border-primary/40 hover:bg-muted/30"
          : selected
            ? "border-primary shadow-[0_0_0_1px_rgba(16,185,129,0.28)]"
            : "border-border hover:border-primary/40 hover:bg-muted/30",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      {selected ? (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      ) : null}
      <div className="flex items-start gap-3 pr-6">
        {icon ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
          {children}
        </div>
      </div>
    </button>
  );
}

export function RadioRow({
  selected,
  onClick,
  label,
  description,
  variant = "legacy",
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  description?: string;
  variant?: "legacy" | "opus";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition",
        variant === "opus"
          ? selected
            ? "border-primary bg-accent/40"
            : "border-border hover:border-primary/40 hover:bg-muted/30"
          : selected
            ? "border-primary bg-primary/5"
            : "border-border bg-card hover:border-primary/30",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-primary" : "border-muted-foreground/40",
        )}
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
      </span>
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
    </button>
  );
}

export function InfoCallout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-accent/20 bg-accent/5 px-3.5 py-3 text-xs leading-relaxed text-foreground/80">
      {children}
    </div>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "muted" | "info";
  children: ReactNode;
}) {
  const styles = {
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    muted: "bg-muted text-muted-foreground",
    info: "bg-accent/10 text-accent",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        styles[tone],
      )}
    >
      {children}
    </span>
  );
}

export function SidePanel({
  title,
  children,
  variant = "legacy",
}: {
  title: string;
  children: ReactNode;
  variant?: "legacy" | "opus";
}) {
  if (variant === "opus") {
    return (
      <aside className="hidden w-[300px] shrink-0 xl:block">
        <Panel title={title} className="sticky top-4 shadow-xs">
          {children}
        </Panel>
      </aside>
    );
  }
  return (
    <aside className="hidden w-[300px] shrink-0 xl:block">
      <div className="sticky top-4 space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {children}
      </div>
    </aside>
  );
}
