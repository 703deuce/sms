"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingComplete: true }),
    });
    setStatus((s) => (s ? { ...s, onboardingComplete: true } : s));
  }

  const steps = [
    {
      title: "Business information",
      done: Boolean(status?.hasSlug),
      href: "/appointments/booking",
      detail: "Display name, timezone, and public booking link.",
    },
    {
      title: "Set availability",
      done: Boolean(status?.hasAvailability),
      href: "/appointments/availability",
      detail: "Weekly hours, date overrides, and booking rules.",
    },
    {
      title: "Create an appointment type",
      done: (status?.typesCount || 0) > 0,
      href: "/appointments/types",
      detail: "Name, duration, location, and booking questions.",
    },
    {
      title: "Turn on booking page",
      done: Boolean(status?.bookingEnabled && status?.hasSlug),
      href: "/appointments/booking",
      detail: "Enable your public link and preview the customer flow.",
    },
    {
      title: "Configure reminders",
      done: Boolean(status?.remindersConfigured),
      href: "/appointments/reminders",
      detail: "Preview templates and adjust timing.",
    },
    {
      title: "Send test reminder",
      done: false,
      href: "/appointments/reminders",
      detail: "Send yourself a real test SMS before going live.",
    },
    {
      title: "Create/test booking",
      done: false,
      href: "/appointments/new",
      detail: "Book a test appointment and verify timeline + confirmations.",
    },
  ];

  const completed = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Set up your booking system</h1>
        <p className="mt-1 text-sm text-slate-500">
          {completed} of {steps.length} steps complete — finish at your own pace.
        </p>
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => (
          <Card key={step.title} className="rounded-xl border-slate-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">
                  {step.done ? "✓" : "○"} Step {idx + 1}
                </p>
                <h2 className="font-semibold text-slate-900">{step.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{step.detail}</p>
              </div>
              <Link href={step.href}>
                <Button variant="outline" size="sm">
                  {step.done ? "Review" : "Start"}
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <Button onClick={markComplete} disabled={status?.onboardingComplete}>
        {status?.onboardingComplete ? "Setup marked complete" : "Mark setup complete"}
      </Button>
    </div>
  );
}
