"use client";

import { useState } from "react";
import {
  ArrowLeft,
  BellRing,
  Check,
  CheckCircle2,
  MessageSquare,
  Mail,
  Phone,
} from "lucide-react";
import { Badge, Chip } from "./ui";
import {
  BOOKING_TYPES,
  describeTiming,
  triggerLabel,
  ACTION_OPTIONS,
  type WorkflowTemplate,
} from "../types";

type WizardStep = "overview" | "configure" | "review" | "done";

const STEPS: Array<{ id: WizardStep; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "configure", label: "Configure" },
  { id: "review", label: "Review" },
];

function StepIndicator({ current }: { current: WizardStep }) {
  const currentIndex =
    current === "done" ? STEPS.length : STEPS.findIndex((s) => s.id === current);
  return (
    <div className="tv-wizard-steps" aria-label="Setup progress">
      {STEPS.map((step, i) => (
        <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            className={`tv-wizard-step ${i === currentIndex ? "active" : ""} ${
              i < currentIndex ? "done" : ""
            }`}
          >
            <span className="tv-wizard-step-num">
              {i < currentIndex ? <Check size={13} strokeWidth={3} /> : i + 1}
            </span>
            {step.label}
          </div>
          {i < STEPS.length - 1 && <span className="tv-wizard-sep" />}
        </div>
      ))}
    </div>
  );
}

