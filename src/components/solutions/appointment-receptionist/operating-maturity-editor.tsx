"use client";

import type {
  AppointmentReceptionistWizardState,
} from "@/lib/solutions/appointment-receptionist/types";
import { ensureWizardOperatingMaturity } from "@/lib/solutions/appointment-receptionist/operating-maturity-wizard";
import { DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG } from "@/lib/voice-receptionist-wizard/operating-maturity/defaults";
import type {
  VoiceV2DayOfWeek,
  VoiceV2HolidayClosure,
  VoiceV2OnCallScheduleEntry,
  VoiceV2OperatingMaturityPublishedConfig,
} from "@/lib/voice-receptionist-wizard/operating-maturity/types";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { InfoCallout } from "./ui";

const DAYS: VoiceV2DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function patchMaturity(
  state: AppointmentReceptionistWizardState,
  patch: (m: VoiceV2OperatingMaturityPublishedConfig) => VoiceV2OperatingMaturityPublishedConfig,
  onPatch: (p: Partial<AppointmentReceptionistWizardState>) => void,
) {
  const current = ensureWizardOperatingMaturity(state);
  onPatch({ operatingMaturity: patch(current) });
}

export function BusinessScheduleEditor({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
}) {
  const m = ensureWizardOperatingMaturity(state);
  const schedule = m.businessSchedule;

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="font-medium">Business hours & holidays</h3>
        <p className="text-sm text-muted-foreground">
          Used for after-hours operating state. Does not change phone routing.
        </p>
      </div>
      <div>
        <Label htmlFor="biz-tz">Timezone</Label>
        <Input
          id="biz-tz"
          className="mt-1 max-w-md"
          value={schedule.timezone}
          onChange={(e) =>
            patchMaturity(
              state,
              (cur) => ({
                ...cur,
                businessSchedule: { ...cur.businessSchedule, timezone: e.target.value },
              }),
              patch,
            )
          }
          placeholder="America/New_York"
        />
      </div>
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Weekly schedule
        </p>
        {DAYS.map((day) => {
          const row = schedule.weekly[day] || { closed: true, ranges: [] };
          const range = row.ranges[0] || { start: "09:00", end: "17:00" };
          return (
            <div
              key={day}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm"
            >
              <span className="w-24 capitalize font-medium">{day}</span>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={row.closed}
                  onChange={(e) =>
                    patchMaturity(
                      state,
                      (cur) => ({
                        ...cur,
                        businessSchedule: {
                          ...cur.businessSchedule,
                          weekly: {
                            ...cur.businessSchedule.weekly,
                            [day]: {
                              ...row,
                              closed: e.target.checked,
                              ranges: row.ranges.length ? row.ranges : [range],
                            },
                          },
                        },
                      }),
                      patch,
                    )
                  }
                />
                Closed
              </label>
              {!row.closed ? (
                <>
                  <Input
                    type="time"
                    className="w-32"
                    value={range.start}
                    onChange={(e) =>
                      patchMaturity(
                        state,
                        (cur) => ({
                          ...cur,
                          businessSchedule: {
                            ...cur.businessSchedule,
                            weekly: {
                              ...cur.businessSchedule.weekly,
                              [day]: {
                                closed: false,
                                ranges: [{ start: e.target.value, end: range.end }],
                              },
                            },
                          },
                        }),
                        patch,
                      )
                    }
                  />
                  <span>to</span>
                  <Input
                    type="time"
                    className="w-32"
                    value={range.end}
                    onChange={(e) =>
                      patchMaturity(
                        state,
                        (cur) => ({
                          ...cur,
                          businessSchedule: {
                            ...cur.businessSchedule,
                            weekly: {
                              ...cur.businessSchedule.weekly,
                              [day]: {
                                closed: false,
                                ranges: [{ start: range.start, end: e.target.value }],
                              },
                            },
                          },
                        }),
                        patch,
                      )
                    }
                  />
                </>
              ) : null}
            </div>
          );
        })}
      </div>
      <HolidayListEditor
        holidays={schedule.holidays}
        onChange={(holidays) =>
          patchMaturity(
            state,
            (cur) => ({
              ...cur,
              businessSchedule: { ...cur.businessSchedule, holidays },
            }),
            patch,
          )
        }
      />
    </section>
  );
}

