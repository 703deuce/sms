"use client";

import { ClassSeriesOccurrencePanel } from "./class-series-occurrence-panel";

/** Workshop date/time uses occurrence records; default UX is single-session first. */
export function ClassSeriesWorkshopSchedulePanel({
  seriesId,
  defaultCapacity,
  timezone,
}: {
  seriesId: string;
  defaultCapacity: number;
  timezone?: string;
}) {
  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-[#8a8fa3]">
        Set the workshop date and time. For multi-day workshops, add each session below.
      </p>
      <ClassSeriesOccurrencePanel
        seriesId={seriesId}
        defaultCapacity={defaultCapacity}
        timezone={timezone}
        showWeeklyRecurrence={false}
      />
    </div>
  );
}
