"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReminderSettingsView from "@/components/appointments/kimi-ui/reminder-settings/page";
import {
  buildRemindersPageModel,
  patchReminderAdvanced,
  patchReminderEnabled,
  patchReminderTemplate,
  patchReminderChannel,
  patchReminderVoiceTemplate,
  resetReminderTemplate,
  type RemindersApiConfig,
  type ReminderPreviewMap,
} from "@/features/appointments/kimi/reminders/map-reminders";
import type {
  ReminderStepKey,
  RemindersPageActions,
  RemindersPageModel,
} from "@/features/appointments/kimi/reminders/types";

function RemindersLoading() {
  return (
    <div className="reminder-settings-page mx-auto max-w-[1100px] px-8 py-7 font-sans animate-pulse">
      <div className="h-8 w-56 rounded bg-gray-200 mb-6" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-40 rounded-xl bg-gray-100" />
        <div className="h-40 rounded-xl bg-gray-100" />
      </div>
      <div className="mt-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 rounded-xl bg-gray-100" />
        ))}
      </div>
    </div>
  );
}

function RemindersError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="reminder-settings-page mx-auto max-w-[1100px] px-8 py-7 font-sans flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md text-center rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12">
        <div className="mb-3.5 mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">We couldn&apos;t load reminder settings</h3>
        <p className="mt-1.5 text-[13px] text-gray-500">
          Something went wrong while fetching your reminder templates.
        </p>
        <Button size="sm" className="mt-5" onClick={onRetry}>Try again</Button>
      </div>
    </div>
  );
}

async function loadPreviews(): Promise<ReminderPreviewMap> {
  const keys: ReminderStepKey[] = ["confirmation", "reminder24h", "reminder2h"];
  const entries = await Promise.all(
    keys.map(async (key) => {
      const res = await fetch(`/api/appointments/reminders/test?step=${key}`);
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
  const [voiceTemplates, setVoiceTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [defaultVoiceTemplateId, setDefaultVoiceTemplateId] = useState<string>("");

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
        setConfig({
          timezone: data.timezone,
          reminders: data.reminders,
        });
        const [nextPreviews, voiceRes] = await Promise.all([
          loadPreviews(),
          fetch("/api/appointments/voice-reminders"),
        ]);
        setPreviews(nextPreviews);
        if (voiceRes.ok) {
          const voiceJson = await voiceRes.json();
          const templates = (voiceJson.data?.templates || []) as Array<{ id: string; name: string }>;
          setVoiceTemplates(templates.map((t) => ({ id: t.id, name: t.name })));
          setDefaultVoiceTemplateId(voiceJson.data?.defaultTemplateId || templates[0]?.id || "");
        }
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const model: RemindersPageModel | null = useMemo(
    () => (config ? buildRemindersPageModel(config, previews) : null),
    [config, previews],
  );

  const refreshPreview = useCallback(async (stepKey: ReminderStepKey) => {
    const res = await fetch(`/api/appointments/reminders/test?step=${stepKey}`);
    if (!res.ok) return;
    const json = await res.json();
    if (json.data?.preview) {
      setPreviews((p) => ({ ...p, [stepKey]: json.data.preview }));
    }
  }, []);

  const actions: RemindersPageActions = useMemo(
    () => ({
      onSave: async () => {
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
          const nextPreviews = await loadPreviews();
          setPreviews(nextPreviews);
        } catch {
          setSaved(false);
        } finally {
          setSaving(false);
        }
      },
      onToggle: (stepKey) => {
        if (!config) return;
        const enabled = !config.reminders[stepKey].enabled;
        setConfig(patchReminderEnabled(config, stepKey, enabled));
        setSaved(false);
      },
      onTemplateChange: (stepKey, template) => {
        if (!config) return;
        setConfig(patchReminderTemplate(config, stepKey, template));
        setSaved(false);
      },
      onChannelChange: (stepKey, channel) => {
        if (!config) return;
        setConfig(patchReminderChannel(config, stepKey, channel));
        setSaved(false);
      },
      onResetTemplate: (stepKey) => {
        if (!config) return;
        setConfig(resetReminderTemplate(config, stepKey));
        setSaved(false);
        void refreshPreview(stepKey);
      },
      onTestPhoneChange: setTestPhone,
      onTestStepChange: setTestStep,
      onSendTest: async () => {
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
      },
      onRetry: load,
      onAdvancedChange: (stepKey, patch) => {
        if (!config) return;
        setConfig(patchReminderAdvanced(config, stepKey, patch));
        setSaved(false);
      },
      onVoiceTemplateChange: (stepKey, templateId) => {
        if (!config) return;
        setConfig(patchReminderVoiceTemplate(config, stepKey, templateId));
        setSaved(false);
      },
      onDefaultVoiceTemplateChange: async (templateId) => {
        setDefaultVoiceTemplateId(templateId);
        await fetch("/api/appointments/voice-reminders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ defaultTemplateId: templateId }),
        });
      },
    }),
    [config, load, refreshPreview, testPhone, testStep],
  );

  if (loading) return <RemindersLoading />;
  if (failed || !model) return <RemindersError onRetry={load} />;

  return (
    <ReminderSettingsView
      model={model}
      voiceTemplates={voiceTemplates}
      defaultVoiceTemplateId={defaultVoiceTemplateId}
      actions={actions}
      saved={saved}
      saving={saving}
      testPhone={testPhone}
      testStep={testStep}
      testing={testing}
      testSent={testSent}
      testError={testError}
    />
  );
}
