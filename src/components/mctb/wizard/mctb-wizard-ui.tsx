"use client";

/**
 * MCTB guided-setup wizard UI — built on AI Receptionist wizard primitives.
 * @see src/components/mctb/wizard/PATTERNS.md
 */
import {
  AboutNextPanel,
  SelectableCard,
  SidePanel,
  TimingOptionRow,
  WizardFooter,
  WizardPageHeader,
  WizardPageLayout,
  WizardQuestionBlock,
  WizardTextareaField,
} from "@/components/receptionist/ui";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Loader2,
  Phone,
  PhoneForwarded,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export {
  WizardPageLayout,
  WizardPageHeader,
  WizardQuestionBlock,
  WizardFooter,
  WizardTextareaField,
  SelectableCard,
  SidePanel,
  TimingOptionRow,
};

export function MctbFlowStepper({
  steps,
  labels,
  currentIndex,
  className,
}: {
  steps: string[];
  labels: Record<string, string>;
  currentIndex: number;
  className?: string;
}) {
  return (
    <nav aria-label="Setup progress" className={cn("w-full", className)}>
      <ol className="flex flex-wrap items-center justify-center gap-y-2">
        {steps.map((stepId, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={stepId} className="flex items-center">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full px-2 py-1 sm:px-3",
                  active && "bg-[#6366f1]/10",
                )}
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition",
                    done || active
                      ? "bg-[#6366f1] text-white"
                      : "border border-[#d1d5db] bg-white text-[#9ca3af]",
                  )}
                >
                  {done && !active ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={cn(
                    "hidden text-sm sm:inline max-w-[9rem] truncate",
                    active ? "font-semibold text-[#111827]" : "font-medium text-[#9ca3af]",
                  )}
                >
                  {labels[stepId] || stepId}
                </span>
              </div>
              {index < steps.length - 1 ? (
                <div
                  className={cn(
                    "mx-1 h-px w-6 sm:w-10",
                    index < currentIndex ? "bg-[#6366f1]" : "bg-[#e6e8ef]",
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function MctbWhatHappensNextPanel({
  title = "What happens next",
  steps,
  tips,
}: {
  title?: string;
  steps: Array<{ color: string; text: string }>;
  tips?: string[];
}) {
  return (
    <AboutNextPanel agent={title} steps={steps} tips={tips ?? []} />
  );
}

export type MctbConnectionRow = {
  label: string;
  value: string;
  status?: "ready" | "pending" | "attention" | "unknown";
  mono?: boolean;
};

export function MctbConnectionStatusCard({
  title = "Connection summary",
  rows,
  footer,
}: {
  title?: string;
  rows: MctbConnectionRow[];
  footer?: ReactNode;
}) {
  const statusLabel = (s?: MctbConnectionRow["status"]) => {
    if (s === "ready") return { text: "Connected", className: "text-emerald-700 bg-emerald-50" };
    if (s === "pending") return { text: "Pending", className: "text-amber-800 bg-amber-50" };
    if (s === "attention") return { text: "Needs attention", className: "text-red-800 bg-red-50" };
    return null;
  };

  return (
    <div className="wizard-rail-card overflow-hidden p-0">
      <div className="border-b border-[#e6e8ef] bg-gradient-to-r from-[#f5f3ff] to-white px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6366f1]/15">
            <PhoneForwarded className="h-5 w-5 text-[#6366f1]" aria-hidden />
          </span>
          <h3 className="text-[15px] font-semibold text-[#111827]">{title}</h3>
        </div>
      </div>
      <dl className="divide-y divide-[#f3f4f6] px-5 py-2">
        {rows.map((row) => {
          const badge = statusLabel(row.status);
          return (
            <div key={row.label} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                  {row.label}
                </dt>
                <dd
                  className={cn(
                    "mt-0.5 text-[14px] font-semibold text-[#111827]",
                    row.mono && "font-mono text-[15px]",
                  )}
                >
                  {row.value || "—"}
                </dd>
              </div>
              {badge ? (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    badge.className,
                  )}
                >
                  {badge.text}
                </span>
              ) : null}
            </div>
          );
        })}
      </dl>
      {footer ? <div className="border-t border-[#f3f4f6] bg-[#f8f9fc] px-5 py-3">{footer}</div> : null}
    </div>
  );
}

export type MctbConsentModeOption = {
  id: "press_1" | "existing_consent";
  title: string;
  subtitle: string;
  audience: string;
  nextSteps: string[];
  badge?: string;
  icon: LucideIcon;
};

export function MctbConsentModeCards({
  value,
  onChange,
  options,
  attested,
  onAttestedChange,
}: {
  value: "press_1" | "existing_consent";
  onChange: (mode: "press_1" | "existing_consent") => void;
  options: MctbConsentModeOption[];
  attested?: boolean;
  onAttestedChange?: (v: boolean) => void;
}) {
  const selected = options.find((o) => o.id === value);

  return (
    <WizardPageLayout
      aside={
        selected ? (
          <SidePanel title="What happens on a missed call">
            <ol className="list-decimal space-y-2 pl-4 text-[13px] text-[#374151]">
              {selected.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="mt-4 text-[12px] text-[#6b7280]">
              <span className="font-semibold text-[#374151]">Best for:</span> {selected.audience}
            </p>
          </SidePanel>
        ) : (
          <MctbWhatHappensNextPanel
            steps={[
              { color: "bg-[#6366f1]", text: "Pick how permission is established" },
              { color: "bg-violet-500", text: "Configure your recovery message" },
              { color: "bg-emerald-500", text: "Connect forwarding and run a live test" },
            ]}
            tips={[
              "Press 1 captures consent on the call — strongest for new callers.",
              "Existing permission requires your attestation — only if you already have compliant opt-in.",
            ]}
          />
        )
      }
    >
      <WizardQuestionBlock
        number={1}
        title="How should missed-call texting be authorized?"
        subtitle="This controls the voice + SMS sequence after a missed call. You can change it later in Setup → Consent."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <SelectableCard
                key={opt.id}
                selected={value === opt.id}
                onClick={() => onChange(opt.id)}
                title={opt.title}
                description={opt.subtitle}
                icon={<Icon className="h-5 w-5" aria-hidden />}
                className={opt.badge ? "pt-8" : undefined}
              />
            );
          })}
        </div>
        {options.some((o) => o.badge && value === o.id) ? (
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-[#6366f1]">
            Recommended for most businesses
          </p>
        ) : null}
      </WizardQuestionBlock>

      {value === "existing_consent" && onAttestedChange ? (
        <WizardQuestionBlock
          number={2}
          title="Confirm existing permission"
          subtitle="Required before Transovo will send recovery texts under this mode."
        >
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-[13px] leading-relaxed text-[#78350f]">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-amber-300"
              checked={attested}
              onChange={(e) => onAttestedChange(e.target.checked)}
            />
            <span>
              I certify that I have the required permission to send SMS messages to callers covered
              by this setup. Transovo will not capture new consent on the call.
            </span>
          </label>
        </WizardQuestionBlock>
      ) : null}
    </WizardPageLayout>
  );
}

export function MctbSmsPreviewPanel({
  press1Mode,
  compliancePreview,
  openerPreview,
  senderLabel,
}: {
  press1Mode: boolean;
  compliancePreview: string;
  openerPreview: string;
  senderLabel?: string;
}) {
  return (
    <aside className="wizard-rail-card">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#6366f1]/10">
          <Phone className="h-4 w-4 text-[#6366f1]" aria-hidden />
        </span>
        <div>
          <h3 className="text-[15px] font-semibold text-[#111827]">Customer preview</h3>
          <p className="text-[11px] text-[#6b7280]">
            {senderLabel ? `From ${senderLabel}` : "What callers see on their phone"}
          </p>
        </div>
      </div>
      <div className="rounded-[1.25rem] border border-[#e6e8ef] bg-[#f8f9fc] p-3">
        {press1Mode ? (
          <div className="space-y-2.5">
            <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-[13px] text-[#374151] shadow-sm">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                System compliance confirmation (locked)
              </p>
              {compliancePreview}
            </div>
            <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-[#6366f1] px-3.5 py-2.5 text-[13px] text-white shadow-sm">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-200">
                Recovery opener (editable)
              </p>
              {openerPreview || "Your recovery message…"}
            </div>
          </div>
        ) : (
          <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-[#6366f1] px-3.5 py-2.5 text-[13px] text-white shadow-sm">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-200">
              Recovery message
            </p>
            {openerPreview || "Your recovery message…"}
          </div>
        )}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-[#9ca3af]">
        Production uses the same renderer. Locked compliance copy cannot be edited here.
      </p>
    </aside>
  );
}

export function MctbTextBackComposer({
  message,
  onMessageChange,
  press1Mode,
  compliancePreview,
  variablesHint,
}: {
  message: string;
  onMessageChange: (v: string) => void;
  press1Mode: boolean;
  compliancePreview: string;
  variablesHint?: string;
}) {
  const preview = message
    .replace(/\{\{customer\.firstName\}\}/g, "Alex")
    .replace(/\{\{business\.name\}\}/g, "Your Business");

  return (
    <WizardPageLayout
      aside={
        <MctbSmsPreviewPanel
          press1Mode={press1Mode}
          compliancePreview={compliancePreview}
          openerPreview={preview}
        />
      }
    >
      <WizardQuestionBlock
        number={1}
        title="Recovery opener"
        subtitle="Sent after consent is satisfied. Keep it short and action-oriented."
        metaRight={
          variablesHint ? (
            <span className="text-[11px] text-[#9ca3af]">{variablesHint}</span>
          ) : null
        }
      >
        <WizardTextareaField
          id="mctb-recovery-opener"
          value={message}
          onChange={onMessageChange}
          minHeight={140}
          placeholder="Sorry we missed your call — reply here and we'll get back to you shortly."
          wordHint={`${message.trim().split(/\s+/).filter(Boolean).length} words`}
        />
      </WizardQuestionBlock>
    </WizardPageLayout>
  );
}

export type MctbVerificationStep = {
  id: string;
  label: string;
  detail?: string;
  done: boolean;
  active?: boolean;
};

export function MctbVerificationTimeline({
  title,
  steps,
  waitingHint,
  passed,
  passedTitle,
}: {
  title: string;
  steps: MctbVerificationStep[];
  waitingHint?: string;
  passed?: boolean;
  passedTitle?: string;
}) {
  const firstIncomplete = steps.findIndex((s) => !s.done);

  return (
    <div className="wizard-rail-card">
      <h3 className="text-[15px] font-semibold text-[#111827]">{title}</h3>
      {passed ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-[13px] font-semibold text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          {passedTitle || "All checkpoints complete"}
        </div>
      ) : null}
      <ol className="relative mt-5 space-y-0">
        {steps.map((step, index) => {
          const isActive = step.active ?? index === firstIncomplete;
          const isLast = index === steps.length - 1;
          return (
            <li key={step.id} className="relative flex gap-3 pb-6 last:pb-0">
              {!isLast ? (
                <span
                  className={cn(
                    "absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px",
                    step.done ? "bg-emerald-300" : "bg-[#e6e8ef]",
                  )}
                  aria-hidden
                />
              ) : null}
              <span
                className={cn(
                  "relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-white",
                  step.done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : isActive
                      ? "border-[#6366f1] text-[#6366f1]"
                      : "border-[#e6e8ef] text-[#9ca3af]",
                )}
              >
                {step.done ? (
                  <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Circle className="h-3 w-3" aria-hidden />
                )}
              </span>
              <div className="min-w-0 pt-0.5">
                <p
                  className={cn(
                    "text-[13px] font-semibold",
                    step.done ? "text-[#111827]" : isActive ? "text-[#6366f1]" : "text-[#6b7280]",
                  )}
                >
                  {step.label}
                </p>
                {step.detail ? (
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[#6b7280]">{step.detail}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {!passed && waitingHint ? (
        <p className="mt-2 text-[12px] text-[#6b7280]">{waitingHint}</p>
      ) : null}
    </div>
  );
}

export function MctbWalkthroughModeToggle({
  mode,
  onChange,
}: {
  mode: "guided" | "instructions";
  onChange: (mode: "guided" | "instructions") => void;
}) {
  return (
    <div className="space-y-2">
      <TimingOptionRow
        selected={mode === "guided"}
        onClick={() => onChange("guided")}
        icon={<Phone className="h-4 w-4" aria-hidden />}
        title="Walk me through it"
        description="Step-by-step carrier setup with verification"
      />
      <TimingOptionRow
        selected={mode === "instructions"}
        onClick={() => onChange("instructions")}
        icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
        title="Show me the instructions"
        description="Carrier codes and forwarding destination only"
      />
    </div>
  );
}

export function MctbBusinessIdentityStep({
  businessName,
  onBusinessNameChange,
  websiteUrl,
  onWebsiteUrlChange,
}: {
  businessName: string;
  onBusinessNameChange: (v: string) => void;
  websiteUrl: string;
  onWebsiteUrlChange: (v: string) => void;
}) {
  const displayName = businessName.trim() || "Your Business";

  return (
    <WizardPageLayout
      aside={
        <MctbSmsPreviewPanel
          press1Mode={false}
          compliancePreview=""
          openerPreview={`Sorry we missed your call from ${displayName}! Reply here and we'll get back to you shortly.`}
          senderLabel={displayName}
        />
      }
    >
      <WizardQuestionBlock
        number={1}
        title="How should your business appear?"
        subtitle="Used in recovery texts and compliance surfaces. You can update this later in Settings."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="mctb-wiz-business-name" className="text-xs font-semibold text-[#374151]">
              Business name
            </label>
            <input
              id="mctb-wiz-business-name"
              className="mt-1.5 h-11 w-full rounded-lg border border-[#e6e8ef] bg-white px-3 text-sm text-[#374151]"
              value={businessName}
              onChange={(e) => onBusinessNameChange(e.target.value)}
              placeholder="Acme Plumbing"
              autoComplete="organization"
            />
          </div>
          <div>
            <label htmlFor="mctb-wiz-website" className="text-xs font-semibold text-[#374151]">
              Website <span className="font-normal text-[#9ca3af]">(optional)</span>
            </label>
            <input
              id="mctb-wiz-website"
              type="url"
              className="mt-1.5 h-11 w-full rounded-lg border border-[#e6e8ef] bg-white px-3 text-sm text-[#374151]"
              value={websiteUrl}
              onChange={(e) => onWebsiteUrlChange(e.target.value)}
              placeholder="https://acmeplumbing.com"
              autoComplete="url"
            />
          </div>
        </div>
      </WizardQuestionBlock>
    </WizardPageLayout>
  );
}

export type MctbTriggerRuleOption = {
  id: string;
  label: string;
  helper: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
};

export function MctbTriggerRuleCards({
  options,
  errorMessage,
}: {
  options: MctbTriggerRuleOption[];
  errorMessage?: string | null;
}) {
  return (
    <WizardQuestionBlock
      number={1}
      title="What counts as a missed call?"
      subtitle="Each enabled outcome creates a separate missed-call event. Classification only — not consent or messaging eligibility."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((opt) => (
          <SelectableCard
            key={opt.id}
            selected={opt.enabled}
            onClick={() => opt.onToggle(!opt.enabled)}
            title={opt.label}
            description={opt.helper}
          />
        ))}
      </div>
      {errorMessage ? (
        <p className="mt-3 text-[13px] font-medium text-rose-700" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </WizardQuestionBlock>
  );
}

export function MctbMessagingActivationPanel({
  statusLabel,
  usesA2pPath,
  approved,
  actionRequired,
  failureReason,
  numberDisplay,
}: {
  statusLabel: string;
  usesA2pPath: boolean;
  approved: boolean;
  actionRequired: boolean;
  failureReason?: string | null;
  numberDisplay: string;
}) {
  const steps = [
    {
      id: "assign",
      label: "Production number assigned",
      done: Boolean(numberDisplay),
    },
    {
      id: "details",
      label: "Business messaging profile complete",
      done: !actionRequired,
      detail: actionRequired ? "Fix highlighted fields in Messaging Compliance." : undefined,
    },
    {
      id: "submit",
      label: usesA2pPath ? "A2P registration submitted" : "Toll-free verification submitted",
      done: statusLabel !== "Not started" && statusLabel !== "",
    },
    {
      id: "approved",
      label: usesA2pPath ? "A2P messaging approved" : "Toll-free texting approved",
      done: approved,
    },
  ];

  return (
    <WizardPageLayout
      aside={
        <MctbConnectionStatusCard
          title="Number status"
          rows={[
            {
              label: "Text-back sender",
              value: numberDisplay || "—",
              mono: true,
              status: approved ? "ready" : actionRequired ? "attention" : "pending",
            },
            {
              label: usesA2pPath ? "A2P / 10DLC" : "Toll-free verification",
              value: statusLabel || "Not started",
              status: approved ? "ready" : actionRequired ? "attention" : "pending",
            },
          ]}
        />
      }
    >
      <MctbVerificationTimeline
        title={usesA2pPath ? "Activate A2P texting" : "Activate toll-free texting"}
        steps={steps}
        passed={approved}
        passedTitle="Messaging is ready — continue to forwarding"
        waitingHint={
          !approved
            ? "Your trial clock has not started. You can configure forwarding while verification completes."
            : undefined
        }
      />
      {actionRequired && failureReason ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[13px] text-amber-950">
          <p className="font-semibold">Action required before approval</p>
          <p className="mt-1 whitespace-pre-wrap">{failureReason}</p>
        </div>
      ) : null}
    </WizardPageLayout>
  );
}

export function MctbWizardControlBar({
  onBack,
  onContinue,
  onSaveExit,
  continueLabel = "Continue",
  backLabel = "Back",
  saveExitLabel = "Save & exit",
  busy,
  continueDisabled,
  showBack = true,
}: {
  onBack?: () => void;
  onContinue?: () => void;
  onSaveExit?: () => void;
  continueLabel?: string;
  backLabel?: string;
  saveExitLabel?: string;
  busy?: boolean;
  continueDisabled?: boolean;
  showBack?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-[#e6e8ef] pt-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        {showBack && onBack ? (
          <button
            type="button"
            onClick={onBack}
            disabled={busy}
            className="text-sm font-medium text-[#6b7280] hover:text-[#111827] disabled:opacity-50"
          >
            {backLabel}
          </button>
        ) : null}
        {onSaveExit ? (
          <button
            type="button"
            onClick={onSaveExit}
            disabled={busy}
            className="text-sm font-medium text-[#6b7280] hover:text-[#111827] disabled:opacity-50"
          >
            {saveExitLabel}
          </button>
        ) : null}
      </div>
      {onContinue ? (
        <button
          type="button"
          disabled={busy || continueDisabled}
          onClick={onContinue}
          className="voice-btn-primary min-w-[160px] disabled:opacity-50"
        >
          {busy ? "Saving…" : continueLabel}
          {!busy ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
        </button>
      ) : null}
    </div>
  );
}
