"use client";

import { cn } from "@/lib/utils";
import {
  ELEVENLABS_SPEED_MAX,
  ELEVENLABS_SPEED_MIN,
  EXPRESSIVENESS_LABELS,
  expressivenessToStability,
  stabilityToExpressiveness,
  type VoiceExpressiveness,
} from "@/lib/voice/elevenlabs/receptionist-voice-tuning";
import { Bot, Check, ChevronRight, Info, Minus, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

/** Main wizard column + right rail (~30% mockup width). */
export function WizardPageLayout({
  children,
  aside,
  wideAside,
}: {
  children: ReactNode;
  aside?: ReactNode;
  wideAside?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid items-start gap-6 lg:gap-8",
        aside
          ? wideAside
            ? "lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]"
            : "lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]"
          : "",
      )}
    >
      <div className="min-w-0">{children}</div>
      {aside ? (
        <div className="w-full shrink-0 lg:sticky lg:top-4 lg:self-start">{aside}</div>
      ) : null}
    </div>
  );
}

export function WizardFieldLabel({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-semibold text-[#374151]">{children}</span>
      {hint ? (
        <span
          className="flex h-4 w-4 items-center justify-center rounded-full bg-[#f3f4f6] text-[#9ca3af]"
          title={hint}
        >
          <Info className="h-3 w-3" strokeWidth={2.5} />
        </span>
      ) : null}
    </div>
  );
}

export function WizardQuestionBlock({
  number,
  title,
  subtitle,
  optional,
  metaRight,
  children,
}: {
  number: number;
  title: string;
  subtitle?: string;
  optional?: boolean;
  metaRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="wizard-question-block">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6366f1] text-xs font-bold text-white"
          >
            {number}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[#111827]">
              {title}
              {optional ? (
                <span className="ml-2 text-xs font-normal text-[#9ca3af]">Optional</span>
              ) : null}
            </h3>
            {subtitle ? <p className="mt-1 text-xs leading-relaxed text-[#6b7280]">{subtitle}</p> : null}
          </div>
        </div>
        {metaRight}
      </div>
      {children}
    </section>
  );
}

export function WizardTextareaField({
  id,
  value,
  onChange,
  placeholder,
  minHeight = 120,
  wordHint,
  onAiSuggest,
  aiLabel = "AI suggestions",
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  wordHint?: string;
  onAiSuggest?: () => void;
  aiLabel?: string;
}) {
  return (
    <div className="wizard-textarea-shell">
      {wordHint ? (
        <div className="flex items-center justify-end px-3 pt-2 text-[11px] text-[#9ca3af]">
          {wordHint}
        </div>
      ) : null}
      <textarea
        id={id}
        className="w-full px-3 pb-3 text-sm leading-relaxed text-[#374151]"
        style={{ minHeight }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {onAiSuggest ? (
        <div className="flex justify-end border-t border-[#f3f4f6] px-3 py-2">
          <button
            type="button"
            onClick={onAiSuggest}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6366f1] hover:text-[#4f46e5]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {aiLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AboutNextPanel({
  agent,
  steps,
  tips,
}: {
  agent: string;
  steps: Array<{ color: string; text: string }>;
  tips: string[];
}) {
  return (
    <aside className="wizard-rail-card-tinted">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6366f1]/15">
          <Bot className="h-5 w-5 text-[#6366f1]" />
        </div>
        <h3 className="text-[15px] font-semibold text-[#111827]">What happens next?</h3>
      </div>
      <ul className="space-y-3.5">
        {steps.map((step, i) => (
          <li key={step.text} className="flex gap-3">
            <span
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                step.color,
              )}
            >
              {i + 1}
            </span>
            <span className="text-[13px] leading-snug text-[#374151]">{step.text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 border-t border-[#e9e5ff] pt-5">
        <p className="wizard-rail-label">Tips for best results</p>
        <ul className="mt-3 space-y-2">
          {tips.map((tip) => (
            <li key={tip} className="flex items-start gap-2 text-[12px] leading-snug text-[#6b7280]">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" strokeWidth={3} />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export function WizardPageHeader({
  icon,
  title,
  subtitle,
  banner,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  banner?: boolean;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex items-start gap-3",
        banner && "rounded-xl border border-[#e9e5ff] bg-[#f5f3ff] px-5 py-4",
      )}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#6366f1]/10">
        {icon}
      </div>
      <div className="min-w-0 pt-0.5">
        <h1 className="font-display text-[22px] font-semibold leading-tight tracking-tight text-[#111827]">
          {title}
        </h1>
        <p className="mt-1 text-sm leading-snug text-[#6b7280]">{subtitle}</p>
      </div>
    </div>
  );
}

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
    <aside className={cn("wizard-rail-card", className)}>
      {illustration ? <div className="mb-6 flex justify-center">{illustration}</div> : null}
      <h3 className="text-[15px] font-semibold tracking-tight text-[#111827]">{title}</h3>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#6b7280]">{children}</div>
    </aside>
  );
}

export function CapabilityCardCompact({
  selected,
  onClick,
  icon,
  iconBg,
  iconColor,
  title,
}: {
  selected?: boolean;
  onClick?: () => void;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex min-h-[108px] flex-col items-center justify-center rounded-xl border bg-white px-3 py-4 text-center transition",
        selected
          ? "border-[#6366f1] shadow-[0_0_0_1px_rgba(99,102,241,0.35)]"
          : "border-[#e6e8ef] hover:border-[#6366f1]/40",
      )}
    >
      {selected ? (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#6366f1] text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      ) : null}
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          iconBg,
          iconColor,
        )}
      >
        {icon}
      </span>
      <p className="mt-3 text-xs font-semibold leading-tight text-[#111827]">{title}</p>
    </button>
  );
}

export function TimingOptionRow({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected?: boolean;
  onClick?: () => void;
  icon: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border bg-white px-4 py-3.5 text-left transition",
        selected
          ? "border-[#6366f1] shadow-[0_0_0_1px_rgba(99,102,241,0.35)]"
          : "border-[#e6e8ef] hover:border-[#6366f1]/40",
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#6366f1]/10 text-[#6366f1]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#111827]">{title}</p>
        {description ? <p className="mt-0.5 text-xs text-[#6b7280]">{description}</p> : null}
      </div>
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-[#6366f1] bg-[#6366f1]" : "border-[#d1d5db] bg-white",
        )}
      >
        {selected ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

export function SetupDetailsPanel({
  agent,
  businessName,
  capabilities,
  capabilityOptions,
  enabledFieldLabels,
  answerLabel,
}: {
  agent: string;
  businessName: string;
  capabilities: string[];
  capabilityOptions: Array<{ id: string; label: string }>;
  enabledFieldLabels: string[];
  answerLabel: string;
}) {
  const enabledCaps = capabilityOptions.filter((c) => capabilities.includes(c.id));

  return (
    <aside className="wizard-rail-card">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6366f1]/10">
          <Bot className="h-4 w-4 text-[#6366f1]" />
        </span>
        <h3 className="text-[15px] font-semibold tracking-tight text-[#111827]">Setup Details</h3>
      </div>

      <div className="wizard-rail-section mt-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6366f1] text-sm font-bold text-white"
          >
            {agent.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#111827]">{agent}</p>
            <p className="truncate text-xs text-[#6b7280]">{businessName || "Your business"}</p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <p className="wizard-rail-label">Capabilities</p>
        <ul className="mt-2.5 space-y-2">
          {enabledCaps.map((cap) => (
            <li key={cap.id} className="flex items-center gap-2 text-[13px] font-medium text-[#374151]">
              <Check className="h-4 w-4 shrink-0 text-violet-500" strokeWidth={3} />
              {cap.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 border-t border-[#e6e8ef] pt-5">
        <p className="wizard-rail-label">How it answers</p>
        <p className="mt-1.5 text-[13px] font-medium text-[#374151]">{answerLabel}</p>
      </div>

      {enabledFieldLabels.length ? (
        <div className="mt-5 border-t border-[#e6e8ef] pt-5">
          <p className="wizard-rail-label">Information collected</p>
          <ul className="mt-2 space-y-1.5">
            {enabledFieldLabels.map((label) => (
              <li key={label} className="text-[13px] text-[#374151]">{label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 flex gap-2.5 rounded-xl border border-[#e9e5ff] bg-[#f5f3ff] px-3.5 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#6366f1]" />
        <p className="text-[11px] leading-relaxed text-[#6b7280]">
          Finish setup on Voice & Test to connect your number and go live.
        </p>
      </div>
    </aside>
  );
}

export function VoiceWorksPanel({
  agent,
  greeting,
  phoneE164,
}: {
  agent: string;
  greeting: string;
  phoneE164?: string | null;
}) {
  return (
    <div className="wizard-rail-card h-full">
      <h3 className="text-[15px] font-semibold text-[#111827]">See how it works</h3>
      <p className="mt-1 text-xs text-[#6b7280]">
        Preview the conversation flow before you deploy.
      </p>

      <div className="mt-4 space-y-3">
        <div className="flex gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6366f1]/10">
            <Bot className="h-3.5 w-3.5 text-[#6366f1]" />
          </span>
          <p className="rounded-xl rounded-tl-sm bg-[#f5f3ff] px-3 py-2 text-[12px] leading-relaxed text-[#374151]">
            {greeting}
          </p>
        </div>
        <div className="flex gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/10">
            <span className="text-[10px] font-bold text-violet-600">U</span>
          </span>
          <p className="rounded-xl rounded-tl-sm bg-[#f8f9fc] px-3 py-2 text-[12px] leading-relaxed text-[#374151]">
            I&apos;m curious about pricing for a service visit.
          </p>
        </div>
        <div className="flex gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6366f1]/10">
            <Bot className="h-3.5 w-3.5 text-[#6366f1]" />
          </span>
          <p className="rounded-xl rounded-tl-sm bg-[#f5f3ff] px-3 py-2 text-[12px] leading-relaxed text-[#374151]">
            I can help with that. What type of service do you need?
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-[#e6e8ef] pt-5">
        <p className="text-xs font-semibold text-[#374151]">
          Our phone number:{" "}
          <span className="font-bold text-[#111827]">{phoneE164 || "(assign on activate)"}</span>
        </p>
        {phoneE164 ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-violet-600">
            <span className="h-2 w-2 rounded-full bg-violet-500" />
            Active
          </p>
        ) : null}
        <p className="mt-2 text-[11px] leading-relaxed text-[#6b7280]">
          Run a browser test to confirm voice quality before you connect and deploy.
        </p>
      </div>
    </div>
  );
}

export function WizardAccordionSection({
  number,
  title,
  defaultOpen,
  children,
}: {
  number: number;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="voice-card group p-0" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-semibold text-[#111827]">
          {number}. {title}
        </span>
        <ChevronRight className="ml-auto h-4 w-4 text-[#9ca3af] transition group-open:rotate-90" />
      </summary>
      <div className="border-t border-[#e6e8ef] px-5 pb-5 pt-4">{children}</div>
    </details>
  );
}

/** @deprecated Use SetupDetailsPanel */
export function SetupSummaryPanel({
  agent,
  businessName,
  capabilities,
  capabilityOptions,
  enabledFieldLabels,
  answerLabel,
}: {
  agent: string;
  businessName: string;
  capabilities: string[];
  capabilityOptions: Array<{ id: string; label: string }>;
  enabledFieldLabels: string[];
  answerLabel: string;
}) {
  return (
    <aside className="wizard-rail-card">
      <h3 className="text-[15px] font-semibold tracking-tight text-[#111827]">{agent}&apos;s Setup</h3>

      <div className="wizard-rail-section mt-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#6366f1] text-sm font-bold text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)]"
          >
            {agent.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#111827]">{agent}</p>
            <p className="truncate text-xs text-[#6b7280]">{businessName || "Your business"}</p>
          </div>
        </div>
      </div>

      <ul className="mt-5 space-y-2.5">
        {capabilityOptions.map((cap) => {
          const enabled = capabilities.includes(cap.id);
          return (
            <li key={cap.id} className="flex items-center gap-2.5 text-[13px]">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  enabled ? "bg-[#6366f1]/10 text-[#6366f1]" : "bg-[#f3f4f6] text-[#d1d5db]",
                )}
              >
                {enabled ? (
                  <Check className="h-3 w-3" strokeWidth={3} />
                ) : (
                  <Minus className="h-3 w-3" strokeWidth={2} />
                )}
              </span>
              <span className={enabled ? "font-medium text-[#374151]" : "text-[#9ca3af]"}>
                {cap.label}
              </span>
            </li>
          );
        })}
      </ul>

      {enabledFieldLabels.length ? (
        <div className="mt-5 border-t border-[#e6e8ef] pt-5">
          <p className="wizard-rail-label">Collecting</p>
          <p className="mt-1.5 text-[13px] leading-snug text-[#374151]">
            {enabledFieldLabels.join(" · ")}
          </p>
        </div>
      ) : null}

      <div className="mt-5 border-t border-[#e6e8ef] pt-5">
        <p className="wizard-rail-label">Answering</p>
        <p className="mt-1.5 text-[13px] font-medium text-[#374151]">{answerLabel}</p>
      </div>

      <div className="mt-5 flex gap-2.5 rounded-xl border border-[#e6e8ef] bg-[#f8f9fc] px-3.5 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#6366f1]" />
        <p className="text-[11px] leading-relaxed text-[#6b7280]">
          Capabilities control what tools the runtime exposes — prompt text cannot bypass disabled
          actions.
        </p>
      </div>
    </aside>
  );
}

export function TestRecapPanel({
  agent,
  greeting,
}: {
  agent: string;
  greeting: string;
}) {
  return (
    <aside className="wizard-rail-card">
      <h3 className="text-[15px] font-semibold tracking-tight text-[#111827]">Test Recap</h3>
      <div className="mt-4 space-y-3 rounded-xl border border-[#e6e8ef] bg-[#f8f9fc] p-4 text-[12px] leading-relaxed">
        <p>
          <span className="font-semibold text-[#6366f1]">{agent}:</span> {greeting}
        </p>
        <p>
          <span className="font-semibold text-[#111827]">Caller:</span> I need help with a service
          request.
        </p>
        <p>
          <span className="font-semibold text-[#6366f1]">{agent}:</span> I can help with that. What
          type of service do you need?
        </p>
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-[#6b7280]">
        Run a browser test before activating to confirm voice and response quality.
      </p>
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
    <div className="rounded-xl border border-[#e6e8ef] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
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
    <div className="mt-6 flex items-center justify-between border-t border-[#e6e8ef] pt-5">
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
        "inline-flex w-full items-center justify-between gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
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
  speakingSpeed,
  onStabilityChange,
  onClarityChange,
  onStyleChange,
  onSpeakingSpeedChange,
}: {
  stability: number;
  clarity: number;
  style: number;
  speakingSpeed: number;
  onStabilityChange: (v: number) => void;
  onClarityChange: (v: number) => void;
  onStyleChange: (v: number) => void;
  onSpeakingSpeedChange: (v: number) => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const expressiveness = stabilityToExpressiveness(stability);
  const expressivenessOptions: VoiceExpressiveness[] = ["calm", "balanced", "expressive"];

  return (
    <div className="mt-5 space-y-4 border-t border-[#e6e8ef] pt-5">
      <SliderRow
        label="Speaking speed"
        value={speakingSpeed}
        min={ELEVENLABS_SPEED_MIN}
        max={ELEVENLABS_SPEED_MAX}
        step={0.05}
        display={`${speakingSpeed.toFixed(2)}×`}
        onChange={onSpeakingSpeedChange}
      />

      <div>
        <p className="text-xs font-medium text-[#374151]">Expressiveness</p>
        <p className="mt-0.5 text-[11px] text-[#6b7280]">
          More expressive voices vary tone more; calmer voices stay steadier.
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {expressivenessOptions.map((preset) => {
            const active = expressiveness === preset;
            const meta = EXPRESSIVENESS_LABELS[preset];
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onStabilityChange(expressivenessToStability(preset))}
                className={cn(
                  "rounded-lg border px-2 py-2 text-center transition",
                  active
                    ? "border-[#6366f1] bg-[#6366f1]/5 text-[#111827]"
                    : "border-[#e6e8ef] bg-white text-[#374151] hover:bg-[#f8f9fc]",
                )}
              >
                <span className="text-xs font-semibold">{meta.label}</span>
                <span className="mt-0.5 block text-[10px] text-[#6b7280]">{meta.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          className="flex w-full items-center justify-between text-xs font-medium text-[#374151]"
        >
          <span>Advanced voice settings</span>
          <ChevronRight
            className={cn("h-4 w-4 text-[#6b7280] transition", advancedOpen && "rotate-90")}
          />
        </button>
        {advancedOpen ? (
          <div className="mt-3 space-y-4 rounded-lg border border-[#e6e8ef] bg-[#f8f9fc] p-3">
            <SliderRow
              label="Voice consistency"
              value={clarity}
              display={`${Math.round(clarity * 100)}%`}
              onChange={onClarityChange}
            />
            <SliderRow
              label="Style"
              value={style}
              display={`${Math.round(style * 100)}%`}
              onChange={onStyleChange}
            />
            <p className="text-[10px] leading-relaxed text-[#6b7280]">
              Higher style adds personality but can affect stability and latency. Keep near zero unless
              you need more character.
            </p>
          </div>
        ) : null}
      </div>
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
