"use client";

import { DEFAULT_REMINDER_TEMPLATES } from "@/lib/appointments/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { estimateSmsSegments, cn } from "@/lib/utils";
import {
  CalendarCheck,
  Clock,
  MessageSquareText,
  RotateCcw,
  Send,
  Smartphone,
} from "lucide-react";
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

const MERGE_TAGS = [
  "{{first_name}}",
  "{{service}}",
  "{{appointment_date}}",
  "{{appointment_time}}",
];

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex items-center gap-2"
    >
      <span
        className={cn(
          "relative inline-flex h-5.5 w-10 shrink-0 items-center rounded-full transition-colors duration-200",
          checked ? "bg-primary" : "bg-border",
        )}
        style={{ height: 22 }}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-[22px]" : "translate-x-[3px]",
          )}
        />
      </span>
      <span
        className={cn(
          "text-[13px] font-semibold",
          checked ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </button>
  );
}

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

  if (!config) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const steps: Array<{
    key: StepKey;
    title: string;
    hint: string;
    icon: typeof CalendarCheck;
    timing: string;
  }> = [
    {
      key: "confirmation",
      title: "Booking confirmation",
      hint: "Sent immediately when a customer books online.",
      icon: CalendarCheck,
      timing: "At booking",
    },
    {
      key: "reminder24h",
      title: "24-hour reminder",
      hint: "Sent the day before the appointment.",
      icon: Clock,
      timing: "24h before",
    },
    {
      key: "reminder2h",
      title: "2-hour reminder",
      hint: "Sent shortly before the appointment.",
      icon: MessageSquareText,
      timing: "2h before",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Reminder Settings
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Customers receive these messages automatically after booking.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {saved ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              Saved
            </span>
          ) : null}
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {/* Merge tags hint */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border border-border bg-muted/30 px-4 py-3">
        <span className="text-xs font-semibold text-muted-foreground">
          Merge tags:
        </span>
        {MERGE_TAGS.map((tag) => (
          <code
            key={tag}
            className="rounded-md bg-card px-1.5 py-0.5 font-mono text-[11px] text-primary ring-1 ring-inset ring-border"
          >
            {tag}
          </code>
        ))}
      </div>

      {/* Test send */}
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Send className="h-3.5 w-3.5" />
          </span>
          <h2 className="font-display text-sm font-semibold tracking-tight text-foreground">
            Send yourself a test
          </h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_170px_auto] sm:items-end">
          <div>
            <Label htmlFor="test-phone">Your mobile number</Label>
            <Input
              id="test-phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="test-step">Reminder</Label>
            <Select
              id="test-step"
              value={testStep}
              onChange={(e) => setTestStep(e.target.value as StepKey)}
            >
              <option value="confirmation">Confirmation</option>
              <option value="reminder24h">24-hour</option>
              <option value="reminder2h">2-hour</option>
            </Select>
          </div>
          <Button onClick={sendTest} disabled={testing || !testPhone.trim()}>
            {testing ? "Sending…" : "Send test SMS"}
          </Button>
        </div>
        {testResult ? (
          <p
            className={cn(
              "mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium",
              testResult.startsWith("Test")
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-600",
            )}
          >
            {testResult}
          </p>
        ) : null}
      </Card>

      {/* Sequence */}
      <div>
        <h2 className="font-display text-sm font-semibold tracking-tight text-foreground">
          Reminder sequence
        </h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Confirmation → 24-hour → 2-hour. Each step can be edited or turned off.
        </p>
      </div>

      <div className="relative space-y-4">
        {steps.map((step, idx) => {
          const reminder = config.reminders[step.key];
          const Icon = step.icon;
          const segments = estimateSmsSegments(reminder.template);
          const defaultTemplate =
            step.key === "confirmation"
              ? DEFAULT_REMINDER_TEMPLATES.confirmation
              : step.key === "reminder24h"
                ? DEFAULT_REMINDER_TEMPLATES.reminder24h
                : DEFAULT_REMINDER_TEMPLATES.reminder2h;
          return (
            <div key={step.key} className="relative">
              {/* connector */}
              {idx < steps.length - 1 ? (
                <div className="absolute left-[33px] top-[52px] hidden h-[calc(100%-28px)] w-px bg-border sm:block" />
              ) : null}
              <Card
                className={cn(
                  "p-0 transition-opacity",
                  !reminder.enabled && "opacity-75",
                )}
              >
                {/* Card header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                  <div className="flex items-center gap-3.5">
                    <span
                      className={cn(
                        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                        reminder.enabled
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
                          {step.title}
                        </h3>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          {step.timing}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {step.hint}
                      </p>
                    </div>
                  </div>
                  <Toggle
                    checked={reminder.enabled}
                    onChange={(v) => updateReminder(step.key, { enabled: v })}
                    label={reminder.enabled ? "Enabled" : "Off"}
                  />
                </div>

                {/* Body: template + phone preview */}
                <div className="grid gap-5 px-5 py-5 lg:grid-cols-[1fr_280px]">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[13px] font-semibold tracking-tight text-foreground/90">
                        Message template
                      </span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
                        onClick={() =>
                          updateReminder(step.key, { template: defaultTemplate })
                        }
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset to default
                      </button>
                    </div>
                    <Textarea
                      rows={4}
                      value={reminder.template}
                      disabled={!reminder.enabled}
                      onChange={(e) =>
                        updateReminder(step.key, { template: e.target.value })
                      }
                    />
                    <p className="mt-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                      {segments.characters} chars · {segments.segments} SMS segment
                      {segments.segments === 1 ? "" : "s"}
                    </p>
                  </div>

                  {/* Phone preview */}
                  <div>
                    <span className="mb-1.5 block text-[13px] font-semibold tracking-tight text-foreground/90">
                      Preview
                    </span>
                    <div className="rounded-2xl border border-border bg-muted/40 p-3">
                      <div className="mb-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                        <Smartphone className="h-3 w-3" />
                        Transovo
                      </div>
                      <div className="rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2.5 text-[12.5px] leading-relaxed text-foreground shadow-sm">
                        {preview[step.key] || (
                          <span className="text-muted-foreground">
                            Save to refresh preview
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
        {saved ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-600">
            Saved
          </span>
        ) : null}
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save reminder settings"}
        </Button>
      </div>
    </div>
  );
}
