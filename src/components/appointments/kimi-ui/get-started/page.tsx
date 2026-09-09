"use client";

import type { ReactNode } from "react";
import SetupProgressCard from "./components/SetupProgressCard";
import StepList from "./components/StepList";
import AllSetBanner from "./components/AllSetBanner";
import LaunchReadinessCard from "./components/LaunchReadinessCard";
import BookingLinkCard from "./components/BookingLinkCard";
import QuickTipsCard from "./components/QuickTipsCard";
import type { SetupPageActions, SetupPageModel } from "@/features/appointments/kimi/setup/types";
import "./reference.css";

type Props = {
  model: SetupPageModel;
  actions: SetupPageActions;
  saving?: boolean;
  copied?: boolean;
  settingsSearch?: ReactNode;
};

export default function SetupView({ model, actions, saving = false, copied = false, settingsSearch }: Props) {
  return (
    <div className="setup-page" style={{ background: "#f7f7fa", minHeight: "100%" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 32px 56px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#1c1c2e",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Get Started <span style={{ fontSize: 22 }}>👋</span>
          </h1>
          <p style={{ fontSize: 13, color: "#8a8aa3", margin: "5px 0 0" }}>
            Set up your booking system and start taking appointments.
          </p>
          {settingsSearch ? <div style={{ marginTop: 16 }}>{settingsSearch}</div> : null}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 320px",
            gap: 24,
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            <SetupProgressCard progress={model.progress} onboardingComplete={model.onboardingComplete} />
            <StepList steps={model.steps} onNavigate={actions.onStepNavigate} />
            <AllSetBanner
              onboardingComplete={model.onboardingComplete}
              allDone={model.allDone}
              saving={saving}
              onMarkComplete={actions.onMarkComplete}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <LaunchReadinessCard readinessItems={model.readinessItems} />
            <BookingLinkCard
              bookingLink={model.bookingLink}
              copied={copied}
              onCopy={actions.onCopyBookingLink}
              onPreview={actions.onPreviewBooking}
            />
            <QuickTipsCard tips={model.quickTips} />
          </div>
        </div>
      </div>
    </div>
  );
}