function HolidayListEditor({
  holidays,
  onChange,
}: {
  holidays: VoiceV2HolidayClosure[];
  onChange: (h: VoiceV2HolidayClosure[]) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Holiday closures
      </p>
      {holidays.map((h) => (
        <div key={h.id} className="flex flex-wrap gap-2 rounded-lg border border-border p-2 text-sm">
          <Input
            className="min-w-[120px] flex-1"
            value={h.name}
            onChange={(e) =>
              onChange(
                holidays.map((row) =>
                  row.id === h.id ? { ...row, name: e.target.value } : row,
                ),
              )
            }
            placeholder="Holiday name"
          />
          <Input
            type="date"
            value={h.startDate}
            onChange={(e) =>
              onChange(
                holidays.map((row) =>
                  row.id === h.id
                    ? { ...row, startDate: e.target.value, endDate: e.target.value }
                    : row,
                ),
              )
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(holidays.filter((row) => row.id !== h.id))}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() =>
          onChange([
            ...holidays,
            {
              id: `hol-${Date.now()}`,
              name: "Holiday",
              startDate: new Date().toISOString().slice(0, 10),
              endDate: new Date().toISOString().slice(0, 10),
              closedAllDay: true,
            },
          ])
        }
      >
        Add holiday
      </Button>
    </div>
  );
}

export function AfterHoursBehaviorEditor({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
}) {
  const m = ensureWizardOperatingMaturity(state);
  const when = m.afterHoursBehavior.whenClosed;

  const toggle = (key: keyof typeof when, value: boolean) => {
    patchMaturity(
      state,
      (cur) => ({
        ...cur,
        afterHoursBehavior: {
          ...cur.afterHoursBehavior,
          whenClosed: { ...cur.afterHoursBehavior.whenClosed, [key]: value },
        },
      }),
      patch,
    );
  };

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h3 className="font-medium">After-hours behavior</h3>
      <p className="text-sm text-muted-foreground">
        What Amy may do when operating state is closed, weekend, or holiday.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={m.afterHoursBehavior.useOperatingStateDuringCalls}
          onChange={(e) =>
            patchMaturity(
              state,
              (cur) => ({
                ...cur,
                afterHoursBehavior: {
                  ...cur.afterHoursBehavior,
                  useOperatingStateDuringCalls: e.target.checked,
                },
              }),
              patch,
            )
          }
        />
        Apply operating state during live calls
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ["allowLiveBooking", "Allow live booking"],
            ["allowCallbackRequest", "Allow callback requests"],
            ["allowMessageTaking", "Allow message taking"],
            ["allowOnCallEscalation", "Allow on-call escalation"],
            ["allowOfficeTransfer", "Allow office transfer when closed"],
            ["allowNormalTransferDestinations", "Allow normal transfer destinations"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={when[key]}
              onChange={(e) => toggle(key, e.target.checked)}
            />
            {label}
          </label>
        ))}
      </div>
      <InfoCallout>
        On-call escalation uses your published on-call schedule or tonight&apos;s override from
        Operations.
      </InfoCallout>
    </section>
  );
}

