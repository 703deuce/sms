"use client";

import { useEffect, useState } from "react";
import "@/components/settings/kimi-ui/messaging/reference.css";
import type { MessagingRegistration } from "@/lib/domain";
import type { MessagingRuntimeView } from "@/components/settings/kimi-ui/messaging/types";
import { timezones } from "@/components/settings/kimi-ui/messaging/types";
import { SettingsTabs } from "@/components/settings/kimi-ui/messaging/components/SettingsTabs";
import { RegistrationCard } from "@/components/settings/kimi-ui/messaging/components/RegistrationCard";
import { AwayHoursCard } from "@/components/settings/kimi-ui/messaging/components/AwayHoursCard";
import { QuietHoursCard } from "@/components/settings/kimi-ui/messaging/components/QuietHoursCard";
import { ComplianceCard } from "@/components/settings/kimi-ui/messaging/components/ComplianceCard";
import { ConsentCopyCard } from "@/components/settings/kimi-ui/messaging/components/ConsentCopyCard";
import { Button } from "@/components/settings/kimi-ui/messaging/components/ui";
import { defaultBusinessHours } from "@/lib/messaging/messaging-settings";
import { mapMessagingRegistrationView } from "@/features/settings/kimi/shared/map-registration";
import { resolveSettingsTabs } from "@/features/settings/kimi/shared/settings-tabs";
import { CheckCircle2, ShieldCheck } from "lucide-react";

type ConsentCopy = {
  optInDescription: string;
  consentText: string;
  termsVersion: string;
  capturedAt: string;
};

type Props = {
  registration: MessagingRegistration | null;
};

export function MessagingSettingsConnected({ registration }: Props) {
  const registrationView = mapMessagingRegistrationView(registration);
  const samples = registration?.sampleMessages || [];
  const sampleMessages =
    samples.length > 0
      ? samples
      : ["Sample message for compliance records. Reply STOP to opt out."];

  const [runtime, setRuntime] = useState<MessagingRuntimeView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runtimeSaving, setRuntimeSaving] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [runtimeSaved, setRuntimeSaved] = useState(false);
  const [consentSaved, setConsentSaved] = useState(false);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState<ConsentCopy>({
    optInDescription: registrationView.optInDescription,
    consentText: registrationView.consentText,
    termsVersion: registrationView.termsVersion,
    capturedAt: registrationView.consentCapturedAt,
  });
  const [consentDirty, setConsentDirty] = useState(false);
  const [platformConsentVersion, setPlatformConsentVersion] = useState(registrationView.termsVersion);

  const tabs = resolveSettingsTabs();

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/messaging-runtime").then((r) => r.json()),
      fetch("/api/appointments/settings").then((r) => r.json()),
    ])
      .then(([runtimeJson, platformJson]) => {
        if (runtimeJson.data) setRuntime(runtimeJson.data);
        const platform = platformJson.data;
        if (platform) {
          setConsent((c) => ({
            ...c,
            consentText: platform.consentText || c.consentText,
            termsVersion: platform.consentVersion || c.termsVersion,
          }));
          setPlatformConsentVersion(platform.consentVersion || platformConsentVersion);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [platformConsentVersion]);

  async function saveHelpStop(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/messaging/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_use_case",
          useCase: registration?.useCase || "Customer care",
          useCaseDescription:
            registration?.useCaseDescription ||
            "SMS notifications and customer support messages for subscribers who opted in.",
          sampleMessages,
          optInDescription: consent.optInDescription,
          helpMessage: form.get("helpResponse"),
          stopMessage: form.get("stopResponse"),
          messageVolume: registration?.messageVolume || "",
          vertical: registration?.vertical || "",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save settings");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function saveRuntime(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!runtime) return;
    setRuntimeSaving(true);
    setError("");
    setRuntimeSaved(false);

    try {
      const res = await fetch("/api/settings/messaging-runtime", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awayEnabled: runtime.awayEnabled,
          awayAlways: runtime.awayAlways,
          awayMessage: runtime.awayMessage,
          timezone: runtime.timezone,
          quietHoursStart: runtime.quietHoursStart || null,
          quietHoursEnd: runtime.quietHoursEnd || null,
          reviewLinkUrl: runtime.reviewLinkUrl || null,
          optOutKeywords: runtime.optOutKeywords ?? null,
          optInKeywords: runtime.optInKeywords ?? null,
          helpKeywords: runtime.helpKeywords ?? null,
          businessHoursJson: defaultBusinessHours(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save runtime settings");
      setRuntime(json.data);
      setRuntimeSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setRuntimeSaving(false);
    }
  }

  async function saveConsent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setConsentSaved(false);
    const text = consent.consentText.trim();
    if (!text) {
      setError("Consent text can't be empty.");
      return;
    }
    setConsentSaving(true);
    try {
      const res = await fetch("/api/appointments/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentText: text,
          consentVersion: consent.termsVersion,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save consent copy");
      setConsentSaved(true);
      setConsentDirty(false);
      if (json.data?.consentVersion) setPlatformConsentVersion(json.data.consentVersion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setConsentSaving(false);
    }
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

      <SettingsTabs items={tabs} active="/settings/messaging" />

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
          automatically.
        </span>
      </div>

      <RegistrationCard registration={registrationView} />

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

      <ComplianceCard registration={registrationView} onSubmit={saveHelpStop} saving={saving} />

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
