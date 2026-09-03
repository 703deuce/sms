"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { useEffect, useState } from "react";

type SetupStatus = {
  typesCount: number;
  bookingEnabled: boolean;
  hasSlug: boolean;
  onboardingComplete: boolean;
};

export function AppointmentsSetupClient() {
  const [status, setStatus] = useState<SetupStatus | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/appointments/types").then((r) => r.json()),
      fetch("/api/appointments/settings").then((r) => r.json()),
    ]).then(([typesJson, settingsJson]) => {
      setStatus({
        typesCount: (typesJson.data || []).length,
        bookingEnabled: Boolean(settingsJson.data?.bookingEnabled),
        hasSlug: Boolean(settingsJson.workspace?.slug),
        onboardingComplete: Boolean(settingsJson.data?.onboardingComplete),
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
      title: "Create an appointment type",
      done: (status?.typesCount || 0) > 0,
      href: "/appointments/types",
      detail: "Name, duration, availability hours, and booking notice.",
    },
    {
      title: "Connect your calendar",
      done: false,
      href: "/voice/calendars",
      detail: "Google or Microsoft — drives live availability and prevents double-booking.",
    },
    {
      title: "Configure reminders",
      done: false,
      href: "/appointments/reminders",
      detail: "Preview templates and send yourself a test SMS.",
    },
    {
      title: "Enable your booking page",
      done: Boolean(status?.bookingEnabled && status?.hasSlug),
      href: "/appointments/booking",
      detail: "Copy your public link and preview the customer experience.",
    },
    {
      title: "Book a test appointment",
      done: false,
      href: "/appointments/new",
      detail: "Verify slots, confirmation SMS, and timeline on the detail page.",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Get started</h1>
        <p className="mt-1 text-sm text-slate-500">
          Complete these steps to launch online booking and SMS reminders.
        </p>
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => (
          <Card key={step.title} className="rounded-xl border-slate-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Step {idx + 1}</p>
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
