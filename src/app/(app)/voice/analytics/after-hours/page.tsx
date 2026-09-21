"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fmtTalkTime } from "@/lib/voice/calls/display";

type Snapshot = {
  kpis: {
    afterHoursCalls: number;
    appointmentsBooked: number;
    messagesAndCallbacks: number;
    emergencyEscalations: number;
    successfulTransfers: number;
    failedTransfers: number;
    spamOrSolicitors: number;
    needsAttention: number;
    avgDurationSeconds: number;
  };
  outcomes: Array<{ label: string; count: number }>;
  callsByDay: Array<{ day: string; count: number }>;
  topReasons: Array<{ reason: string; count: number }>;
  knowledgeGaps: { open: number; newThisWeek: number };
};

export default function VoiceAfterHoursAnalyticsPage() {
  const [range, setRange] = useState("7d");
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/voice/analytics/after-hours?dateRange=${range}`)
      .then((r) => r.json())
      .then((j) => setData(j.data || null))
      .finally(() => setLoading(false));
  }, [range]);

  const k = data?.kpis;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-[#111827]">
            After-hours analytics
          </h1>
          <p className="mt-1 text-sm text-[#6b7280]">What happened while you were closed.</p>
        </div>
        <select
          className="h-10 rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        >
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading analytics…</p>
      ) : !k ? (
        <p className="text-sm text-muted-foreground">No data.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["After-hours calls", k.afterHoursCalls],
              ["Appointments booked", k.appointmentsBooked],
              ["Messages & callbacks", k.messagesAndCallbacks],
              ["Emergency escalations", k.emergencyEscalations],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-[#111827]">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm lg:col-span-2">
              <h2 className="text-sm font-semibold text-[#111827]">Call outcomes</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {(data?.outcomes || []).map((row) => (
                  <li key={row.label} className="flex justify-between gap-4">
                    <span>{row.label}</span>
                    <span className="font-medium">{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-[#111827]">Knowledge gaps</h2>
              <p className="mt-2 text-2xl font-semibold">{data?.knowledgeGaps.open ?? 0}</p>
              <p className="text-xs text-muted-foreground">
                {data?.knowledgeGaps.newThisWeek ?? 0} new this week
              </p>
              <Link href="/voice/knowledge?tab=gaps" className="mt-3 inline-block text-sm text-[#6366f1]">
                Review questions
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold">Top reasons for calling</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {(data?.topReasons || []).map((r) => (
                  <li key={r.reason} className="flex justify-between gap-2">
                    <span className="truncate">{r.reason}</span>
                    <span className="shrink-0 font-medium">{r.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold">Operational</h2>
              <ul className="mt-3 space-y-2 text-sm text-[#374151]">
                <li>Successful transfers: {k.successfulTransfers}</li>
                <li>Failed transfers: {k.failedTransfers}</li>
                <li>Spam/solicitors: {k.spamOrSolicitors}</li>
                <li>
                  Needs attention:{" "}
                  <Link href="/voice/calls?filter=attention" className="text-[#6366f1]">
                    {k.needsAttention}
                  </Link>
                </li>
                <li>Avg duration: {fmtTalkTime(k.avgDurationSeconds)}</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
