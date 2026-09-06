"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SetupProgressCard from "./components/SetupProgressCard";
import StepList from "./components/StepList";
import AllSetBanner from "./components/AllSetBanner";
import LaunchReadinessCard from "./components/LaunchReadinessCard";
import BookingLinkCard from "./components/BookingLinkCard";
import QuickTipsCard from "./components/QuickTipsCard";
import { SetupLoading, SetupError, StateSwitcher, type SetupViewState } from "./components/States";
import {
  setupModelPartial,
  setupModelEmpty,
  setupModelComplete,
  setupModelReadOnly,
  type SetupPageModel,
} from "./mock-data";
import "./reference.css";

const MODELS: Record<Exclude<SetupViewState, "loading" | "error">, SetupPageModel> = {
  partial: setupModelPartial,
  empty: setupModelEmpty,
  complete: setupModelComplete,
  readonly: setupModelReadOnly,
};

export default function ReferencePage() {
  const [viewState, setViewState] = useState<SetupViewState>("loading");
  const [model, setModel] = useState<SetupPageModel | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Simulated load against the API contracts (/api/appointments/settings + /api/appointments/types)
  const load = useCallback((target: SetupViewState = "partial") => {
    setViewState("loading");
    setModel(null);
    const timer = window.setTimeout(() => {
      if (target === "error") {
        setViewState("error");
        return;
      }
      setModel(MODELS[target]);
      setViewState(target);
    }, 900);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const cancel = load("partial");
    return cancel;
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  const handleStateChange = useCallback((next: SetupViewState) => {
    if (next === "loading") {
      setViewState("loading");
      return;
    }
    if (next === "error") {
      setViewState("error");
      return;
    }
    setModel(MODELS[next]);
    setViewState(next);
  }, []);

  const readOnly = Boolean(model?.readOnly);

  const actions = useMemo(
    () => ({
      onStepNavigate: (href: string) => {
        setToast(`Navigating to ${href}`);
      },
      onMarkComplete: async () => {
        if (readOnly) return;
        setSaving(true);
        // Mirrors PATCH /api/appointments/settings { onboardingComplete: true }
        window.setTimeout(() => {
          setSaving(false);
          setModel((m) => (m ? { ...m, onboardingComplete: true } : m));
          setToast("Setup marked as complete");
        }, 700);
      },
      onCopyBookingLink: async () => {
        if (!model?.bookingLink) return;
        try {
          await navigator.clipboard.writeText(`https://${model.bookingLink}`);
        } catch {
          /* clipboard unavailable in sandbox */
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      onPreviewBooking: () => {
        setToast(`Previewing ${model?.bookingPath ?? "booking page"}`);
      },
      onRetry: () => load("partial"),
    }),
    [load, model, readOnly],
  );

  if (viewState === "loading") return <SetupLoading />;
  if (viewState === "error" || !model) return <SetupError onRetry={actions.onRetry} />;

  return (
    <div className="setup-page" style={{ background: "#f7f7fa", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 32px 56px" }}>
        {/* Page header — title top-left, sandbox state switcher as secondary control */}
        <div
          style={{
            marginBottom: 24,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--setup-muted)",
                margin: "0 0 4px",
                letterSpacing: "0.02em",
              }}
            >
              Appointments
            </p>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--setup-text)",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Get started
            </h1>
            <p style={{ fontSize: 13, color: "var(--setup-muted)", margin: "5px 0 0" }}>
              Set up your booking system and start taking appointments.
            </p>
          </div>
          <StateSwitcher state={viewState} onChange={handleStateChange} />
        </div>

        {/* Read-only / permission state notice */}
        {readOnly && (
          <div className="setup-notice" role="note">
            <span style={{ fontWeight: 600 }}>View only.</span> You have read-only access to this
            workspace. An owner or admin can change setup and mark it complete.
          </div>
        )}

        <div
          className="setup-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 320px",
            gap: 24,
            alignItems: "start",
          }}
        >
          {/* Primary column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            <SetupProgressCard progress={model.progress} onboardingComplete={model.onboardingComplete} />
            <StepList steps={model.steps} onNavigate={actions.onStepNavigate} />
            <AllSetBanner
              onboardingComplete={model.onboardingComplete}
              allDone={model.allDone}
              saving={saving}
              readOnly={readOnly}
              onMarkComplete={actions.onMarkComplete}
            />
          </div>

          {/* Secondary column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <LaunchReadinessCard
              readinessItems={model.readinessItems}
              steps={model.steps}
              onNavigate={actions.onStepNavigate}
            />
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

      {/* Toast */}
      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1c1c2e",
            color: "#fff",
            fontSize: 13,
            fontWeight: 500,
            padding: "10px 18px",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(28,28,46,0.25)",
            zIndex: 50,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
