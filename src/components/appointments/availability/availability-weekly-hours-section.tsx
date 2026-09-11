"use client";

import { Plus, Trash2 } from "lucide-react";
import { DAY_LABELS } from "@/features/appointments/kimi/availability/map-availability";
import type { AvailabilityFormState } from "@/features/appointments/kimi/availability/types";

type Props = {
  form: AvailabilityFormState;
  onToggleDay: (day: string, open: boolean) => void;
  onUpdateWindow: (day: string, index: number, field: "open" | "close", value: string) => void;
  onAddWindow: (day: string) => void;
  onRemoveWindow: (day: string, index: number) => void;
  onCopyMondayToWeekdays: () => void;
  onTimezoneChange: (value: string) => void;
};

export function AvailabilityWeeklyHoursSection({
  form,
  onToggleDay,
  onUpdateWindow,
  onAddWindow,
  onRemoveWindow,
  onCopyMondayToWeekdays,
  onTimezoneChange,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[var(--type-section)] font-semibold text-[var(--text-primary)]">Weekly hours</h2>
          <p className="ws-stat-note">Default business schedule used when staff do not have custom hours.</p>
        </div>
        <button type="button" className="ws-secondary-btn" onClick={onCopyMondayToWeekdays}>
          Copy Monday to weekdays
        </button>
      </div>

      <div className="ws-panel overflow-hidden">
        {DAY_LABELS.map(({ key, label }, index) => {
          const windows = form.weeklyHours[key] || [];
          const open = windows.length > 0;
          return (
            <div
              key={key}
              className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 ${
                index < DAY_LABELS.length - 1 ? "border-b border-[var(--border)]" : ""
              }`}
            >
              <div className="flex w-full shrink-0 items-center gap-3 sm:w-[140px]">
                <span className="text-[var(--type-list)] font-semibold uppercase tracking-wide text-[var(--text-primary)]">
                  {label}
                </span>
                <label className="inline-flex items-center gap-2 text-[var(--type-helper)]">
                  <input
                    type="checkbox"
                    checked={open}
                    onChange={(e) => onToggleDay(key, e.target.checked)}
                  />
                  {open ? "Open" : "Closed"}
                </label>
              </div>

              <div className="min-w-0 flex-1">
                {open ? (
                  <div className="flex flex-col gap-2">
                    {windows.map((window, idx) => (
                      <div key={`${key}-${idx}`} className="flex flex-wrap items-center gap-2">
                        <input
                          type="time"
                          className="input w-[130px]"
                          value={window.open}
                          onChange={(e) => onUpdateWindow(key, idx, "open", e.target.value)}
                          aria-label={`${label} open time ${idx + 1}`}
                        />
                        <span className="text-[var(--text-secondary)]">—</span>
                        <input
                          type="time"
                          className="input w-[130px]"
                          value={window.close}
                          onChange={(e) => onUpdateWindow(key, idx, "close", e.target.value)}
                          aria-label={`${label} close time ${idx + 1}`}
                        />
                        <button
                          type="button"
                          className="ws-icon-btn"
                          aria-label={`Remove ${label} interval`}
                          onClick={() => onRemoveWindow(key, idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-[var(--type-helper)] text-[var(--text-secondary)]">Closed</span>
                )}
              </div>

              {open ? (
                <button type="button" className="ws-text-btn shrink-0" onClick={() => onAddWindow(key)}>
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add interval
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="ws-panel px-4 py-3">
        <label className="flex flex-col gap-1 sm:max-w-sm">
          <span className="ws-field-label">Timezone</span>
          <input
            className="input"
            value={form.timezone}
            onChange={(e) => onTimezoneChange(e.target.value)}
            placeholder="America/New_York"
          />
          <span className="ws-stat-note">Schedule times are saved in this timezone.</span>
        </label>
      </div>
    </div>
  );
}
