"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  addAdditionalReminderStep,
  buildRemindersPageModel,
  patchReminderAdvanced,
  patchReminderChannel,
  patchReminderEnabled,
  patchReminderMinutesBefore,
  patchReminderTemplate,
  removeReminderStep,
  resetReminderTemplate,
  type RemindersApiConfig,
  type ReminderPreviewMap,
} from "@/features/appointments/kimi/reminders/map-reminders";
import { listReminderStepIds, resolveReminderStep } from "@/lib/appointments/reminders/reminders-config";
import { DEFAULT_PLATFORM_CONFIG, type AppointmentPlatformConfig } from "@/lib/appointments/types";
import { RemindersWorkspaceConnected } from "@/components/appointments/reminders/reminders-workspace-connected";
import type { ReminderStepKey } from "./types";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";

const SHELL =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

function RemindersLoading() {
  return (
    <div className={`${SHELL} min-h-full bg-[var(--surface-muted)] p-8`}>
      <div className="mx-auto max-w-[1560px] animate-pulse space-y-4">
        <div className="h-10 w-56 rounded bg-[var(--surface)]" />
        <div className="h-12 rounded bg-[var(--surface)]" />
        <div className="h-96 rounded bg-[var(--surface)]" />
      </div>
    </div>
  );
}

function RemindersError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={`${SHELL} flex min-h-full items-center justify-center bg-[var(--surface-muted)] p-8`}>
      <div className="max-w-md rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-[var(--accent)]" />
        <h3 className="font-semibold">Could not load reminder settings</h3>
        <button type="button" className="appt-pilot-primary-btn mt-4" onClick={onRetry}>Try again</button>
      </div>
    </div>
  );
}

function asPlatformConfig(config: RemindersApiConfig): AppointmentPlatformConfig {
  return { ...DEFAULT_PLATFORM_CONFIG, timezone: config.timezone, reminders: config.reminders };
}

async function loadPreviews(config: RemindersApiConfig): Promise<ReminderPreviewMap> {
  const keys = listReminderStepIds(asPlatformConfig(config));
  const entries = await Promise.all(
    keys.map(async (key) => {
      const res = await fetch(`/api/appointments/reminders/test?step=${encodeURIComponent(key)}`);
      if (!res.ok) return [key, ""] as const;
      const json = await res.json();
      return [key, json.data?.preview || ""] as const;
    }),
  );
  return Object.fromEntries(entries) as ReminderPreviewMap;
}

export function RemindersConnected() {
  const [config, setConfig] = useState<RemindersApiConfig | null>(null);
  const [previews, setPreviews] = useState<ReminderPreviewMap>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const [testPhone, setTestPhone] = useState("");
  const [testStep, setTestStep] = useState<ReminderStepKey>("confirmation");
  const [testing, setTesting] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [testError, setTestError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    fetch("/api/appointments/settings")
      .then((r) => {
        if (!r.ok) throw new Error("settings failed");
        return r.json();
      })
      .then(async (json) => {
        const data = json.data;
        const nextConfig: RemindersApiConfig = {
          timezone: data.timezone,
          reminders: {
            confirmation: data.reminders.confirmation,
            reminder24h: data.reminders.reminder24h,
            reminder2h: data.reminders.reminder2h,
            additionalSteps: data.reminders.additionalSteps || [],
          },
        };
        setConfig(nextConfig);
        const nextPreviews = await loadPreviews(nextConfig);
        setPreviews(nextPreviews);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const model = useMemo(
    () => (config ? buildRemindersPageModel(config, previews) : null),
    [config, previews],
  );

  const refreshPreview = useCallback(async (stepKey: ReminderStepKey) => {
    const res = await fetch(`/api/appointments/reminders/test?step=${encodeURIComponent(stepKey)}`);
    if (!res.ok) return;
    const json = await res.json();
    if (json.data?.preview) {
      setPreviews((p) => ({ ...p, [stepKey]: json.data.preview }));
    }
  }, []);

  const save = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/appointments/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminders: config.reminders, timezone: config.timezone }),
      });
      if (!res.ok) throw new Error("save failed");
      setSaved(true);
      const nextPreviews = await loadPreviews(config);
      setPreviews(nextPreviews);
    } catch {
      setSaved(false);
    } finally {
      setSaving(false);
    }
  }, [config]);

  if (loading) return <RemindersLoading />;
  if (failed || !model || !config) return <RemindersError onRetry={load} />;

  return (
    <RemindersWorkspaceConnected
      model={model}
      saved={saved}
      saving={saving}
      onSave={() => void save()}
      onToggle={(stepKey) => {
        const step = resolveReminderStep(asPlatformConfig(config), stepKey);
        if (!step) return;
        setConfig(patchReminderEnabled(config, stepKey, !step.enabled));
        setSaved(false);
      }}
      onTemplateChange={(stepKey, template) => {
        setConfig(patchReminderTemplate(config, stepKey, template));
        setSaved(false);
      }}
      onChannelChange={(stepKey, channel) => {
        setConfig(patchReminderChannel(config, stepKey, channel));
        setSaved(false);
      }}
      onResetTemplate={(stepKey) => {
        setConfig(resetReminderTemplate(config, stepKey));
        setSaved(false);
        void refreshPreview(stepKey);
      }}
      onMinutesBeforeChange={(stepKey, minutes) => {
        setConfig(patchReminderMinutesBefore(config, stepKey, minutes));
        setSaved(false);
      }}
      onAddStep={() => {
        setConfig(addAdditionalReminderStep(config));
        setSaved(false);
      }}
      onRemoveStep={(stepKey) => {
        setConfig(removeReminderStep(config, stepKey));
        setSaved(false);
      }}
      onAdvancedChange={(stepKey, patch) => {
        setConfig(patchReminderAdvanced(config, stepKey, patch));
        setSaved(false);
      }}
      testPhone={testPhone}
      testStep={testStep}
      testing={testing}
      testSent={testSent}
      testError={testError}
      onTestPhoneChange={setTestPhone}
      onTestStepChange={setTestStep}
      onSendTest={async () => {
        if (!testPhone.trim()) return;
        setTesting(true);
        setTestError("");
        setTestSent(false);
        try {
          const res = await fetch("/api/appointments/reminders/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stepKey: testStep, phone: testPhone.trim() }),
          });
          const json = await res.json();
          if (!res.ok) {
            setTestError(json.error || "Send failed");
            return;
          }
          setTestSent(true);
          window.setTimeout(() => setTestSent(false), 2500);
        } catch {
          setTestError("Send failed");
        } finally {
          setTesting(false);
        }
      }}
    />
  );
}
