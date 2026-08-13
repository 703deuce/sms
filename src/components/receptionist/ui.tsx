"use client";

import { cn } from "@/lib/utils";
import { Check, ChevronRight } from "lucide-react";
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
        compact ? "p-3.5" : "p-4",
        selected
          ? "border-[#6366f1] bg-[#6366f1]/[0.04] shadow-[0_0_0_1px_rgba(99,102,241,0.35)]"
          : "border-[#e6e8ef] hover:border-[#6366f1]/40 hover:bg-[#f8f9fc]",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      {selected ? (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#6366f1] text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      ) : null}
      <div className="flex items-start gap-3 pr-6">
        {icon ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#6366f1]/10 text-[#6366f1]">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#111827]">{title}</p>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-[#6b7280]">{description}</p>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export function CapabilityCard({
  selected,
  onClick,
  emoji,
  title,
  description,
}: {
  selected?: boolean;
  onClick?: () => void;
  emoji: string;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col rounded-xl border bg-white p-4 text-left transition",
        selected
          ? "border-[#6366f1] shadow-[0_0_0_1px_rgba(99,102,241,0.35)]"
          : "border-[#e6e8ef] hover:border-[#6366f1]/40",
      )}
    >
      {selected ? (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#6366f1] text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      ) : null}
      <span className="text-2xl">{emoji}</span>
      <p className="mt-3 text-sm font-semibold text-[#111827]">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-[#6b7280]">{description}</p>
    </button>
  );
}

export function SidePanel({
  title,
  children,
  illustration,
  className,
}: {
  title: string;
  children: ReactNode;
  illustration?: ReactNode;
  className?: string;
}) {
  return (
    <aside className={cn("voice-card w-full shrink-0 p-5 lg:w-[320px]", className)}>
      {illustration ? <div className="mb-5 flex justify-center">{illustration}</div> : null}
      <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>
      <div className="mt-3 space-y-2 text-sm text-[#6b7280]">{children}</div>
    </aside>
  );
}

export function WizardSection({
  number,
  title,
  subtitle,
  optional,
  children,
  action,
}: {
  number: number;
  title: string;
  subtitle?: string;
  optional?: boolean;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#e6e8ef] bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6366f1]/10 text-xs font-bold text-[#6366f1]">
            {number}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[#111827]">
              {title}
              {optional ? (
                <span className="ml-2 text-xs font-normal text-[#9ca3af]">Optional</span>
              ) : null}
            </h3>
            {subtitle ? <p className="mt-1 text-xs text-[#6b7280]">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
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
    <div className="mt-8 flex items-center justify-between border-t border-[#e6e8ef] pt-6">
      <div>
        {showBack && onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium text-[#6b7280] hover:text-[#111827]"
          >
            {backLabel}
          </button>
        ) : onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-[#6b7280] hover:text-[#111827]"
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
          className="voice-btn-primary min-w-[160px]"
        >
          {busy ? "Saving…" : continueLabel}
          {!busy ? <ChevronRight className="h-4 w-4" /> : null}
        </button>
      ) : null}
    </div>
  );
}

export function FieldChip({
  label,
  selected,
  required,
  onToggle,
  onRemove,
}: {
  label: string;
  selected?: boolean;
  required?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
        selected ? "border-[#6366f1]/30 bg-[#6366f1]/5" : "border-[#e6e8ef] bg-white",
      )}
    >
      <button type="button" onClick={onToggle} disabled={!onToggle} className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded border",
            selected ? "border-[#6366f1] bg-[#6366f1] text-white" : "border-[#d1d5db]",
          )}
        >
          {selected ? <Check className="h-3 w-3" /> : null}
        </span>
        <span className="font-medium text-[#374151]">{label}</span>
      </button>
      {required !== undefined ? (
        <span className="text-[10px] text-[#9ca3af]">{required ? "Required" : "Optional"}</span>
      ) : null}
      {onRemove ? (
        <button type="button" onClick={onRemove} className="text-[#9ca3af] hover:text-[#6b7280]">
          ×
        </button>
      ) : null}
    </div>
  );
}
