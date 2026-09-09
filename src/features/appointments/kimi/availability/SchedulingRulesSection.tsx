"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AvailabilityFormState } from "@/features/appointments/kimi/availability/types";

const INTERVAL_PRESETS = [10, 15, 20, 30, 45, 60] as const;
const DENSITY_PRESETS = [10, 20, 25, 33, 50] as const;

function parseFixedTimes(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function formatTimeLabel(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return value;
  const h = Number(match[1]);
  const m = match[2];
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m} ${period}`;
}

function exampleIntervalStarts(minutes: number, count = 4): string {
  if (!minutes || minutes < 1) return "";
  const starts: string[] = [];
  let total = 9 * 60;
  for (let i = 0; i < count; i++) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    starts.push(formatTimeLabel(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`));
    total += minutes;
  }
  return starts.join(" · ");
}

type Props = {
  form: AvailabilityFormState;
  onPatch: (patch: Partial<AvailabilityFormState>) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
};

export function SchedulingRulesSection({ form, onPatch, onSave, saving, saved }: Props) {
  const fixedTimes = useMemo(() => parseFixedTimes(form.fixedStartTimes), [form.fixedStartTimes]);
  const [newTime, setNewTime] = useState("09:00");
  const intervalPreset =
    form.customStartIntervalMinutes &&
    !INTERVAL_PRESETS.includes(form.customStartIntervalMinutes as (typeof INTERVAL_PRESETS)[number])
      ? "custom"
      : String(form.customStartIntervalMinutes || "");
  const densityEnabled = (form.availabilityDensityHidePercent ?? 0) > 0;

  function setFixedTimesList(times: string[]) {
    onPatch({ fixedStartTimes: times.join(", ") });
  }

  function addFixedTime() {
    if (!newTime) return;
    if (fixedTimes.includes(newTime)) return;
    setFixedTimesList([...fixedTimes, newTime].sort());
  }

  return (
    <div className="avail-card p-6 space-y-8">
      <div>
        <h2 className="text-[15px] font-bold text-[#1a1830]">Start time rules</h2>
        <p className="text-[12px] text-[#8a87a0] mt-1">
          Control when customers may begin an appointment. These rules still respect staff, location,
          resource, and calendar availability.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-[13px] font-semibold text-[#1a1830]">How should appointment start times be generated?</legend>
        <label className="flex items-start gap-2 text-[13px]">
          <input
            type="radio"
            name="start-time-mode"
            checked={!form.fixedStartTimesEnabled}
            onChange={() => onPatch({ fixedStartTimesEnabled: false })}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Automatically from availability</span>
            <span className="block text-[12px] text-[#8a87a0]">
              Offer open times based on your schedule and the start interval below.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-[13px]">
          <input
            type="radio"
            name="start-time-mode"
            checked={form.fixedStartTimesEnabled}
            onChange={() => onPatch({ fixedStartTimesEnabled: true })}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Only at specific times</span>
            <span className="block text-[12px] text-[#8a87a0]">
              Customers only see the start times you list when staff and resources are also available.
            </span>
          </span>
        </label>
      </fieldset>

      {form.fixedStartTimesEnabled ? (
        <div className="space-y-3 rounded-lg border border-[#eceaf3] bg-[#faf9fc] p-4">
          <p className="text-[13px] font-medium">Allowed start times</p>
          {fixedTimes.length === 0 ? (
            <p className="text-[12px] text-[#8a87a0]">Add at least one start time.</p>
          ) : (
            <ul className="space-y-2">
              {fixedTimes.map((time) => (
                <li key={time} className="flex items-center justify-between gap-3 text-[13px]">
                  <span>{formatTimeLabel(time)}</span>
                  <button
                    type="button"
                    className="text-[12px] text-[#6b6880] hover:text-[#1a1830] underline"
                    onClick={() => setFixedTimesList(fixedTimes.filter((t) => t !== time))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="text-[#6b6880]">Time</span>
              <input
                type="time"
                className="input"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
              />
            </label>
            <Button type="button" size="sm" variant="secondary" onClick={addFixedTime}>
              Add start time
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="flex flex-col gap-1 text-[13px] font-medium" htmlFor="start-interval">
            Start time interval
          </label>
          <select
            id="start-interval"
            className="input max-w-xs"
            value={intervalPreset}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "custom") {
                onPatch({ customStartIntervalMinutes: form.customStartIntervalMinutes || 30 });
                return;
              }
              if (v === "") {
                onPatch({ customStartIntervalMinutes: undefined });
                return;
              }
              onPatch({ customStartIntervalMinutes: Number(v) });
            }}
          >
            <option value="">Use default spacing</option>
            {INTERVAL_PRESETS.map((m) => (
              <option key={m} value={m}>{m} minutes</option>
            ))}
            <option value="custom">Custom</option>
          </select>
          {intervalPreset === "custom" ? (
            <label className="flex flex-col gap-1 text-[12px] max-w-xs">
              <span className="text-[#6b6880]">Custom interval (minutes)</span>
              <input
                type="number"
                className="input"
                min={5}
                max={240}
                step={5}
                value={form.customStartIntervalMinutes ?? ""}
                onChange={(e) =>
                  onPatch({
                    customStartIntervalMinutes: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </label>
          ) : null}
          <p className="text-[12px] text-[#8a87a0]">
            Controls how often a new appointment may start. It does not change appointment duration.
          </p>
          {form.customStartIntervalMinutes ? (
            <p className="text-[12px] text-[#6b6880]">
              Example start times: {exampleIntervalStarts(form.customStartIntervalMinutes)}
            </p>
          ) : null}
        </div>
      )}

      {form.fixedStartTimesEnabled ? (
        <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
          Fixed start times take precedence over the start time interval.
        </p>
      ) : null}

      <div className="space-y-3 border-t border-[#eceaf3] pt-6">
        <h3 className="text-[13px] font-semibold">Advanced scheduling</h3>
        <label className="flex items-start gap-2 text-[13px]">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={densityEnabled}
            onChange={(e) =>
              onPatch({
                availabilityDensityHidePercent: e.target.checked ? form.availabilityDensityHidePercent || 25 : undefined,
              })
            }
          />
          <span>
            <span className="font-medium">Limit how many open times customers see</span>
            <span className="block text-[12px] text-[#8a87a0]">
              Transovo hides some otherwise available times from customers. Hidden times remain open
              internally and may still be used by staff.
            </span>
          </span>
        </label>
        {densityEnabled ? (
          <label className="flex flex-col gap-1 text-[12px] max-w-xs">
            <span className="text-[#6b6880]">Hide approximately</span>
            <select
              className="input"
              value={form.availabilityDensityHidePercent ?? 25}
              onChange={(e) => onPatch({ availabilityDensityHidePercent: Number(e.target.value) })}
            >
              {DENSITY_PRESETS.map((p) => (
                <option key={p} value={p}>{p}%</option>
              ))}
            </select>
          </label>
        ) : null}

        <fieldset className="space-y-2">
          <legend className="text-[13px] font-medium">Scheduling preference</legend>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="radio"
              name="minimize-gaps"
              checked={form.minimizeGapsMode === "off"}
              onChange={() => onPatch({ minimizeGapsMode: "off" })}
            />
            Show all available times normally
          </label>
          <label className="flex items-start gap-2 text-[13px]">
            <input
              type="radio"
              name="minimize-gaps"
              checked={form.minimizeGapsMode === "prefer_compact"}
              onChange={() => onPatch({ minimizeGapsMode: "prefer_compact" })}
              className="mt-0.5"
            />
            <span>
              Prefer times near existing appointments
              <span className="block text-[12px] text-[#8a87a0]">
                Preferred times appear first to help reduce gaps in your day. Availability rules are
                still respected.
              </span>
            </span>
          </label>
        </fieldset>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : saved ? "Saved" : "Save scheduling rules"}
        </Button>
      </div>
    </div>
  );
}
