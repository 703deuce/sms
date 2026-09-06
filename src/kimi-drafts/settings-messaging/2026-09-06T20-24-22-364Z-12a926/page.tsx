"use client";

import { useEffect, useState } from "react";
import "./reference.css";
import { registration as mockRegistration, runtime as mockRuntime, settingsTabs, timezones } from "./mock-data";
import { SettingsTabs } from "./components/SettingsTabs";
import { RegistrationCard } from "./components/RegistrationCard";
import { AwayHoursCard } from "./components/AwayHoursCard";
import { QuietHoursCard } from "./components/QuietHoursCard";
import { ComplianceCard } from "./components/ComplianceCard";
import { ConsentCopyCard } from "./components/ConsentCopyCard";
import { Button } from "./components/ui";
import { CheckCircle2, ShieldCheck } from "lucide-react";

type Runtime = typeof mockRuntime;
type ConsentCopy = {
  optInDescription: string;
  consentText: string;
  termsVersion: string;
  capturedAt: string;
};

export default function ReferencePage() {
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runtimeSaving, setRuntimeSaving] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [runtimeSaved, setRuntimeSaved] = useState(false);
  const [consentSaved, setConsentSaved] = useState(false);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState<ConsentCopy>({
    optInDescription: mockRegistration.optInDescription,
    consentText: mockRegistration.consentText,
    termsVersion: mockRegistration.termsVersion,
    capturedAt: mockRegistration.consentCapturedAt,
  });
  const [consentDirty, setConsentDirty] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setRuntime(mockRuntime);
      setLoading(false);
    }, 450);
    return () => clearTimeout(t);
  }, []);

  async function saveHelpStop(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    await new Promise((r) => setTimeout(r, 700));
    setSaving(false);
    setSaved(true);
  }

  async function saveRuntime(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRuntimeSaving(true);
    setError("");
    setRuntimeSaved(false);
    await new Promise((r) => setTimeout(r, 700));
    setRuntimeSaving(false);
    setRuntimeSaved(true);
  }

  async function saveConsent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setConsentSaved(false);
    const text = consent.consentText.trim();
    if (!text) {
      setError("Consent text can't be empty — this wording is shown on the booking page and stored as evidence for each opt-in.");
      return;
    }
    setConsentSaving(true);
    await new Promise((r) => setTimeout(r, 700));
    setConsentSaving(false);
    setConsentSaved(true);
    setConsentDirty(false);
  }

  return (
    <div className="ref-page">
      <div className="ref-header">
        <div>
          <h1 className="ref-title">Messaging settings</h1>
          <p className="ref-desc">
            Quiet hours, away messages, compliance footers, STOP handling, and send limits for your workspace.
          </p>
        </div>
        <div className="ref-header-actions">
          <Button type="submit" form="messaging-runtime-form" disabled={runtimeSaving || loading}>
            {runtimeSaving ? "Saving…" : runtimeSaved ? "Saved" : "Save away & hours"}
          </Button>
          <Button type="submit" form="messaging-help-stop-form" disabled={saving}>
            {saving ? "Saving…" : saved ? "Saved" : "Save STOP/HELP"}
          </Button>
        </div>
      </div>

      <SettingsTabs items={settingsTabs} active="/settings/messaging" />

      {error ? <p className="ref-error" role="alert">{error}</p> : null}

      {(saved || runtimeSaved) && (
        <div className="ref-success" role="status">
          <CheckCircle2 size={15} />
          Settings saved. Changes apply to future outbound appointment messages.
        </div>
      )}

      {consentSaved && (
        <div className="ref-success" role="status">
          <CheckCircle2 size={15} />
          Consent copy saved. Booking page opt-in text was updated to version v{consent.termsVersion}.
        </div>
      )}

      <div className="ref-notice">
        <ShieldCheck size={15} />
        <span>
          These defaults govern automated appointment messages. Contacts who reply STOP are suppressed
          automatically — opt-outs are enforced at send time across reminders, workflows, and manual sends.
        </span>
      </div>

      <RegistrationCard registration={mockRegistration} />

      <div className="ref-grid">
        <AwayHoursCard
          runtime={runtime}
          loading={loading}
          timezones={timezones}
          onChange={(patch) => setRuntime((r) => (r ? { ...r, ...patch } : r))}
          onSubmit={saveRuntime}
        />
        <QuietHoursCard
          runtime={runtime}
          loading={loading}
          timezones={timezones}
          onChange={(patch) => setRuntime((r) => (r ? { ...r, ...patch } : r))}
        />
      </div>

      <ComplianceCard registration={mockRegistration} onSubmit={saveHelpStop} saving={saving} />

      <ConsentCopyCard
        consent={consent}
        saving={consentSaving}
        dirty={consentDirty}
        onChange={(patch) => {
          setConsent((c) => ({ ...c, ...patch }));
          setConsentDirty(true);
          setConsentSaved(false);
        }}
        onSubmit={saveConsent}
      />
    </div>
  );
}
