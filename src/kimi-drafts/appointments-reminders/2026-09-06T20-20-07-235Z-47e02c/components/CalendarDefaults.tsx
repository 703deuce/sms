"use client";

import { useState } from "react";
import { CalendarCog } from "lucide-react";
import {
  CALENDAR_DEFAULTS,
  STEP_SHORT_LABELS,
  type CalendarDefault,
  type ReminderStepKey,
} from "../mock-data";

export default function CalendarDefaults({
  readOnly = false,
  onDirty,
}: {
  readOnly?: boolean;
  onDirty: () => void;
}) {
  const [calendars, setCalendars] = useState<CalendarDefault[]>(CALENDAR_DEFAULTS);

  const setCustom = (id: string, custom: boolean) => {
    setCalendars((prev) => prev.map((c) => (c.id === id ? { ...c, custom } : c)));
    onDirty();
  };

  const toggleStep = (id: string, step: ReminderStepKey) => {
    setCalendars((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, steps: { ...c.steps, [step]: !c.steps[step] } } : c,
      ),
    );
    onDirty();
  };

  return (
    <section className="rs-card" aria-labelledby="cal-defaults-h">
      <div className="rs-card-hd">
        <span className="rs-icon-tile">
          <CalendarCog className="h-4 w-4" />
        </span>
        <div>
          <h2 id="cal-defaults-h" className="text-[13.5px] font-semibold text-gray-900">
            Per-calendar defaults
          </h2>
          <p className="text-[12px] text-gray-500">
            Override the workspace sequence for specific calendars. Everything else inherits
            the defaults above.
          </p>
        </div>
      </div>

      <div>
        {calendars.map((cal) => (
          <div key={cal.id} className="rs-cal-row">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[13px] font-medium text-gray-900">
                  {cal.name}
                </span>
                <span
                  className={cal.custom ? "rs-badge rs-badge-info" : "rs-badge"}
                >
                  {cal.custom ? "Custom" : "Using workspace default"}
                </span>
              </div>
              <p className="mt-0.5 text-[11.5px] text-gray-500">
                {cal.appointmentCount} upcoming appointments
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {cal.custom ? (
                (Object.keys(STEP_SHORT_LABELS) as ReminderStepKey[]).map((step) => (
                  <button
                    key={step}
                    type="button"
                    className="rs-step-chip"
                    data-on={cal.steps[step]}
                    aria-pressed={cal.steps[step]}
                    disabled={readOnly}
                    onClick={() => toggleStep(cal.id, step)}
                  >
                    {STEP_SHORT_LABELS[step]}
                  </button>
                ))
              ) : null}
              <select
                className="rs-select h-8 text-[12px]"
                value={cal.custom ? "custom" : "default"}
                disabled={readOnly}
                aria-label={`Reminder defaults for ${cal.name}`}
                onChange={(e) => setCustom(cal.id, e.target.value === "custom")}
              >
                <option value="default">Use workspace default</option>
                <option value="custom">Customize for this calendar</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
