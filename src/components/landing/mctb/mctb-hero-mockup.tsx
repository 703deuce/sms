"use client";

import { useState } from "react";
import { Bell, CheckCircle2 } from "lucide-react";

type ConsentMode = "press_1" | "existing_consent";

export function MctbHeroMockup() {
  const [mode, setMode] = useState<ConsentMode>("press_1");

  return (
    <div className="mctb-hero-mock mctb-hero-mock-opus" aria-hidden>
      <div className="mctb-hero-mock-chrome">
        <span className="mctb-hero-mock-dot" />
        <span className="mctb-hero-mock-dot" />
        <span className="mctb-hero-mock-dot" />
        <span className="mctb-hero-mock-titlebar">Recovery preview · Lakeside Dental</span>
      </div>
      <div className="mctb-hero-mock-toolbar">
        <span className="mctb-mock-label">Consent path</span>
        <div className="mctb-consent-toggle" role="tablist" aria-hidden>
          <button
            type="button"
            role="tab"
            className={mode === "press_1" ? "active" : ""}
            onClick={() => setMode("press_1")}
          >
            Press 1
          </button>
          <button
            type="button"
            role="tab"
            className={mode === "existing_consent" ? "active" : ""}
            onClick={() => setMode("existing_consent")}
          >
            Existing permission
          </button>
        </div>
      </div>
      <div className="mctb-hero-mock-body">
        <div className="mctb-call-card">
          <p className="mctb-mock-label">Missed call</p>
          <p className="mctb-mock-title">(571) 555-0198</p>
          <p className="mctb-mock-sub">Your business line · No answer</p>
        </div>

        {mode === "press_1" ? (
          <>
            <div className="mctb-flow-arrow">Forwarded · caller hears disclosure</div>
            <div className="mctb-ivr-card">
              <div className="mctb-keypad">
                <span>Press</span>
                <strong>1</strong>
                <span>to get a text</span>
              </div>
            </div>
          </>
        ) : (
          <div className="mctb-flow-arrow">Voicemail greeting · call ends · recovery texts automatically</div>
        )}

        <div className="mctb-sms-thread">
          {mode === "press_1" ? (
            <div className="mctb-bubble system compact">
              <p className="mctb-bubble-kicker">Compliance</p>
              <p>You&apos;re subscribed to texts about your inquiry to Lakeside Dental. Reply STOP to opt out.</p>
            </div>
          ) : null}
          <div className="mctb-bubble business">
            <p className="mctb-bubble-kicker">Recovery text · On a job</p>
            <p>
              Hi, this is Lakeside Dental. Sorry we missed you — we&apos;re on a job right now. We&apos;ll call you
              back within 30 minutes. Reply with your name, what you need, and your address.
            </p>
          </div>
          <div className="mctb-bubble customer">
            <p>Sarah — need a cleaning, 142 Oak St.</p>
          </div>
          <div className="mctb-bubble business ack">
            <p className="mctb-bubble-kicker">One automatic reply</p>
            <p>Thanks Sarah — we got your message and will call you within 30 minutes.</p>
          </div>
        </div>

        <div className="mctb-hero-outcomes">
          <span className="mctb-outcome-pill">
            <Bell className="h-3.5 w-3.5" aria-hidden />
            Team notified
          </span>
          <span className="mctb-outcome-pill highlight">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Needs follow-up
          </span>
          <span className="mctb-outcome-pill muted">Automation stopped</span>
        </div>
      </div>
    </div>
  );
}
