"use client";

import { Mail, MessageSquare, Phone, Plus } from "lucide-react";
import type { ReminderItem } from "@/features/appointments/kimi/reminders/types";

type Props = {
  steps: ReminderItem[];
  onToggle: (stepKey: string) => void;
  onEdit: (stepKey: string) => void;
  onAdd: () => void;
  onMinutesChange: (stepKey: string, minutes: number) => void;
};

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === "email") return <Mail className="h-3.5 w-3.5" aria-hidden />;
  if (channel === "voice") return <Phone className="h-3.5 w-3.5" aria-hidden />;
  return <MessageSquare className="h-3.5 w-3.5" aria-hidden />;
}

function minutesToParts(minutes: number) {
  if (minutes >= 1440 && minutes % 1440 === 0) return { value: minutes / 1440, unit: "days" as const };
  if (minutes >= 60 && minutes % 60 === 0) return { value: minutes / 60, unit: "hours" as const };
  return { value: minutes, unit: "minutes" as const };
}

function partsToMinutes(value: number, unit: "minutes" | "hours" | "days") {
  if (unit === "days") return value * 1440;
  if (unit === "hours") return value * 60;
  return value;
}

export function RemindersSequenceSection({
  steps,
  onToggle,
  onEdit,
  onAdd,
  onMinutesChange,
}: Props) {
  return (
    <div className="ws-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Default appointment sequence</p>
          <p className="text-[var(--type-helper)] text-[var(--text-secondary)]">
            {steps.filter((s) => s.enabled).length} active step{steps.filter((s) => s.enabled).length === 1 ? "" : "s"}
          </p>
        </div>
        <button type="button" className="appt-pilot-primary-btn !py-1.5 !text-xs" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add reminder
        </button>
      </div>

      <div className="px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Booking created
        </p>
        <ul className="mt-2 space-y-0">
          {steps.map((step, index) => {
            const parts =
              step.stepKey === "confirmation"
                ? null
                : minutesToParts(step.minutesBefore ?? 120);
            return (
              <li key={step.stepKey} className="relative flex gap-3 pb-2">
                <div className="flex w-4 flex-col items-center pt-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${step.enabled ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
                    aria-hidden
                  />
                  {index < steps.length - 1 ? (
                    <span className="mt-1 w-px flex-1 bg-[var(--border)]" aria-hidden />
                  ) : null}
                </div>
                <div
                  className={`mb-1 flex min-h-[52px] flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded border px-3 py-2 ${
                    step.enabled
                      ? "border-[var(--border)] bg-[var(--surface)]"
                      : "border-dashed border-[var(--border)] bg-[var(--surface-muted)] opacity-70"
                  }`}
                >
                  <div className="min-w-[140px] flex-1">
                    {step.stepKey === "confirmation" ? (
                      <p className="text-sm font-medium">{step.badge}</p>
                    ) : parts ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          className="input w-14 !py-1 text-center text-sm"
                          value={parts.value}
                          onChange={(e) =>
                            onMinutesChange(
                              step.stepKey,
                              partsToMinutes(Number(e.target.value) || 1, parts.unit),
                            )
                          }
                          aria-label="Timing amount"
                        />
                        <select
                          className="input w-auto !py-1 text-sm"
                          value={parts.unit}
                          onChange={(e) =>
                            onMinutesChange(
                              step.stepKey,
                              partsToMinutes(parts.value, e.target.value as "minutes" | "hours" | "days"),
                            )
                          }
                          aria-label="Timing unit"
                        >
                          <option value="minutes">minutes</option>
                          <option value="hours">hours</option>
                          <option value="days">days</option>
                        </select>
                        <span className="text-sm text-[var(--text-secondary)]">before</span>
                      </div>
                    ) : null}
                    <p className="text-sm font-medium text-[var(--text-primary)]">{step.title}</p>
                  </div>
                  <span className="ws-chip ws-chip-neutral inline-flex items-center gap-1 capitalize">
                    <ChannelIcon channel={step.channel} />
                    {step.channel}
                  </span>
                  <p className="min-w-[200px] flex-[2] truncate text-sm text-[var(--text-secondary)]">
                    {step.preview || step.template.slice(0, 90)}
                  </p>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={step.enabled}
                      onChange={() => onToggle(step.stepKey)}
                      aria-label={`Enable ${step.title}`}
                    />
                    {step.enabled ? "Enabled" : "Off"}
                  </label>
                  <button type="button" className="ws-text-btn text-sm" onClick={() => onEdit(step.stepKey)}>
                    Edit
                  </button>
                </div>
              </li>
            );
          })}
          <li className="flex gap-3 pl-1">
            <span className="h-2.5 w-2.5 rounded-full border border-[var(--border)]" aria-hidden />
            <button type="button" className="ws-text-btn text-sm" onClick={onAdd}>
              + Add reminder
            </button>
          </li>
        </ul>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Appointment start
        </p>
      </div>
    </div>
  );
}
