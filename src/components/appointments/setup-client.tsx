"use client";

import { useEffect, useMemo, useState } from "react";
import ProgressHeader from "./rebuild/get-started/components/ProgressHeader";
import SetupStepsList from "./rebuild/get-started/components/SetupStepsList";
import LaunchReadiness from "./rebuild/get-started/components/LaunchReadiness";
import BookingLinkCard from "./rebuild/get-started/components/BookingLinkCard";
import QuickTips from "./rebuild/get-started/components/QuickTips";
import AllSetCard from "./rebuild/get-started/components/AllSetCard";
import type { QuickTip, SetupStep, SetupSummary } from "./rebuild/get-started/types";
import "./rebuild/get-started/reference.css";

type SetupStatus = {
  typesCount: number;
  bookingEnabled: boolean;
  hasSlug: boolean;
  hasAvailability: boolean;
  remindersConfigured: boolean;
  onboardingComplete: boolean;
  workspaceSlug: string;
};

const STEP_DEFINITIONS = [
  {
    title: "Business information",
    detail: "Display name, timezone, and public booking link.",
    href: "/appointments/booking",
    icon: "building",
    isDone: (s: SetupStatus) => s.hasSlug,
  },
  {
    title: "Set availability",
    detail: "Weekly hours, date overrides, and booking rules.",
    href: "/appointments/availability",
    icon: "calendar",
    isDone: (s: SetupStatus) => s.hasAvailability,
  },
  {
    title: "Create an appointment type",
    detail: "Name, duration, location, and booking questions.",
    href: "/appointments/types",
    icon: "calendar-clock",
    isDone: (s: SetupStatus) => s.typesCount > 0,
  },
  {
    title: "Turn on booking page",
    detail: "Enable your public link and preview the customer flow.",
    href: "/appointments/booking",
    icon: "globe",
    isDone: (s: SetupStatus) => s.bookingEnabled && s.hasSlug,
  },
  {
    title: "Configure reminders",
    detail: "Preview templates and adjust timing.",
    href: "/appointments/reminders",
    icon: "bell",
    isDone: (s: SetupStatus) => s.remindersConfigured,
  },
  {
    title: "Send test reminder",
    detail: "Send yourself a real test SMS before going live.",
    href: "/appointments/reminders",
    icon: "send",
    isDone: () => false,
  },
  {
    title: "Create/test booking",
    detail: "Book a test appointment and verify timeline + confirmations.",
    href: "/appointments/new",
    icon: "party",
    isDone: () => false,
  },
] as const;

const QUICK_TIPS: QuickTip[] = [
  {
    id: 1,
    title: "Set clear availability",
    description: "Add date overrides for holidays and special hours.",
    icon: "clock",
    href: "/appointments/availability",
  },
  {
    id: 2,
    title: "Add booking questions",
    description: "Collect details upfront to save time.",
    icon: "clock",
    href: "/appointments/types",
  },
  {
    id: 3,
    title: "Test end-to-end",
    description: "Book a test to confirm reminders and flow.",
    icon: "send",
    href: "/appointments/new",
  },
];

function estimateRemainingMinutes(remaining: number) {
  if (remaining <= 0) return "Done";
  if (remaining === 1) return "~5 min";
  if (remaining <= 3) return "10–15 min";
  return "20–30 min";
}

function buildSteps(status: SetupStatus | null): SetupStep[] {
  const nextIndex = STEP_DEFINITIONS.findIndex((def) => !status || !def.isDone(status));

  return STEP_DEFINITIONS.map((def, idx) => {
    const done = Boolean(status && def.isDone(status));
    const upNext = !done && idx === nextIndex;

    return {
      id: idx + 1,
      label: `Step ${idx + 1}`,
      status: done ? "done" : upNext ? "up-next" : "not-started",
      statusText: done ? "Done" : upNext ? "Up next" : undefined,
      title: def.title,
      description: def.detail,
      action: done ? "review" : "start",
      icon: def.icon,
      href: def.href,
    };
  });
}

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
        workspaceSlug: settingsJson.workspace?.slug || "",
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

  const steps = useMemo(() => buildSteps(status), [status]);
  const completed = steps.filter((s) => s.status === "done").length;
  const total = steps.length;
  const percent = Math.round((completed / total) * 100);
  const loading = status === null;
  const nextIndex = steps.findIndex((s) => s.status !== "done");
  const inProgress = nextIndex >= 0 ? 1 : 0;
  const notStarted = Math.max(total - completed - inProgress, 0);
  const remaining = total - completed;

  const summary: SetupSummary = {
    completed,
    total,
    percent,
    inProgress,
    notStarted,
    estTime: estimateRemainingMinutes(remaining),
  };

  const bookingPath = status?.workspaceSlug ? `/book/${status.workspaceSlug}` : "";
  const bookingUrl =
    typeof window !== "undefined" && bookingPath
      ? `${window.location.origin}${bookingPath}`
      : bookingPath;

  const progressHeadline = loading
    ? "Checking progress…"
    : status?.onboardingComplete
      ? "Setup complete"
      : completed === 0
        ? "Let's get started!"
        : percent === 100
          ? "All steps complete!"
          : "Almost there!";

  return (
    <div className="setup-page">
      <div className="setup-page__header">
        <h1 className="setup-page__title">
          Get Started <span className="setup-page__wave" aria-hidden>👋</span>
        </h1>
        <p className="setup-page__subtitle">
          Set up your booking system and start taking appointments.
        </p>
      </div>

      <div className="setup-page__grid">
        <div className="setup-page__main">
          <ProgressHeader summary={summary} headline={progressHeadline} />
          <SetupStepsList steps={steps} />
          <AllSetCard
            onboardingComplete={Boolean(status?.onboardingComplete)}
            saving={saving}
            loading={loading}
            onMarkComplete={markComplete}
          />
        </div>
        <div className="setup-page__aside">
          <LaunchReadiness percent={percent} steps={steps} />
          <BookingLinkCard
            bookingUrl={bookingUrl}
            previewHref={bookingPath}
            hasSlug={Boolean(status?.hasSlug)}
          />
          <QuickTips tips={QUICK_TIPS} />
        </div>
      </div>
    </div>
  );
}
