"use client";

import type { ReactNode } from "react";
import { Globe2, MapPin, Phone, Sparkles } from "lucide-react";
import StepIndicator from "./StepIndicator";
import type { Step } from "../page";

const HIDDEN_STEPS: Step[] = ["ai", "waitlist", "otp"];

export default function EmbedBookingShell({
  workspaceName,
  timezone,
  businessPhone,
  businessAddress,
  step,
  loading,
  onAiBooking,
  children,
}: {
  workspaceName: string;
  timezone: string;
  businessPhone: string;
  businessAddress: string;
  step: Step;
  loading?: boolean;
  onAiBooking: () => void;
  children: ReactNode;
}) {
  const tzShort = timezone === "America/New_York" ? "Eastern Time" : timezone;
  return (
    <div className="eb-shell">
      <div className="eb-shell__inner">
        <div className="eb-brand">
          <span className="eb-brand__mark" aria-hidden>
            {workspaceName.charAt(0).toUpperCase()}
          </span>
          <span className="eb-brand__name">{workspaceName}</span>
        </div>

        {!loading && !HIDDEN_STEPS.includes(step) && <StepIndicator step={step} />}

        <div className="eb-card">{children}</div>

        <footer className="eb-foot">
          <div className="eb-foot__row">
            <span className="eb-foot__item">
              <Globe2 size={13} aria-hidden /> Times shown in {tzShort}
            </span>
            {businessPhone ? (
              <span className="eb-foot__item">
                <Phone size={13} aria-hidden /> {businessPhone}
              </span>
            ) : null}
            {businessAddress ? (
              <span className="eb-foot__item">
                <MapPin size={13} aria-hidden /> {businessAddress}
              </span>
            ) : null}
          </div>
          {step === "service" && !loading && (
            <button
              type="button"
              className="eb-powered"
              onClick={onAiBooking}
              style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              <Sparkles size={13} aria-hidden /> Prefer to book with AI assistance?
            </button>
          )}
          <span className="eb-powered">
            <ShieldMark /> Secure booking by Transovo
          </span>
        </footer>
      </div>
    </div>
  );
}

function ShieldMark() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}
