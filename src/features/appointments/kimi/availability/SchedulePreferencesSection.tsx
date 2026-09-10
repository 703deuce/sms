"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AvailabilityFormState } from "@/features/appointments/kimi/availability/types";
import { CALENDAR_INTEGRATIONS_PATH } from "@/lib/calendar/constants";

const DENSITY_PRESETS = [
  { value: 33, label: "A few times" },
  { value: 25, label: "Balanced" },
  { value: 10, label: "Most available times" },
] as const;

type Props = {
  form: AvailabilityFormState;
  onPatch: (patch: Partial<AvailabilityFormState>) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  blockingCalendarSummary?: string;
};

export function SchedulePreferencesSection({
  form,
  onPatch,
  onSave,
  saving,
  saved,
  blockingCalendarSummary,
}: Props) {
  const densityEnabled = (form.availabilityDensityHidePercent ?? 0) > 0;

  return (
    <section className="avail-card p-6 space-y-6">
      <div>
        <h2 className="text-[15px] font-bold text-[#1a1830]">Schedule preferences</h2>
        <p className="text-[12px] text-[#8a87a0] mt-1">
          Optional controls for how available times are presented and arranged.
        </p>
      </div>

      <label className="flex items-start gap-2 text-[13px]">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={form.minimizeGapsMode === "prefer_compact"}
          onChange={(e) =>
            onPatch({ minimizeGapsMode: e.target.checked ? "prefer_compact" : "off" })
          }
        />
        <span>
          <span className="font-medium">Reduce gaps in my schedule</span>
          <span className="block text-[12px] text-[#8a87a0]">
            Prefer times next to existing appointments so your day stays more compact.
          </span>
        </span>
      </label>

      <div className="space-y-3">
        <label className="flex items-start gap-2 text-[13px]">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={densityEnabled}
            onChange={(e) =>
              onPatch({
                availabilityDensityHidePercent: e.target.checked
                  ? form.availabilityDensityHidePercent || 25
                  : undefined,
              })
            }
          />
          <span>
            <span className="font-medium">Show fewer available times</span>
            <span className="block text-[12px] text-[#8a87a0]">
              Limit how many open times customers see while keeping your actual working hours unchanged.
            </span>
          </span>
        </label>
        {densityEnabled ? (
          <fieldset className="ml-6 space-y-1">
            {DENSITY_PRESETS.map((preset) => (
              <label key={preset.value} className="flex items-center gap-2 text-[12px]">
                <input
                  type="radio"
                  name="density-level"
                  checked={(form.availabilityDensityHidePercent ?? 25) === preset.value}
                  onChange={() => onPatch({ availabilityDensityHidePercent: preset.value })}
                />
                {preset.label}
              </label>
            ))}
          </fieldset>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#eceaf3] bg-[#faf9fc] px-4 py-3">
        <div>
          <p className="text-[13px] font-medium">External calendar conflicts</p>
          <p className="text-[12px] text-[#8a87a0]">
            {blockingCalendarSummary || "No blocking calendars configured"}
          </p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href={CALENDAR_INTEGRATIONS_PATH}>Manage calendars</Link>
        </Button>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : saved ? "Saved" : "Save preferences"}
        </Button>
      </div>
    </section>
  );
}
