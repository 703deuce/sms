import React from "react";
import ProgressHeader from "./components/ProgressHeader";
import SetupStepsList from "./components/SetupStepsList";
import LaunchReadiness from "./components/LaunchReadiness";
import BookingLinkCard from "./components/BookingLinkCard";
import QuickTips from "./components/QuickTips";
import AllSetCard from "./components/AllSetCard";
import type { QuickTip, SetupStep, SetupSummary } from "./types";
import "./reference.css";

const DEMO_STEPS: SetupStep[] = [
  {
    id: 1,
    label: "Step 1",
    status: "done",
    statusText: "Done",
    title: "Business information",
    description: "Display name, timezone, and public booking link.",
    action: "review",
    icon: "building",
    href: "/appointments/booking",
  },
  {
    id: 2,
    label: "Step 2",
    status: "up-next",
    statusText: "Up next",
    title: "Set availability",
    description: "Define your weekly hours, date overrides, and booking rules.",
    action: "start",
    icon: "calendar",
    href: "/appointments/availability",
  },
];

const DEMO_SUMMARY: SetupSummary = {
  completed: 1,
  total: 7,
  percent: 14,
  inProgress: 1,
  notStarted: 5,
  estTime: "20–30 min",
};

const DEMO_TIPS: QuickTip[] = [
  {
    id: 1,
    title: "Set clear availability",
    description: "Add date overrides for holidays and special hours.",
    icon: "clock",
    href: "/appointments/availability",
  },
];

export default function ReferencePage() {
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
          <ProgressHeader summary={DEMO_SUMMARY} />
          <SetupStepsList steps={DEMO_STEPS} />
          <AllSetCard
            onboardingComplete={false}
            saving={false}
            loading={false}
            onMarkComplete={() => undefined}
          />
        </div>
        <div className="setup-page__aside">
          <LaunchReadiness percent={DEMO_SUMMARY.percent} steps={DEMO_STEPS} />
          <BookingLinkCard bookingUrl="" previewHref="" hasSlug={false} />
          <QuickTips tips={DEMO_TIPS} />
        </div>
      </div>
    </div>
  );
}
