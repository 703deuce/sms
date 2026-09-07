"use client";

import { MctbSetupSectionLayout } from "@/components/mctb/setup/mctb-setup-section-layout";
import { MctbPausedNotice } from "@/components/mctb/mctb-paused-notice";
import { MctbTriggerRuleCards } from "@/components/mctb/wizard/mctb-wizard-ui";
import { useCallback, useEffect, useState } from "react";
import "../kimi-ui/reference.css";

type TriggerState = {
  noAnswer: boolean;
  busy: boolean;
  rejected: boolean;
  timeout: boolean;
  voicemail: boolean;
};

export function MctbSetupMissedCallRulesView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [triggers, setTriggers] = useState<TriggerState>({
    noAnswer: true,
    busy: true,
    rejected: true,
    timeout: true,
    voicemail: false,
  });
  const [paused, setPaused] = useState(false);
  const [pauseKind, setPauseKind] = useState<"manual" | "timed" | null>(null);
  const [pauseUntil, setPauseUntil] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mctb/setup", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      const r = json.data.runtime;
      setPhoneNumberId(r.phoneNumberId);
      setTriggers({
        noAnswer: r.sendAfterNoAnswer,
        busy: r.sendAfterBusy,
        rejected: r.sendAfterRejected,
        timeout: r.sendAfterTimeout,
        voicemail: r.sendAfterVoicemail,
      });
      setPaused(Boolean(json.data.schedule?.paused));
      setPauseKind(json.data.schedule?.pauseKind ?? null);
      setPauseUntil(json.data.schedule?.pauseUntil ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/mctb/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phoneNumberId,
          triggerRules: triggers,
          activate: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setSaved(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const triggerOptions: Array<{ key: keyof TriggerState; label: string; helper: string }> = [
    { key: "noAnswer", label: "No answer", helper: "Caller rings but no one picks up." },
    { key: "busy", label: "Busy", helper: "Line is busy when the call arrives." },
    { key: "rejected", label: "Rejected", helper: "Call is actively declined." },
    { key: "timeout", label: "Unreachable", helper: "Network or routing timeout before answer." },
    { key: "voicemail", label: "Voicemail", helper: "Caller reaches voicemail (when supported)." },
  ];

  const anyOn = Object.values(triggers).some(Boolean);

  if (loading) {
    return (
      <div className="mctb-page">
        <div className="mctb-page-inner">
          <div className="ref-card p-12 text-center text-sm text-gray-500">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <MctbSetupSectionLayout
      title="Missed-call rules"
      description="Choose which call outcomes create missed-call recovery events. This controls classification only — not consent, message text, or sender readiness."
      saving={saving}
      saved={saved}
      error={error}
      onSave={() => void save()}
    >
      {paused ? (
        <MctbPausedNotice pauseKind={pauseKind} pauseUntil={pauseUntil} variant="banner" />
      ) : null}

      <div className="ref-card p-5 voice-theme">
        <MctbTriggerRuleCards
          options={triggerOptions.map((opt) => ({
            id: opt.key,
            label: opt.label,
            helper: opt.helper,
            enabled: triggers[opt.key],
            onToggle: (enabled) => setTriggers((t) => ({ ...t, [opt.key]: enabled })),
          }))}
          errorMessage={!anyOn ? "Select at least one trigger before saving." : null}
        />
      </div>

      <p className="text-[12px] text-muted-foreground">
        Repeat-call cooldown and max recovery messages are configured in{" "}
        <a href="/mctb/setup/recovery" className="font-semibold text-primary hover:underline">
          Recovery controls
        </a>
        .
      </p>
    </MctbSetupSectionLayout>
  );
}
