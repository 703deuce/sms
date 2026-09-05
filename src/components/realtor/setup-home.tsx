import type { SetupHomeStep, SetupStepStatus } from "@/lib/realtor/setup-home";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Headphones,
  Play,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

function StepIcon({ step }: { step: SetupHomeStep }) {
  if (step.status === "complete") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white">
        <Check className="h-5 w-5" strokeWidth={2.5} />
      </span>
    );
  }
  if (step.status === "pending") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
        <AlertCircle className="h-5 w-5" />
      </span>
    );
  }
  if (step.status === "ready") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#6366f1] text-sm font-bold text-white">
        {step.stepNumber}
      </span>
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e5e7eb] text-sm font-bold text-[#6b7280]">
      {step.stepNumber}
    </span>
  );
}

function actionClass(status: SetupStepStatus, label: string): string {
  if (status === "complete" || label === "Complete") {
    return "text-violet-600 font-semibold";
  }
  if (status === "ready") {
    return "realtor-btn-outline realtor-btn-outline-blue";
  }
  if (status === "pending") {
    return "realtor-btn-outline realtor-btn-outline-blue";
  }
  return "realtor-btn-outline text-[#6b7280]";
}

function SetupRow({ step }: { step: SetupHomeStep }) {
  const isCompleteAction = step.status === "complete" || step.actionLabel === "Complete";

  return (
    <div className="realtor-card flex items-center gap-4 px-5 py-4">
      <StepIcon step={step} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-semibold text-[#111827]">{step.title}</h3>
          {step.subtitle ? (
            <span className="text-[13px] text-[#6b7280]">({step.subtitle})</span>
          ) : null}
          {step.status === "pending" ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              Pending
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-[13px] text-[#6b7280]">{step.description}</p>
      </div>
      <Link
        href={step.href}
        className={cn(
          "inline-flex h-9 items-center gap-1 text-[13px]",
          isCompleteAction ? "text-violet-600 font-semibold px-2" : actionClass(step.status, step.actionLabel),
        )}
      >
        {step.actionLabel}
        <ChevronRight className="h-4 w-4 opacity-60" />
      </Link>
    </div>
  );
}

export function SetupHomeView({
  requiredComplete,
  requiredTotal,
  steps,
  readyToGoLive,
}: {
  requiredComplete: number;
  requiredTotal: number;
  steps: SetupHomeStep[];
  readyToGoLive: boolean;
  live: boolean;
}) {
  const pct = requiredTotal ? Math.round((requiredComplete / requiredTotal) * 100) : 0;

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">
                Let&apos;s get your AI system ready 👋
              </h1>
              <p className="mt-2 text-[15px] text-[#6b7280]">
                Follow the steps below to launch Amy and start working more leads.
              </p>
            </div>
            <div className="realtor-card min-w-[200px] px-4 py-3">
              <p className="text-[13px] font-semibold text-[#111827]">
                {requiredComplete} of {requiredTotal} steps complete
              </p>
              <p className="text-[12px] text-[#6b7280]">{pct}%</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e5e7eb]">
                <div
                  className="h-full rounded-full bg-[#6366f1] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {steps.map((step) => (
              <SetupRow key={step.id} step={step} />
            ))}
          </div>

          {readyToGoLive || requiredComplete < requiredTotal ? (
            <div className="mt-6 flex items-center gap-4 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-5 py-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6366f1] text-white">
                <Sparkles className="h-5 w-5" />
              </span>
              <p className="flex-1 text-[14px] text-[#1e40af]">
                Almost there! Finish the remaining steps to activate Amy and start capturing
                more opportunities.
              </p>
              <Link href="/realtor/test" className="realtor-btn-primary shrink-0">
                <Headphones className="h-4 w-4" />
                Test Amy
              </Link>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="realtor-card overflow-hidden p-0">
            <div className="flex h-28 items-end justify-center bg-gradient-to-br from-[#dbeafe] to-[#eff6ff] px-4 pb-2">
              <svg viewBox="0 0 120 64" className="h-20 w-auto text-[#6366f1]" aria-hidden>
                <path
                  fill="currentColor"
                  opacity="0.25"
                  d="M60 8 L95 32 V52 H25 V32 Z"
                />
                <path fill="currentColor" d="M60 14 L88 34 V48 H32 V34 Z" />
                <rect x="52" y="36" width="16" height="12" fill="#eff6ff" />
                <circle cx="24" cy="48" r="8" fill="currentColor" opacity="0.35" />
                <circle cx="96" cy="44" r="10" fill="currentColor" opacity="0.2" />
              </svg>
            </div>
            <div className="px-4 pb-4 pt-3">
              <h3 className="font-semibold text-[#111827]">What is Amy?</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[#6b7280]">
                Amy is your AI receptionist and lead assistant. She answers calls, qualifies
                leads, books appointments, and follows up 24/7 so you never miss an opportunity.
              </p>
              <Link href="/realtor/agents/front-desk" className="mt-3 text-[13px] font-semibold text-[#6366f1]">
                Learn more &gt;
              </Link>
            </div>
          </div>

          <div className="realtor-card p-4">
            <h3 className="font-semibold text-[#111827]">Need help?</h3>
            <ul className="mt-3 space-y-3 text-[13px]">
              <li>
                <Link href="/getting-started" className="flex items-center gap-2 text-[#374151] hover:text-[#6366f1]">
                  <Play className="h-4 w-4 text-[#6366f1]" />
                  Watch Setup Guide
                </Link>
              </li>
              <li>
                <Link href="/getting-started" className="flex items-center gap-2 text-[#374151] hover:text-[#6366f1]">
                  <span className="flex h-4 w-4 items-center justify-center text-[#6366f1]">📅</span>
                  Join Live Training
                </Link>
              </li>
              <li>
                <Link href="/getting-started" className="flex items-center gap-2 text-[#374151] hover:text-[#6366f1]">
                  <Headphones className="h-4 w-4 text-[#6366f1]" />
                  Contact Support
                </Link>
              </li>
            </ul>
            <p className="mt-4 text-[13px] font-medium text-[#6366f1]">We&apos;re here for you! 💙</p>
          </div>
        </div>
      </div>
    </div>
  );
}
