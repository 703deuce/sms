"use client";

import { DEFAULT_REMINDER_TEMPLATES } from "@/lib/appointments/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useEffect, useState } from "react";

type StepKey = "confirmation" | "reminder24h" | "reminder2h";

type ReminderStep = {
  enabled: boolean;
  channel: "sms" | "email";
  template: string;
  label: string;
  minutesBefore?: number;
};

type PlatformConfig = {
  timezone: string;
  reminders: Record<StepKey, ReminderStep>;
};

export function AppointmentRemindersClient() {
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<Record<StepKey, string>>({
    confirmation: "",
    reminder24h: "",
    reminder2h: "",
  });
  const [testPhone, setTestPhone] = useState("");
  const [testStep, setTestStep] = useState<StepKey>("confirmation");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");

  useEffect(() => {
    fetch("/api/appointments/settings")
      .then((r) => r.json())
      .then((json) => setConfig(json.data));
  }, []);

  useEffect(() => {
    if (!config) return;
    for (const key of ["confirmation", "reminder24h", "reminder2h"] as StepKey[]) {
      fetch(`/api/appointments/reminders/test?step=${key}`)
        .then((r) => r.json())
        .then((json) => {
          if (json.data?.preview) {
            setPreview((p) => ({ ...p, [key]: json.data.preview }));
          }
        });
    }
  }, [config]);

  async function save() {
    if (!config) return;
    setSaving(true);
    setSaved(false);
    await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminders: config.reminders, timezone: config.timezone }),
    });
    setSaving(false);
    setSaved(true);
  }

  async function sendTest() {
    if (!testPhone.trim()) return;
    setTesting(true);
    setTestResult("");
    const res = await fetch("/api/appointments/reminders/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepKey: testStep, phone: testPhone.trim() }),
    });
    const json = await res.json();
    setTesting(false);
    setTestResult(res.ok ? "Test reminder sent." : json.error || "Send failed");
  }

  function updateReminder(key: StepKey, patch: Partial<ReminderStep>) {
    if (!config) return;
    setConfig({
      ...config,
      reminders: { ...config.reminders, [key]: { ...config.reminders[key], ...patch } },
    });
  }

  if (!config) return <p className="text-sm text-muted-foreground">Loading reminder settings…</p>;

  const steps: Array<{ key: StepKey; title: string; hint: string }> = [
    { key: "confirmation", title: "Booking confirmation", hint: "Sent when a customer books online." },
    { key: "reminder24h", title: "24-hour reminder", hint: "Sent the day before the appointment." },
    { key: "reminder2h", title: "2-hour reminder", hint: "Sent shortly before the appointment." },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Reminder Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Preview and test SMS reminders before launch. Merge tags:{" "}
          <code className="text-xs">{"{{first_name}}"}</code>,{" "}
          <code className="text-xs">{"{{service}}"}</code>,{" "}
          <code className="text-xs">{"{{appointment_date}}"}</code>,{" "}
          <code className="text-xs">{"{{appointment_time}}"}</code>.
        </p>
      </div>

      <Card className="rounded-xl border-slate-200 p-4">
        <h2 className="font-semibold text-slate-900">Send yourself a test</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="test-phone">Your mobile number</Label>
            <Input id="test-phone" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="test-step">Reminder</Label>
            <select
              id="test-step"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={testStep}
              onChange={(e) => setTestStep(e.target.value as StepKey)}
            >
              <option value="confirmation">Confirmation</option>
              <option value="reminder24h">24-hour</option>
              <option value="reminder2h">2-hour</option>
            </select>
          </div>
          <Button onClick={sendTest} disabled={testing || !testPhone.trim()}>
            {testing ? "Sending…" : "Send test SMS"}
          </Button>
        </div>
        {testResult ? <p className="mt-2 text-sm text-slate-600">{testResult}</p> : null}
      </Card>

      <div className="space-y-4">
        {steps.map((step) => {
          const reminder = config.reminders[step.key];
          return (
            <Card key={step.key} className="rounded-xl border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900">{step.title}</h2>
                  <p className="text-sm text-slate-500">{step.hint}</p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={reminder.enabled}
                    onChange={(e) => updateReminder(step.key, { enabled: e.target.checked })}
                  />
                  Enabled
                </label>
              </div>
              <Textarea
                rows={4}
                value={reminder.template}
                onChange={(e) => updateReminder(step.key, { template: e.target.value })}
              />
              <p className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                <span className="font-semibold">Preview: </span>
                {preview[step.key] || "Save to refresh preview"}
              </p>
              <button
                type="button"
                className="mt-2 text-xs text-sky-700 hover:underline"
                onClick={() =>
                  updateReminder(step.key, {
                    template:
                      step.key === "confirmation"
                        ? DEFAULT_REMINDER_TEMPLATES.confirmation
                        : step.key === "reminder24h"
                          ? DEFAULT_REMINDER_TEMPLATES.reminder24h
                          : DEFAULT_REMINDER_TEMPLATES.reminder2h,
                  })
                }
              >
                Reset to default
              </button>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save reminder settings"}
        </Button>
        {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
      </div>
    </div>
  );
}
