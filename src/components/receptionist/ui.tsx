"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

export function SelectableCard({
  selected,
  onClick,
  title,
  description,
  icon,
  className,
  disabled,
  compact,
}: {
  selected?: boolean;
  onClick?: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative flex w-full flex-col rounded-xl border bg-card text-left transition",
        compact ? "p-3" : "p-4",
        selected
          ? "border-primary bg-primary/[0.04] shadow-[0_0_0_1px_rgba(99,102,241,0.35)]"
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
        </div>
      </div>
    </button>
  );
}

export function SidePanel({
  title,
  children,
  illustration,
}: {
  title: string;
  children: ReactNode;
  illustration?: ReactNode;
}) {
  return (
    <aside className="voice-card w-full shrink-0 p-5 lg:w-[300px]">
      {illustration ? (
        <div className="mb-4 flex justify-center">{illustration}</div>
      ) : null}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">{children}</div>
    </aside>
  );
}

export function WizardFooter({
  onBack,
  onContinue,
  onCancel,
  continueLabel = "Continue",
  backLabel = "Back",
  busy,
  showBack,
}: {
  onBack?: () => void;
  onContinue?: () => void;
  onCancel?: () => void;
  continueLabel?: string;
  backLabel?: string;
  busy?: boolean;
  showBack?: boolean;
}) {
  return (
    <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
      <div>
        {showBack && onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {backLabel}
          </button>
        ) : onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        ) : null}
      </div>
      {onContinue ? (
        <button
          type="button"
          disabled={busy}
          onClick={onContinue}
          className="voice-btn-primary min-w-[140px]"
        >
          {busy ? "Saving…" : continueLabel}
        </button>
      ) : null}
    </div>
  );
}
