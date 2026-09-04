"use client";

import SetupProgressCard from "./components/SetupProgressCard";
import StepList from "./components/StepList";
import AllSetBanner from "./components/AllSetBanner";
import LaunchReadinessCard from "./components/LaunchReadinessCard";
import BookingLinkCard from "./components/BookingLinkCard";
import QuickTipsCard from "./components/QuickTipsCard";
import "./reference.css";

export default function AppointmentsSetupPage() {
  return (
    <div className="setup-page" style={{ background: "#f7f7fa", minHeight: "100%" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 32px 48px" }}>
        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "#1c1c2e",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            Get Started <span style={{ fontSize: 24 }}>👋</span>
          </h1>
          <p style={{ fontSize: 13.5, color: "#8a8aa3", margin: "6px 0 0" }}>
            Set up your booking system and start taking appointments.
          </p>
        </div>

        {/* Two-column layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 320px",
            gap: 22,
            alignItems: "start",
          }}
        >
          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
            <SetupProgressCard />
            <StepList />
            <AllSetBanner />
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <LaunchReadinessCard />
            <BookingLinkCard />
            <QuickTipsCard />
          </div>
        </div>
      </div>
    </div>
  );
}
