"use client";

import { CallOutcomeBadge } from "@/components/calls/call-outcome-badge";
import { CallsMetrics } from "@/components/calls/calls-metrics";
import { InlineRecordingButton } from "@/components/calls/inline-recording-button";
import {
  deriveCallOutcomeBadge,
  fmtCallDateTime,
  fmtCallDuration,
  fmtCallPhone,
  type CallListFilter,
} from "@/lib/voice/calls/display";
import { cn } from "@/lib/utils";
import { ChevronRight, Search, SlidersHorizontal, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CallRow = {
  id: string;
  direction: string;
  status: string;
  outcome?: string | null;
  fromE164: string;
  toE164: string;
  durationSeconds?: number | null;
  leadScore?: number | null;
  isTest: boolean;
  startedAt: string;
  agentName?: string | null;
  contactName?: string | null;
  summary?: string | null;
  intent?: string | null;
  sentiment?: string | null;
  isLead?: boolean | null;
  transferred?: boolean;
  voicemailDetected?: boolean;
  appointmentBooked?: boolean;
  hasRecording?: boolean;
  recordingId?: string | null;
  hasTranscript?: boolean;
};

type Analytics = {
  answered: number;
  leads: number;
  appointments: number;
  talkTimeSeconds: number;
  answeredChangePct: number | null;
  leadsChangePct: number | null;
  appointmentsChangePct: number | null;
  talkTimeChangePct: number | null;
};

const FILTERS: { id: CallListFilter; label: string }[] = [
  { id: "all", label: "All calls" },
  { id: "leads", label: "Leads" },
  { id: "messages", label: "Messages" },
  { id: "booked", label: "Booked" },
  { id: "transferred", label: "Transferred" },
  { id: "spam", label: "Spam" },
];

const DATE_RANGES = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
] as const;

export default function VoiceCallsPage() {
  const [rows, setRows] = useState<CallRow[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [filter, setFilter] = useState<CallListFilter>("all");
  const [dateRange, setDateRange] = useState<string>("7d");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: "100",
      test: "0",
      filter,
      dateRange,
    });
    if (q.trim()) params.set("q", q.trim());
    fetch(`/api/voice/calls?${params}`)
      .then((r) => r.json())
      .then((j) => {
        setRows(j.data || []);
        setAnalytics(j.analytics || null);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [filter, dateRange, q]);

  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const pageRows = useMemo(() => {
    const start = (page - 1) * perPage;
    return rows.slice(start, start + perPage);
  }, [rows, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[#111827]">Calls</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Keep track of all call activity for your AI receptionist.
        </p>
      </div>

      {analytics ? <CallsMetrics metrics={analytics} /> : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
          <input
            type="search"
            placeholder="Search calls…"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-sm shadow-sm placeholder:text-[#9ca3af] focus:border-[#6366f1] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => {
              setPage(1);
              setDateRange(e.target.value);
            }}
            className="h-10 rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm text-[#374151] shadow-sm"
          >
            {DATE_RANGES.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
          <button
            type="button"
            className="flex h-10 items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm text-[#374151] shadow-sm"
            title="More filters coming soon"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setPage(1);
              setFilter(f.id);
            }}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
              filter === f.id
                ? "bg-[#6366f1] text-white shadow-sm"
                : "bg-white text-[#6b7280] ring-1 ring-inset ring-[#e5e7eb] hover:bg-[#f9fafb]",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-sm">
        <div className="hidden border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#6b7280] md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto_minmax(0,1.6fr)_auto_auto] md:gap-4">
          <span>User</span>
          <span>Date & Time</span>
          <span>Duration</span>
          <span>Outcome</span>
          <span>Summary</span>
          <span>Recording</span>
          <span className="w-6" />
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-[#6b7280]">Loading calls…</div>
        ) : pageRows.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-[#6b7280]">
            No calls match your filters yet.
          </div>
        ) : (
          pageRows.map((c) => {
            const callerPhone =
              c.direction === "INBOUND" ? c.fromE164 : c.toE164;
            const callerName = c.contactName?.trim() || "Unknown Caller";
            const dt = fmtCallDateTime(c.startedAt);
            const outcome = deriveCallOutcomeBadge(c);

            return (
              <Link
                key={c.id}
                href={`/voice/calls/${c.id}`}
                className="block border-b border-[#f3f4f6] px-4 py-4 transition hover:bg-[#fafafa] last:border-b-0 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto_minmax(0,1.6fr)_auto_auto] md:items-center md:gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[#6366f1]">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#111827]">{callerName}</p>
                    <p className="truncate text-xs text-[#6b7280]">{fmtCallPhone(callerPhone)}</p>
                  </div>
                </div>

                <div className="mt-3 md:mt-0">
                  <p className="text-sm text-[#111827]">{dt.primary}</p>
                  <p className="text-xs text-[#6b7280]">{dt.secondary}</p>
                </div>

                <p className="mt-2 text-sm tabular-nums text-[#374151] md:mt-0">
                  {fmtCallDuration(c.durationSeconds)}
                </p>

                <div className="mt-2 md:mt-0">
                  <CallOutcomeBadge outcome={outcome} />
                </div>

                <p className="mt-2 line-clamp-2 text-sm text-[#4b5563] md:mt-0">
                  {c.summary || c.intent?.replace(/_/g, " ") || "No summary yet."}
                </p>

                <div className="mt-2 md:mt-0">
                  {c.recordingId ? (
                    <InlineRecordingButton
                      recordingId={c.recordingId}
                      durationSeconds={c.durationSeconds}
                    />
                  ) : (
                    <span className="text-xs text-[#9ca3af]">—</span>
                  )}
                </div>

                <ChevronRight className="mt-2 h-5 w-5 text-[#9ca3af] md:mt-0" />
              </Link>
            );
          })
        )}
      </div>

      <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-[#6b7280]">
          Showing {pageRows.length} of {rows.length} calls
        </p>
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium",
                page === n
                  ? "bg-[#6366f1] text-white"
                  : "text-[#6b7280] hover:bg-[#f3f4f6]",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <select
          className="h-8 rounded-lg border border-[#e5e7eb] bg-white px-2 text-xs text-[#6b7280]"
          value={perPage}
          disabled
        >
          <option value={10}>10 rows</option>
        </select>
      </div>
    </div>
  );
}
