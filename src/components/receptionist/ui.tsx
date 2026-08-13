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
  icon,
  iconBg,
  iconColor,
  title,
  description,
}: {
  selected?: boolean;
  onClick?: () => void;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
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
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          iconBg,
          iconColor,
        )}
      >
        {icon}
      </span>
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
    <button
      type="button"
      onClick={onToggle}
      disabled={!onToggle}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
        selected
          ? "border-[#6366f1] bg-[#6366f1] text-white"
          : "border-[#e6e8ef] bg-white text-[#374151] hover:border-[#6366f1]/50",
        !onToggle && "cursor-default",
      )}
    >
      {selected ? <Check className="h-3 w-3 shrink-0" strokeWidth={3} /> : null}
      <span>{label}</span>
      {required !== undefined ? (
        <span className={cn(selected ? "text-white/80" : "text-[#9ca3af]")}>
          {required ? "Required" : "Optional"}
        </span>
      ) : null}
      {onRemove ? (
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={cn(selected ? "text-white/80 hover:text-white" : "text-[#9ca3af] hover:text-[#6b7280]")}
        >
          ×
        </span>
      ) : null}
    </button>
  );
}

export function ElevenLabsTuningPanel({
  stability,
  clarity,
  style,
  speakerBoost,
  optimizeLatency,
  speakingSpeed,
  onStabilityChange,
  onClarityChange,
  onStyleChange,
  onSpeakerBoostChange,
  onOptimizeLatencyChange,
  onSpeakingSpeedChange,
}: {
  stability: number;
  clarity: number;
  style: number;
  speakerBoost: boolean;
  optimizeLatency: boolean;
  speakingSpeed: number;
  onStabilityChange: (v: number) => void;
  onClarityChange: (v: number) => void;
  onStyleChange: (v: number) => void;
  onSpeakerBoostChange: (v: boolean) => void;
  onOptimizeLatencyChange: (v: boolean) => void;
  onSpeakingSpeedChange: (v: number) => void;
}) {
  return (
    <div className="mt-5 space-y-4 border-t border-[#e6e8ef] pt-5">
      <SliderRow
        label="Stability"
        value={stability}
        onChange={onStabilityChange}
      />
      <SliderRow label="Clarity" value={clarity} onChange={onClarityChange} />
      <SliderRow label="Style" value={style} onChange={onStyleChange} />
      <SliderRow
        label="Speaking speed"
        value={speakingSpeed}
        min={0.5}
        max={2}
        step={0.1}
        display={speakingSpeed.toFixed(1)}
        onChange={onSpeakingSpeedChange}
      />
      <ToggleRow
        label="Optimize for latency"
        checked={optimizeLatency}
        onChange={onOptimizeLatencyChange}
      />
      <ToggleRow
        label="Speaker boost"
        checked={speakerBoost}
        onChange={onSpeakerBoostChange}
      />
    </div>
  );
}

function SliderRow({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.05,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  display?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-medium text-[#374151]">
        <span>{label}</span>
        <span className="text-[#6b7280]">{display ?? value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-[#6366f1]"
      />
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs font-medium text-[#374151]">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          checked ? "bg-[#6366f1]" : "bg-[#d1d5db]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}
