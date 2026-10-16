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
import {
  pickWizardFieldComponents,
  type WizardPresentation,
  WizardCheckboxInline,
  WizardHint,
  WizardSelectField,
  WizardToggleField,
} from "./wizard-field-kit";
import { OpusCompactPanel } from "./wizard-opus-ui";
import {
  DEFAULT_US_BUSINESS_TIMEZONE,
  US_BUSINESS_TIMEZONE_OPTIONS,
} from "@/lib/solutions/appointment-receptionist/us-business-timezones";

function LegacySection({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      {title ? <h3 className="font-medium">{title}</h3> : null}
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      <div className={title || description ? "mt-3 space-y-4" : "space-y-4"}>{children}</div>
    </section>
  );
}

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
  presentation = "legacy",
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  presentation?: WizardPresentation;
}) {
  const m = ensureWizardOperatingMaturity(state);
  const schedule = m.businessSchedule;
  const { Input, Label, Button, Panel } = pickWizardFieldComponents(presentation);
  const isOpus = presentation === "opus";
  const Section = isOpus ? Panel : LegacySection;

  return (
    <Section
      title="Business hours & holidays"
      description="Used for after-hours operating state. Does not change phone routing."
    >
      <div>
        <WizardSelectField
          presentation={presentation}
          id="biz-tz"
          label="Timezone"
          value={schedule.timezone || DEFAULT_US_BUSINESS_TIMEZONE}
          onChange={(tz) =>
            patchMaturity(
              state,
              (cur) => ({
                ...cur,
                businessSchedule: {
                  ...cur.businessSchedule,
                  timezone: tz || DEFAULT_US_BUSINESS_TIMEZONE,
                },
              }),
              patch,
            )
          }
          options={US_BUSINESS_TIMEZONE_OPTIONS}
        />
        <WizardHint className="mt-1">
          Used when deciding if a call is after hours. Pick the zone where your business operates.
        </WizardHint>
      </div>
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Weekly schedule
        </p>
        {DAYS.map((day) => {
          const row = schedule.weekly[day] || { closed: true, ranges: [] };
          const range = row.ranges[0] || { start: "09:00", end: "17:00" };
          return (
            <OpusCompactPanel key={day} isOpus={isOpus} className="text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-24 capitalize font-medium">{day}</span>
              <WizardCheckboxInline
                presentation={presentation}
                label="Closed"
                checked={row.closed}
                onCheckedChange={(on) =>
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
                            closed: on,
                            ranges: row.ranges.length ? row.ranges : [range],
                          },
                        },
                      },
                    }),
                    patch,
                  )
                }
              />
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
            </OpusCompactPanel>
          );
        })}
      </div>
      <HolidayListEditor
        presentation={presentation}
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
    </Section>
  );
}

function HolidayListEditor({
  presentation = "legacy",
  holidays,
  onChange,
}: {
  presentation?: WizardPresentation;
  holidays: VoiceV2HolidayClosure[];
  onChange: (h: VoiceV2HolidayClosure[]) => void;
}) {
  const { Input, Button } = pickWizardFieldComponents(presentation);
  const isOpus = presentation === "opus";
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Holiday closures
      </p>
      {holidays.map((h) => (
        <OpusCompactPanel key={h.id} isOpus={isOpus} bodyClassName="p-2">
        <div className="flex flex-wrap gap-2 text-sm">
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
        </OpusCompactPanel>
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
  presentation = "legacy",
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  presentation?: WizardPresentation;
}) {
  const m = ensureWizardOperatingMaturity(state);
  const when = m.afterHoursBehavior.whenClosed;
  const Section = presentation === "opus" ? pickWizardFieldComponents(presentation).Panel : LegacySection;

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
    <Section
      title="After-hours behavior"
      description="What Amy may do when operating state is closed, weekend, or holiday."
    >
      <WizardToggleField
        presentation={presentation}
        label="Apply operating state during live calls"
        checked={m.afterHoursBehavior.useOperatingStateDuringCalls}
        onCheckedChange={(on) =>
          patchMaturity(
            state,
            (cur) => ({
              ...cur,
              afterHoursBehavior: {
                ...cur.afterHoursBehavior,
                useOperatingStateDuringCalls: on,
              },
            }),
            patch,
          )
        }
      />
      <div className="grid gap-1 sm:grid-cols-2">
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
          <WizardToggleField
            key={key}
            presentation={presentation}
            label={label}
            checked={when[key]}
            onCheckedChange={(on) => toggle(key, on)}
          />
        ))}
      </div>
      <WizardHint presentation={presentation}>
        On-call escalation uses your published on-call schedule or tonight&apos;s override from
        Operations.
      </WizardHint>
    </Section>
  );
}

export function OnCallScheduleEditor({
  state,
  patch,
  presentation = "legacy",
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  presentation?: WizardPresentation;
}) {
  const m = ensureWizardOperatingMaturity(state);
  const onCall = m.onCallSchedule;
  const { Input, Button, Panel } = pickWizardFieldComponents(presentation);
  const isOpus = presentation === "opus";
  const Section = isOpus ? Panel : LegacySection;

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
    <Section title="On-call schedule">
      <WizardToggleField
        presentation={presentation}
        label="Enable on-call rotation"
        checked={onCall.enabled}
        onCheckedChange={(on) =>
          patchMaturity(
            state,
            (cur) => ({
              ...cur,
              onCallSchedule: { ...cur.onCallSchedule, enabled: on },
            }),
            patch,
          )
        }
      />
      {onCall.entries.map((entry) => (
        <OpusCompactPanel key={entry.id} isOpus={isOpus} className="text-sm">
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
        </OpusCompactPanel>
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
    </Section>
  );
}

export function CallbackSlaEditor({
  state,
  patch,
  presentation = "legacy",
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  presentation?: WizardPresentation;
}) {
  const m = ensureWizardOperatingMaturity(state);
  const sla = m.callbackSla;
  const Section = presentation === "opus" ? pickWizardFieldComponents(presentation).Panel : LegacySection;

  return (
    <Section
      title="Callback SLA"
      description="Sets promised deadlines on voice callback requests. When a deadline passes, staff get an in-app notification on Callback requests. Transovo does not auto-dial overdue callbacks."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <WizardSelectField
          presentation={presentation}
          label="Normal callbacks"
          value={sla.normalTarget}
          onChange={(value) =>
            patchMaturity(
              state,
              (cur) => ({
                ...cur,
                callbackSla: {
                  ...cur.callbackSla,
                  normalTarget: value as typeof sla.normalTarget,
                },
              }),
              patch,
            )
          }
          options={[
            { value: "30m", label: "30 minutes" },
            { value: "1h", label: "1 hour" },
            { value: "next_business_day", label: "Next business day" },
            { value: "custom", label: "Custom" },
          ]}
        />
        <WizardSelectField
          presentation={presentation}
          label="Urgent callbacks"
          value={sla.urgentTarget}
          onChange={(value) =>
            patchMaturity(
              state,
              (cur) => ({
                ...cur,
                callbackSla: {
                  ...cur.callbackSla,
                  urgentTarget: value as typeof sla.urgentTarget,
                },
              }),
              patch,
            )
          }
          options={[
            { value: "immediate", label: "Immediate" },
            { value: "15m", label: "15 minutes" },
            { value: "30m", label: "30 minutes" },
            { value: "custom", label: "Custom" },
          ]}
        />
      </div>
    </Section>
  );
}

export function initOperatingMaturityIfMissing(
  state: AppointmentReceptionistWizardState,
): VoiceV2OperatingMaturityPublishedConfig {
  return state.operatingMaturity ?? DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG;
}