export function SetupWizard({
  template,
  onCancel,
  onComplete,
}: {
  template: WorkflowTemplate;
  onCancel: () => void;
  onComplete: (workflowId: string) => void;
}) {
  const [step, setStep] = useState<WizardStep>("overview");
  const [name, setName] = useState(template.name);
  const [bookingType, setBookingType] = useState("all");
  const [channels, setChannels] = useState<string[]>(template.channels);
  const [installing, setInstalling] = useState(false);

  const toggleChannel = (c: string) =>
    setChannels((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  const install = () => {
    setInstalling(true);
    setTimeout(() => {
      setStep("done");
      setInstalling(false);
    }, 900);
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="tv-container" style={{ maxWidth: 860 }}>
      <button className="tv-back" onClick={onCancel}>
        <ArrowLeft size={15} />
        Back to templates
      </button>

      <div className="tv-page-head" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="tv-page-title">Set up: {template.name}</h1>
          <p className="tv-page-desc">{template.description}</p>
        </div>
      </div>

      <StepIndicator current={step} />

      {/* ------- Step 1: Overview ------- */}
      {step === "overview" && (
        <div className="tv-card tv-wizard-card">
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>What this workflow does</h2>
          <p style={{ fontSize: 13.5, color: "var(--tv-text-muted)", margin: "0 0 18px" }}>
            Runs automatically when <b>{triggerLabel(template.trigger).toLowerCase()}</b>.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {template.steps.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  gap: 14,
                  padding: "12px 0",
                  borderBottom:
                    i < template.steps.length - 1 ? "1px solid var(--tv-border)" : "none",
                }}
              >
                <span className="tv-step-num" style={{ marginTop: 1 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.name}</span>
                    <Badge tone="muted">{describeTiming(s.timing)}</Badge>
                    <Chip>{s.channel}</Chip>
                  </div>
                  {s.messageTemplate && (
                    <p
                      style={{
                        fontSize: 12.5,
                        color: "var(--tv-text-muted)",
                        margin: "5px 0 0",
                        lineHeight: 1.45,
                      }}
                    >
                      {s.messageTemplate}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="tv-sticky-actions">
            <button className="tv-btn tv-btn-outline" onClick={onCancel}>
              Cancel
            </button>
            <button className="tv-btn tv-btn-primary" onClick={() => setStep("configure")}>
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ------- Step 2: Configure ------- */}
      {step === "configure" && (
        <div className="tv-card tv-wizard-card">
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 18px" }}>Configure</h2>

          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label className="tv-label" htmlFor="wf-name">Workflow name</label>
              <input
                id="wf-name"
                className="tv-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="tv-label" htmlFor="wf-type">Applies to</label>
              <select
                id="wf-type"
                className="tv-select"
                value={bookingType}
                onChange={(e) => setBookingType(e.target.value)}
              >
                <option value="all">All booking types</option>
                {BOOKING_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <span className="tv-label">Channels</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { id: "sms", label: "SMS", icon: MessageSquare },
                  { id: "email", label: "Email", icon: Mail },
                  { id: "voice", label: "Voice reminder", icon: Phone },
                ].map((c) => {
                  const active = channels.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleChannel(c.id)}
                      className="tv-btn tv-btn-outline"
                      style={{
                        borderColor: active ? "var(--tv-accent)" : undefined,
                        background: active ? "var(--tv-accent-soft)" : undefined,
                        color: active ? "var(--tv-accent)" : undefined,
                      }}
                      aria-pressed={active}
                    >
                      <c.icon size={14} />
                      {c.label}
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: 12, color: "var(--tv-text-muted)", margin: "8px 0 0" }}>
                Voice reminders use your default voice reminder template. SMS requires an active messaging sender.
              </p>
            </div>
          </div>

          <div className="tv-sticky-actions">
            <button className="tv-btn tv-btn-outline" onClick={() => setStep("overview")}>
              Back
            </button>
            <button
              className="tv-btn tv-btn-primary"
              onClick={() => setStep("review")}
              disabled={!name.trim() || channels.length === 0}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ------- Step 3: Review ------- */}
      {step === "review" && (
        <div className="tv-card tv-wizard-card">
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>Review and install</h2>
          <p style={{ fontSize: 13.5, color: "var(--tv-text-muted)", margin: "0 0 8px" }}>
            This workflow becomes active immediately after install.
          </p>

          <div className="tv-summary-row">
            <span className="tv-summary-label">Workflow</span>
            <span className="tv-summary-value" style={{ fontWeight: 600 }}>{name}</span>
          </div>
          <div className="tv-summary-row">
            <span className="tv-summary-label">Trigger</span>
            <span className="tv-summary-value">{triggerLabel(template.trigger)}</span>
          </div>
          <div className="tv-summary-row">
            <span className="tv-summary-label">Applies to</span>
            <span className="tv-summary-value">
              {bookingType === "all"
                ? "All booking types"
                : BOOKING_TYPES.find((t) => t.id === bookingType)?.name}
            </span>
          </div>
          <div className="tv-summary-row">
            <span className="tv-summary-label">Channels</span>
            <span className="tv-summary-value" style={{ textTransform: "capitalize" }}>
              {channels.join(", ")}
            </span>
          </div>
          <div className="tv-summary-row">
            <span className="tv-summary-label">Steps</span>
            <span className="tv-summary-value">
              {template.steps.map((s) => `${s.name} (${describeTiming(s.timing).toLowerCase()})`).join(" → ")}
            </span>
          </div>

          <div className="tv-sticky-actions">
            <button className="tv-btn tv-btn-outline" onClick={() => setStep("configure")}>
              Back
            </button>
            <button className="tv-btn tv-btn-primary" onClick={install} disabled={installing}>
              <BellRing size={15} />
              {installing ? "Installing…" : "Install workflow"}
            </button>
          </div>
        </div>
      )}

      {/* ------- Step 4: Success ------- */}
      {step === "done" && (
        <div className="tv-card tv-wizard-card tv-success-hero">
          <div className="tv-success-ring">
            <CheckCircle2 size={26} />
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{name} is live</h2>
          <p
            style={{
              fontSize: 13.5,
              color: "var(--tv-text-muted)",
              margin: "8px 0 22px",
              maxWidth: 420,
            }}
          >
            The workflow is now active and will run when{" "}
            {triggerLabel(template.trigger).toLowerCase()}. You can edit steps, timing, and
            messages at any time.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="tv-btn tv-btn-outline" onClick={onCancel}>
              Back to templates
            </button>
            <button
              className="tv-btn tv-btn-primary"
              onClick={() => onComplete(`wf_${Date.now()}`)}
            >
              Edit workflow
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "none" }}>{stepIndex}</div>
    </div>
  );
}
