"use client";

import { MctbSetupSectionLayout } from "@/components/mctb/setup/mctb-setup-section-layout";
import { MctbPausedNotice } from "@/components/mctb/mctb-paused-notice";
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

      <div className="ref-card space-y-4 p-5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">What counts as a missed call</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Each enabled outcome creates a separate missed-call event for the recovery engine.
          </p>
        </div>
        <ul className="space-y-3">
          {triggerOptions.map((opt) => (
            <li key={opt.key}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-100 px-4 py-3 hover:border-indigo-100">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={triggers[opt.key]}
                  onChange={(e) => setTriggers((t) => ({ ...t, [opt.key]: e.target.checked }))}
                />
                <span>
                  <span className="block text-[13px] font-semibold text-foreground">{opt.label}</span>
                  <span className="block text-[12px] text-muted-foreground">{opt.helper}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {!anyOn ? (
          <p className="text-[13px] font-medium text-rose-700" role="alert">
            Select at least one trigger before saving.
          </p>
        ) : null}
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
