"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Building2,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Globe,
  MessageSquareText,
  PartyPopper,
  Send,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type SetupStatus = {
  typesCount: number;
  bookingEnabled: boolean;
  hasSlug: boolean;
  hasAvailability: boolean;
  remindersConfigured: boolean;
  onboardingComplete: boolean;
};

export function AppointmentsSetupClient() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/appointments/types").then((r) => r.json()),
      fetch("/api/appointments/settings").then((r) => r.json()),
    ]).then(([typesJson, settingsJson]) => {
      const data = settingsJson.data || {};
      const weekly = data.weeklyHours || {};
      setStatus({
        typesCount: (typesJson.data || []).length,
        bookingEnabled: Boolean(data.bookingEnabled),
        hasSlug: Boolean(settingsJson.workspace?.slug),
        hasAvailability: Object.keys(weekly).length > 0,
        remindersConfigured: Boolean(data.reminders?.confirmation?.enabled),
        onboardingComplete: Boolean(data.onboardingComplete),
      });
    });
  }, []);

  async function markComplete() {
    setSaving(true);
    try {
      await fetch("/api/appointments/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingComplete: true }),
      });
      setStatus((s) => (s ? { ...s, onboardingComplete: true } : s));
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    {
      title: "Business information",
      done: Boolean(status?.hasSlug),
      href: "/appointments/booking",
      detail: "Display name, timezone, and public booking link.",
      icon: Building2,
    },
    {
      title: "Set availability",
      done: Boolean(status?.hasAvailability),
      href: "/appointments/availability",
      detail: "Weekly hours, date overrides, and booking rules.",
      icon: Clock,
    },
    {
      title: "Create an appointment type",
      done: (status?.typesCount || 0) > 0,
      href: "/appointments/types",
      detail: "Name, duration, location, and booking questions.",
      icon: CalendarPlus,
    },
    {
      title: "Turn on booking page",
      done: Boolean(status?.bookingEnabled && status?.hasSlug),
      href: "/appointments/booking",
      detail: "Enable your public link and preview the customer flow.",
      icon: Globe,
    },
    {
      title: "Configure reminders",
      done: Boolean(status?.remindersConfigured),
      href: "/appointments/reminders",
      detail: "Preview templates and adjust timing.",
      icon: MessageSquareText,
    },
    {
      title: "Send test reminder",
      done: false,
      href: "/appointments/reminders",
      detail: "Send yourself a real test SMS before going live.",
      icon: Send,
    },
    {
      title: "Create/test booking",
      done: false,
      href: "/appointments/new",
      detail: "Book a test appointment and verify timeline + confirmations.",
      icon: PartyPopper,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const percent = Math.round((completed / steps.length) * 100);
  const loading = status === null;
  const allDone = percent === 100;
  const nextIndex = steps.findIndex((s) => !s.done);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">
          Set up your booking system
        </h1>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Finish these steps at your own pace — your booking tools keep working while you set up.
        </p>
      </div>

      {/* Progress summary */}
      <div className="surface rounded-xl bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                allDone || status?.onboardingComplete
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-primary/10 text-primary",
              )}
            >
              {allDone || status?.onboardingComplete ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight text-foreground">
                {loading
                  ? "Checking your progress…"
                  : status?.onboardingComplete
                    ? "Setup complete"
                    : `${completed} of ${steps.length} steps complete`}
              </p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {status?.onboardingComplete
                  ? "You're all set. You can revisit any step below."
                  : "Complete the remaining steps to get the most out of online booking."}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
              allDone
                ? "bg-emerald-50 text-emerald-700"
                : "bg-primary/10 text-primary",
            )}
          >
            {percent}%
          </span>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700 ease-out",
              allDone ? "bg-emerald-500" : "bg-primary",
            )}
            style={{ width: `${Math.max(percent, 3)}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <ol className="space-y-2.5">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const current = idx === nextIndex;
          return (
            <li key={step.title}>
              <Link
                href={step.href}
                className={cn(
                  "group surface flex items-center gap-4 rounded-xl bg-card p-4 transition-all duration-150 hover:-translate-y-px hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  current && "border-primary/30 shadow-sm",
                  step.done && "bg-card/70",
                )}
              >
                {/* Status indicator */}
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                    step.done
                      ? "bg-emerald-50 text-emerald-600"
                      : current
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {step.done ? (
                    <Check className="h-5 w-5" strokeWidth={2.5} />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </span>

                {/* Copy */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Step {idx + 1}
                    </span>
                    {step.done ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        Done
                      </span>
                    ) : current ? (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        Up next
                      </span>
                    ) : null}
                  </div>
                  <h2
                    className={cn(
                      "mt-0.5 font-display text-sm font-semibold tracking-tight",
                      step.done ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {step.title}
                  </h2>
                  <p className="mt-0.5 truncate text-[13px] leading-relaxed text-muted-foreground">
                    {step.detail}
                  </p>
                </div>

                {/* Action */}
                <span
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors",
                    step.done
                      ? "text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
                      : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
                  )}
                >
                  {step.done ? "Review" : "Start"}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      {/* Footer */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-dashed border-border bg-muted/20 p-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold tracking-tight text-foreground">
            {status?.onboardingComplete ? "Checklist completed" : "All done for now?"}
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
            {status?.onboardingComplete
              ? "Setup is marked complete. You can still revisit any step above."
              : "Mark setup as complete — you can come back to these steps anytime."}
          </p>
        </div>
        <Button
          onClick={markComplete}
          disabled={status?.onboardingComplete || saving || loading}
          variant={status?.onboardingComplete ? "secondary" : "primary"}
          className="shrink-0"
        >
          {status?.onboardingComplete ? (
            <>
              <Check className="h-4 w-4" /> Setup marked complete
            </>
          ) : saving ? (
            "Saving…"
          ) : (
            "Mark setup complete"
          )}
        </Button>
      </div>
    </div>
  );
}
