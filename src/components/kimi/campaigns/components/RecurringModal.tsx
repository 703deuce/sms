"use client";

import { useMemo, useState } from "react";
import { X, Calendar } from "lucide-react";
import type { BroadcastRecurrence } from "@/lib/mass-texting/broadcast/types";
import {
  defaultRecurrence,
  formatRecurrenceSummary,
  validateRecurrence,
} from "@/lib/campaigns/recurrence-format";
import {
  CampaignButton,
  CampaignGhostButton,
  CampaignInput,
  CampaignLabel,
  CampaignModalCard,
  CampaignModalOverlay,
  CampaignSegmentOption,
  CampaignSegmentToggle,
  CampaignWeekdayToggle,
} from "@/components/campaigns/campaign-ui-primitives";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = ["00", "15", "30", "45"];

type RecurringModalProps = {
  timezone: string;
  initial?: BroadcastRecurrence;
  onClose: () => void;
  onSet: (recurrence: BroadcastRecurrence, summary: string) => void;
};

export default function RecurringModal({
  timezone,
  initial,
  onClose,
  onSet,
}: RecurringModalProps) {
  const [rec, setRec] = useState<BroadcastRecurrence>(
    initial ? { ...initial, timezone: initial.timezone || timezone } : defaultRecurrence(timezone),
  );

  const unitLabel = rec.unit === "days" ? "Days" : rec.unit === "weeks" ? "Weeks" : "Months";

  const summary = useMemo(() => formatRecurrenceSummary(rec, timezone), [rec, timezone]);
  const validationError = useMemo(() => validateRecurrence(rec), [rec]);

  const toggleWeekday = (dayIndex: number) => {
    const current = rec.weekdays ?? [];
    const next = current.includes(dayIndex)
      ? current.filter((d) => d !== dayIndex)
      : [...current, dayIndex].sort((a, b) => a - b);
    setRec({ ...rec, weekdays: next.length ? next : [dayIndex] });
  };

  const handleSet = () => {
    if (validationError) return;
    onSet({ ...rec, timezone }, summary);
  };

  return (
    <CampaignModalOverlay onClose={onClose}>
      <CampaignModalCard className="w-[420px] max-w-[calc(100vw-2rem)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <Calendar className="h-3.5 w-3.5 text-primary" aria-hidden />
            </span>
            Recurring Send
          </h2>
          <CampaignButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close recurring schedule dialog"
          >
            <X className="h-4 w-4" />
          </CampaignButton>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <CampaignLabel htmlFor="rec-start-date">Starting on</CampaignLabel>
            <CampaignInput
              id="rec-start-date"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={rec.startDate}
              onChange={(e) => setRec({ ...rec, startDate: e.target.value })}
            />
          </div>

          <div>
            <CampaignLabel>Repeat every</CampaignLabel>
            <div className="mt-1 flex gap-2">
              <select
                value={String(rec.interval)}
                onChange={(e) => setRec({ ...rec, interval: Number(e.target.value) })}
                className="h-9 w-20 rounded-md border border-input bg-background px-2 text-[13px]"
                aria-label="Interval"
              >
                {["1", "2", "3", "4"].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <select
                value={unitLabel}
                onChange={(e) => {
                  const unit =
                    e.target.value === "Days" ? "days" : e.target.value === "Weeks" ? "weeks" : "months";
                  setRec({
                    ...rec,
                    unit,
                    weekdays:
                      unit === "weeks"
                        ? rec.weekdays?.length
                          ? rec.weekdays
                          : [new Date(rec.startDate).getDay()]
                        : undefined,
                  });
                }}
                className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 text-[13px]"
                aria-label="Recurrence unit"
              >
                <option>Days</option>
                <option>Weeks</option>
                <option>Months</option>
              </select>
            </div>
          </div>

          {rec.unit === "weeks" ? (
            <div>
              <CampaignLabel>On the following weekdays</CampaignLabel>
              <div className="mt-1 flex gap-1" role="group" aria-label="Weekdays">
                {WEEKDAYS.map((label, index) => (
                  <CampaignWeekdayToggle
                    key={label}
                    active={rec.weekdays?.includes(index)}
                    onClick={() => toggleWeekday(index)}
                    aria-pressed={rec.weekdays?.includes(index)}
                  >
                    {label}
                  </CampaignWeekdayToggle>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <CampaignLabel>Sending at</CampaignLabel>
            <div className="mt-1 flex gap-2">
              <select
                value={String(rec.sendHour)}
                onChange={(e) => setRec({ ...rec, sendHour: Number(e.target.value) })}
                className="h-9 w-16 rounded-md border border-input bg-background px-2 text-[13px]"
                aria-label="Hour"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <select
                value={String(rec.sendMinute).padStart(2, "0")}
                onChange={(e) => setRec({ ...rec, sendMinute: Number(e.target.value) })}
                className="h-9 w-16 rounded-md border border-input bg-background px-2 text-[13px]"
                aria-label="Minute"
              >
                {MINUTES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={rec.ampm}
                onChange={(e) => setRec({ ...rec, ampm: e.target.value as "AM" | "PM" })}
                className="h-9 w-20 rounded-md border border-input bg-background px-2 text-[13px]"
                aria-label="AM or PM"
              >
                <option>AM</option>
                <option>PM</option>
              </select>
            </div>
          </div>

          <div>
            <CampaignLabel>Ending</CampaignLabel>
            <CampaignSegmentToggle className="mt-1 w-full">
              {(["never", "on", "after"] as const).map((mode) => (
                <CampaignSegmentOption
                  key={mode}
                  active={rec.endMode === mode}
                  onClick={() => setRec({ ...rec, endMode: mode })}
                  aria-pressed={rec.endMode === mode}
                >
                  {mode === "never" ? "Never" : mode === "on" ? "On" : "After"}
                </CampaignSegmentOption>
              ))}
            </CampaignSegmentToggle>
          </div>

          {rec.endMode === "on" ? (
            <div>
              <CampaignLabel htmlFor="rec-end-date">End date</CampaignLabel>
              <CampaignInput
                id="rec-end-date"
                type="date"
                min={rec.startDate}
                value={rec.endDate || ""}
                onChange={(e) => setRec({ ...rec, endDate: e.target.value })}
              />
            </div>
          ) : null}

          {rec.endMode === "after" ? (
            <div>
              <CampaignLabel htmlFor="rec-end-after">Number of sends</CampaignLabel>
              <CampaignInput
                id="rec-end-after"
                type="number"
                min={1}
                value={rec.endAfter ?? 10}
                onChange={(e) => setRec({ ...rec, endAfter: Number(e.target.value) })}
              />
            </div>
          ) : null}

          <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-[12px] leading-relaxed text-foreground">
            {summary}
          </p>
          {validationError ? (
            <p className="text-[12px] font-medium text-destructive" role="alert">{validationError}</p>
          ) : null}
        </div>

        <div className="mt-5 flex gap-2">
          <CampaignButton
            type="button"
            className="flex-1"
            disabled={Boolean(validationError)}
            onClick={handleSet}
          >
            Set schedule
          </CampaignButton>
          <CampaignGhostButton type="button" className="flex-1" onClick={onClose}>
            Cancel
          </CampaignGhostButton>
        </div>
      </CampaignModalCard>
    </CampaignModalOverlay>
  );
}