export function OnCallScheduleEditor({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
}) {
  const m = ensureWizardOperatingMaturity(state);
  const onCall = m.onCallSchedule;

  const updateEntries = (entries: VoiceV2OnCallScheduleEntry[]) => {
    patchMaturity(
      state,
      (cur) => ({
        ...cur,
        onCallSchedule: { ...cur.onCallSchedule, entries },
      }),
      patch,
    );
  };

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h3 className="font-medium">On-call schedule</h3>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={onCall.enabled}
          onChange={(e) =>
            patchMaturity(
              state,
              (cur) => ({
                ...cur,
                onCallSchedule: { ...cur.onCallSchedule, enabled: e.target.checked },
              }),
              patch,
            )
          }
        />
        Enable on-call rotation
      </label>
      {onCall.entries.map((entry) => (
        <div key={entry.id} className="space-y-2 rounded-lg border border-border p-3 text-sm">
          <Input
            value={entry.name || ""}
            placeholder="Label (e.g. Mike)"
            onChange={(e) =>
              updateEntries(
                onCall.entries.map((row) =>
                  row.id === entry.id ? { ...row, name: e.target.value } : row,
                ),
              )
            }
          />
          <div className="flex flex-wrap gap-2">
            <Input
              type="number"
              min={0}
              max={6}
              className="w-20"
              value={entry.dayOfWeek ?? 1}
              onChange={(e) =>
                updateEntries(
                  onCall.entries.map((row) =>
                    row.id === entry.id
                      ? { ...row, dayOfWeek: Number(e.target.value) }
                      : row,
                  ),
                )
              }
              aria-label="Day of week 0=Sun"
            />
            <Input
              type="time"
              value={entry.startTime}
              onChange={(e) =>
                updateEntries(
                  onCall.entries.map((row) =>
                    row.id === entry.id ? { ...row, startTime: e.target.value } : row,
                  ),
                )
              }
            />
            <Input
              type="time"
              value={entry.endTime}
              onChange={(e) =>
                updateEntries(
                  onCall.entries.map((row) =>
                    row.id === entry.id ? { ...row, endTime: e.target.value } : row,
                  ),
                )
              }
            />
            <Input
              className="min-w-[140px] flex-1"
              value={entry.destination.phoneE164 || ""}
              placeholder="+1… on-call phone"
              onChange={(e) =>
                updateEntries(
                  onCall.entries.map((row) =>
                    row.id === entry.id
                      ? {
                          ...row,
                          destination: {
                            ...row.destination,
                            label: row.destination.label || row.name || "On-call",
                            phoneE164: e.target.value,
                          },
                        }
                      : row,
                  ),
                )
              }
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => updateEntries(onCall.entries.filter((row) => row.id !== entry.id))}
          >
            Remove entry
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() =>
          updateEntries([
            ...onCall.entries,
            {
              id: `oncall-${Date.now()}`,
              name: "On-call",
              dayOfWeek: 1,
              startTime: "17:00",
              endTime: "09:00",
              destination: { label: "On-call", phoneE164: "" },
              priority: 1,
              enabled: true,
            },
          ])
        }
      >
        Add on-call window
      </Button>
    </section>
  );
}

export function CallbackSlaEditor({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
}) {
  const m = ensureWizardOperatingMaturity(state);
  const sla = m.callbackSla;

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h3 className="font-medium">Callback SLA</h3>
      <p className="text-sm text-muted-foreground">
        Promised response windows for callback requests created from voice.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Normal callbacks</Label>
          <select
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={sla.normalTarget}
            onChange={(e) =>
              patchMaturity(
                state,
                (cur) => ({
                  ...cur,
                  callbackSla: {
                    ...cur.callbackSla,
                    normalTarget: e.target.value as typeof sla.normalTarget,
                  },
                }),
                patch,
              )
            }
          >
            <option value="30m">30 minutes</option>
            <option value="1h">1 hour</option>
            <option value="next_business_day">Next business day</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div>
          <Label>Urgent callbacks</Label>
          <select
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={sla.urgentTarget}
            onChange={(e) =>
              patchMaturity(
                state,
                (cur) => ({
                  ...cur,
                  callbackSla: {
                    ...cur.callbackSla,
                    urgentTarget: e.target.value as typeof sla.urgentTarget,
                  },
                }),
                patch,
              )
            }
          >
            <option value="immediate">Immediate</option>
            <option value="15m">15 minutes</option>
            <option value="30m">30 minutes</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>
    </section>
  );
}

export function initOperatingMaturityIfMissing(
  state: AppointmentReceptionistWizardState,
): VoiceV2OperatingMaturityPublishedConfig {
  return state.operatingMaturity ?? DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG;
}
