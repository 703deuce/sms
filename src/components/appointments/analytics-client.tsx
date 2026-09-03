"use client";

import { Card } from "@/components/ui/card";
import Link from "next/link";
import { useEffect, useState } from "react";

type AnalyticsData = {
  rangeDays: number;
  booked: number;
  confirmed: number;
  awaiting: number;
  canceled: number;
  noShow: number;
  rescheduleRequested: number;
  confirmationRate: number;
  remindersSent: number;
  remindersFailed: number;
  series: Array<{ date: string; count: number }>;
};

export function AppointmentsAnalyticsClient() {
  const [range, setRange] = useState<7 | 30>(7);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/appointments/analytics?range=${range}`)
      .then((r) => r.json())
      .then((json) => setData(json.data))
      .finally(() => setLoading(false));
  }, [range]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading analytics…</p>;
  if (!data) return <p className="text-sm text-rose-600">Could not load analytics.</p>;

  const cards = [
    { label: "Booked", value: data.booked },
    { label: "Confirmed", value: data.confirmed },
    { label: "Awaiting", value: data.awaiting },
    { label: "Canceled", value: data.canceled },
    { label: "No-shows", value: data.noShow },
    { label: "Reschedule requests", value: data.rescheduleRequested },
    { label: "Confirmation rate", value: `${data.confirmationRate}%` },
    { label: "Reminders sent", value: data.remindersSent },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">Operational appointment metrics.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded-md border px-3 py-1.5 text-sm ${range === 7 ? "border-sky-500 bg-sky-50" : "border-slate-200"}`}
            onClick={() => setRange(7)}
          >
            7 days
          </button>
          <button
            type="button"
            className={`rounded-md border px-3 py-1.5 text-sm ${range === 30 ? "border-sky-500 bg-sky-50" : "border-slate-200"}`}
            onClick={() => setRange(30)}
          >
            30 days
          </button>
        </div>
      </div>

      {data.booked === 0 ? (
        <Card className="rounded-xl border-dashed border-slate-200 p-6 text-sm text-slate-600">
          No appointments booked in the last {range} days. Once customers book online or you add
          appointments manually, metrics will appear here.
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="rounded-xl border-slate-200 p-4 shadow-sm">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
          </Card>
        ))}
      </div>

      {data.remindersFailed > 0 ? (
        <Card className="rounded-xl border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-900">
          {data.remindersFailed} reminder delivery failure(s) in this period — check appointment timelines.
        </Card>
      ) : null}

      <Card className="rounded-xl border-slate-200 p-4">
        <h2 className="mb-3 font-semibold text-slate-900">Bookings by day</h2>
        {data.series.length === 0 ? (
          <p className="text-sm text-slate-500">No bookings in this range.</p>
        ) : (
          <div className="space-y-2">
            {data.series.map((row) => (
              <div key={row.date} className="flex items-center gap-3 text-sm">
                <span className="w-28 text-slate-500">{row.date}</span>
                <div className="h-2 flex-1 rounded bg-slate-100">
                  <div
                    className="h-2 rounded bg-sky-500"
                    style={{ width: `${Math.min(100, row.count * 12)}%` }}
                  />
                </div>
                <span className="w-8 text-right font-medium">{row.count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
