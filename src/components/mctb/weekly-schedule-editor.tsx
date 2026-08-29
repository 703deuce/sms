"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { MctbWeeklyDay, MctbWeeklySchedule } from "@/lib/mctb/schedule-shared";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = {
  schedule: MctbWeeklySchedule;
  onChange: (schedule: MctbWeeklySchedule) => void;
};

export function MctbWeeklyScheduleEditor({ schedule, onChange }: Props) {
  function updateDay(day: number, patch: Partial<MctbWeeklyDay>) {
    onChange({
      ...schedule,
      days: schedule.days.map((d) => (d.day === day ? { ...d, ...patch } : d)),
    });
  }

  function toggleDay(day: number) {
    const row = schedule.days.find((d) => d.day === day);
    if (!row) return;
    updateDay(day, { enabled: !row.enabled });
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Timezone</Label>
        <Input
          className="mt-1 max-w-xs"
          value={schedule.timezone}
          onChange={(e) => onChange({ ...schedule, timezone: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        {DAY_LABELS.map((label, day) => {
          const row = schedule.days.find((d) => d.day === day);
          if (!row) return null;
          return (
            <div
              key={day}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <label className="flex items-center gap-2 font-medium">
                <input type="checkbox" checked={row.enabled} onChange={() => toggleDay(day)} />
                {label}
              </label>
              {row.enabled ? (
                <>
                  <Input
                    type="time"
                    className="h-9 w-[120px]"
                    value={row.startTime}
                    onChange={(e) => updateDay(day, { startTime: e.target.value })}
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="time"
                    className="h-9 w-[120px]"
                    value={row.endTime}
                    onChange={(e) => updateDay(day, { endTime: e.target.value })}
                  />
                </>
              ) : (
                <span className="text-muted-foreground">Inactive</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
