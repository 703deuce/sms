"use client";

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import type {
  TransferAvailabilityDayConfig,
  TransferAvailabilityTimeWindow,
  TransferDestinationAvailability,
} from "@/lib/voice-v3/transfer/destination-availability-types";
import {
  TRANSFER_WEEKDAYS,
  defaultTransferDestinationAvailability,
} from "@/lib/voice-v3/transfer/destination-availability-types";
import {
  describeDaySchedule,
  evaluateTransferDestinationEligibility,
} from "@/lib/voice-v3/transfer/evaluate-destination-eligibility";
import { Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { VoiceV2DayOfWeek } from "@/lib/voice-receptionist-wizard/operating-maturity/types";

const DAY_LABELS: Record<VoiceV2DayOfWeek, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

function ensureAvailability(
  state: AppointmentReceptionistWizardState,
  current?: TransferDestinationAvailability,
): TransferDestinationAvailability {
  const tz = state.timezone?.trim() || "America/New_York";
  return current ?? defaultTransferDestinationAvailability(tz);
}

function patchDay(
  availability: TransferDestinationAvailability,
  day: VoiceV2DayOfWeek,
  patch: Partial<TransferAvailabilityDayConfig>,
): TransferDestinationAvailability {
  const prev = availability.weekly[day] ?? { enabled: false, windows: [] };
  return {
    ...availability,
    weekly: {
      ...availability.weekly,
      [day]: { ...prev, ...patch },
    },
  };
}

export function TransferDestinationAvailabilityControls({
  state,
  availability,
  enabled,
  onChange,
}: {
  state: AppointmentReceptionistWizardState;
  availability?: TransferDestinationAvailability;
  enabled: boolean;
  onChange: (next: TransferDestinationAvailability) => void;
}) {
  const avail = ensureAvailability(state, availability);
  const tz = avail.timezone || state.timezone || "America/New_York";

  const status = evaluateTransferDestinationEligibility({
    availability: avail,
    enabled,
    businessTimezone: tz,
  });

  const statusLine =
    avail.temporarilyUnavailable
      ? "⏸ Temporarily unavailable"
      : status.eligible
        ? "● On call now"
        : "○ Off schedule";

  return (
    <div className="space-y-2 rounded-lg border border-border/80 bg-card/50 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">Availability</span>
        <span className="text-muted-foreground" aria-live="polite">{statusLine}</span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="radio"
            name={`avail-mode-${avail.timezone}`}
            checked={avail.mode === "ALWAYS"}
            onChange={() => onChange({ ...avail, mode: "ALWAYS" })}
          />
          Always available
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="radio"
            checked={avail.mode === "SCHEDULED"}
            onChange={() =>
              onChange({
                ...avail,
                mode: "SCHEDULED",
                weekly: avail.weekly?.monday
                  ? avail.weekly
                  : {
                      monday: { enabled: false, windows: [{ start: "17:00", end: "07:00" }] },
                    },
              })
            }
          />
          On-call schedule
        </label>
      </div>

      <div>
        <Label className="text-xs">Timezone</Label>
        <select
          className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-2 text-sm"
          value={tz}
          onChange={(e) => onChange({ ...avail, timezone: e.target.value })}
        >
          <option value="America/New_York">America/New_York</option>
          <option value="America/Chicago">America/Chicago</option>
          <option value="America/Denver">America/Denver</option>
          <option value="America/Los_Angeles">America/Los_Angeles</option>
          <option value="America/Phoenix">America/Phoenix</option>
        </select>
      </div>

      {avail.mode === "SCHEDULED" ? (
        <div className="space-y-2">
          {TRANSFER_WEEKDAYS.map((day) => {
            const dayCfg = avail.weekly[day] ?? { enabled: false, windows: [] };
            return (
              <div key={day} className="rounded border border-border/60 p-2">
                <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={dayCfg.enabled}
                    onChange={(e) =>
                      onChange(
                        patchDay(avail, day, {
                          enabled: e.target.checked,
                          windows: dayCfg.windows?.length
                            ? dayCfg.windows
                            : [{ start: "17:00", end: "07:00" }],
                        }),
                      )
                    }
                  />
                  {DAY_LABELS[day]}
                </label>
                {dayCfg.enabled ? (
                  <div className="mt-2 space-y-2 pl-6">
                    <label className="flex min-h-11 items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={dayCfg.allDay === true}
                        onChange={(e) =>
                          onChange(patchDay(avail, day, { allDay: e.target.checked }))
                        }
                      />
                      All day
                    </label>
                    {!dayCfg.allDay ? (
                      <>
                        {(dayCfg.windows ?? []).map((w, idx) => (
                          <div
                            key={`${day}-${idx}`}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <input
                              type="time"
                              className="h-10 min-w-[7rem] rounded-lg border border-border bg-card px-2 text-sm"
                              value={w.start}
                              onChange={(e) => {
                                const windows = [...(dayCfg.windows ?? [])];
                                windows[idx] = { ...w, start: e.target.value };
                                onChange(patchDay(avail, day, { windows }));
                              }}
                            />
                            <span className="text-xs text-muted-foreground">→</span>
                            <input
                              type="time"
                              className="h-10 min-w-[7rem] rounded-lg border border-border bg-card px-2 text-sm"
                              value={w.end}
                              onChange={(e) => {
                                const windows = [...(dayCfg.windows ?? [])];
                                windows[idx] = { ...w, end: e.target.value };
                                onChange(patchDay(avail, day, { windows }));
                              }}
                            />
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11"
                          onClick={() => {
                            const windows: TransferAvailabilityTimeWindow[] = [
                              ...(dayCfg.windows ?? []),
                              { start: "09:00", end: "17:00" },
                            ];
                            onChange(patchDay(avail, day, { windows }));
                          }}
                        >
                          + Add time window
                        </Button>
                      </>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {describeDaySchedule(dayCfg)}
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 w-full sm:w-auto"
        onClick={() =>
          onChange({
            ...avail,
            temporarilyUnavailable: !avail.temporarilyUnavailable,
          })
        }
      >
        {avail.temporarilyUnavailable ? "Make available" : "Temporarily unavailable"}
      </Button>
    </div>
  );
}
