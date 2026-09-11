"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export type OccurrenceRow = {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  status: string;
  enrolled?: number;
  remaining?: number;
};

type NewOccurrenceForm = {
  date: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
};

type RecurrenceForm = {
  startDate: string;
  startTime: string;
  durationMinutes: number;
  weekdays: number[];
  weeks: number;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function ClassSeriesOccurrencePanel({
  seriesId,
  defaultCapacity,
  timezone,
  showWeeklyRecurrence = true,
}: {
  seriesId: string;
  defaultCapacity: number;
  timezone?: string;
  /** Workshops default to single-session UX; classes expose weekly generator. */
  showWeeklyRecurrence?: boolean;
}) {
  const [rows, setRows] = useState<OccurrenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [single, setSingle] = useState<NewOccurrenceForm>({
    date: "",
    startTime: "09:00",
    durationMinutes: 60,
    capacity: defaultCapacity,
  });
  const [recurrence, setRecurrence] = useState<RecurrenceForm>({
    startDate: "",
    startTime: "09:00",
    durationMinutes: 60,
    weekdays: [1, 3],
    weeks: 4,
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/appointments/service-booking/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_occurrences", seriesId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load schedule");
      setRows(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setSingle((s) => ({ ...s, capacity: defaultCapacity }));
  }, [defaultCapacity]);

  const addSingle = async () => {
    if (!single.date || !single.startTime) {
      setError("Date and start time are required");
      return;
    }
    setBusy(true);
    setError("");
    const startsAt = toIso(single.date, single.startTime);
    const endsAt = new Date(
      new Date(startsAt).getTime() + single.durationMinutes * 60_000,
    ).toISOString();
    try {
      const res = await fetch("/api/appointments/service-booking/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "occurrences",
          seriesId,
          occurrences: [{ startsAt, endsAt, capacity: single.capacity }],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not add occurrence");
      setSingle((s) => ({ ...s, date: "" }));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const addWeeklyRecurrence = async () => {
    if (!recurrence.startDate || recurrence.weekdays.length === 0) {
      setError("Start date and at least one weekday are required");
      return;
    }
    setBusy(true);
    setError("");
    const occurrences: Array<{ startsAt: string; endsAt: string; capacity?: number }> = [];
    const start = new Date(`${recurrence.startDate}T${recurrence.startTime}:00`);
    for (let week = 0; week < recurrence.weeks; week += 1) {
      for (const day of recurrence.weekdays) {
        const d = new Date(start);
        d.setDate(start.getDate() + week * 7 + (day - start.getDay()));
        if (d < start) continue;
        const startsAt = d.toISOString();
        const endsAt = new Date(
          d.getTime() + recurrence.durationMinutes * 60_000,
        ).toISOString();
        occurrences.push({ startsAt, endsAt, capacity: defaultCapacity });
      }
    }
    try {
      const res = await fetch("/api/appointments/service-booking/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "occurrences", seriesId, occurrences }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not generate schedule");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recurrence failed");
    } finally {
      setBusy(false);
    }
  };

  const cancelOccurrence = async (id: string) => {
    if (!confirm("Cancel this occurrence? Existing registrations remain on record.")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/appointments/service-booking/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_occurrence", occurrenceId: id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not cancel");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  };

  const upcoming = rows.filter((r) => r.status !== "cancelled");

  return (
    <div className="space-y-6">
      {timezone ? (
        <p className="text-[12.5px] text-[#8a8fa3]">Timezone: {timezone}</p>
      ) : null}

      <div className="rounded-lg border border-[#ecedf2] p-4 space-y-3">
        <h4 className="text-[13px] font-semibold text-[#1a1d29]">Add single occurrence</h4>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor="occ-date">Date</label>
            <input
              id="occ-date"
              type="date"
              className="input w-full"
              value={single.date}
              onChange={(e) => setSingle((s) => ({ ...s, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="occ-time">Start time</label>
            <input
              id="occ-time"
              type="time"
              className="input w-full"
              value={single.startTime}
              onChange={(e) => setSingle((s) => ({ ...s, startTime: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="occ-duration">Duration (min)</label>
            <input
              id="occ-duration"
              type="number"
              min={15}
              className="input w-full"
              value={single.durationMinutes}
              onChange={(e) =>
                setSingle((s) => ({ ...s, durationMinutes: Number(e.target.value) || 60 }))
              }
            />
          </div>
          <div className="flex items-end">
            <Button type="button" size="sm" disabled={busy} onClick={() => void addSingle()}>
              Add occurrence
            </Button>
          </div>
        </div>
      </div>

      {showWeeklyRecurrence ? (
      <div className="rounded-lg border border-[#ecedf2] p-4 space-y-3">
        <h4 className="text-[13px] font-semibold text-[#1a1d29]">Weekly recurrence</h4>
        <p className="text-[12px] text-[#8a8fa3]">
          Generates individual occurrences using the current backend — not a standing RRULE editor.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="rec-start">Starts on</label>
            <input
              id="rec-start"
              type="date"
              className="input w-full"
              value={recurrence.startDate}
              onChange={(e) => setRecurrence((r) => ({ ...r, startDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="rec-time">Time</label>
            <input
              id="rec-time"
              type="time"
              className="input w-full"
              value={recurrence.startTime}
              onChange={(e) => setRecurrence((r) => ({ ...r, startTime: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="rec-weeks">Weeks</label>
            <input
              id="rec-weeks"
              type="number"
              min={1}
              max={52}
              className="input w-full"
              value={recurrence.weeks}
              onChange={(e) => setRecurrence((r) => ({ ...r, weeks: Number(e.target.value) || 1 }))}
            />
          </div>
        </div>
        <div>
          <span className="label">On days</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {WEEKDAY_LABELS.map((label, idx) => {
              const on = recurrence.weekdays.includes(idx);
              return (
                <button
                  key={label}
                  type="button"
                  className={`h-8 px-2.5 rounded-md text-[12px] font-medium border ${
                    on
                      ? "bg-[#dcefeb] border-[#147d74] text-[#10665f]"
                      : "bg-white border-[#ecedf2] text-[#6b6f82]"
                  }`}
                  onClick={() =>
                    setRecurrence((r) => ({
                      ...r,
                      weekdays: on
                        ? r.weekdays.filter((d) => d !== idx)
                        : [...r.weekdays, idx].sort(),
                    }))
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void addWeeklyRecurrence()}>
          Generate weekly schedule
        </Button>
      </div>
      ) : null}

      <div>
        <h4 className="text-[13px] font-semibold text-[#1a1d29] mb-2">Upcoming occurrences</h4>
        {loading ? (
          <p className="text-[12.5px] text-[#8a8fa3]">Loading schedule…</p>
        ) : upcoming.length === 0 ? (
          <p className="text-[12.5px] text-[#8a8fa3]">No upcoming occurrences yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#ecedf2]">
            <table className="w-full text-left text-[12.5px]">
              <thead className="bg-[#fafbfc] text-[#6b6f82]">
                <tr>
                  <th className="px-3 py-2 font-semibold" scope="col">Date & time</th>
                  <th className="px-3 py-2 font-semibold" scope="col">Capacity</th>
                  <th className="px-3 py-2 font-semibold" scope="col">Registered</th>
                  <th className="px-3 py-2 font-semibold" scope="col">Status</th>
                  <th className="px-3 py-2 font-semibold" scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((row) => (
                  <tr key={row.id} className="border-t border-[#ecedf2]">
                    <td className="px-3 py-2 tabular-nums">
                      {new Date(row.startsAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{row.capacity ?? defaultCapacity}</td>
                    <td className="px-3 py-2">
                      {row.enrolled ?? 0}
                      {row.remaining != null ? ` · ${row.remaining} left` : ""}
                    </td>
                    <td className="px-3 py-2 capitalize">{row.status}</td>
                    <td className="px-3 py-2">
                      {row.status === "scheduled" ? (
                        <button
                          type="button"
                          className="text-[12px] font-medium text-red-600 hover:underline"
                          onClick={() => void cancelOccurrence(row.id)}
                        >
                          Cancel
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error ? <p className="text-[13px] text-red-600" role="alert">{error}</p> : null}
    </div>
  );
}
