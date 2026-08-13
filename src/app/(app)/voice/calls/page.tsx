"use client";

import { CallOutcomeBadge } from "@/components/calls/call-outcome-badge";
import { CallsMetrics } from "@/components/calls/calls-metrics";
import {
  deriveCallOutcomeBadge,
  fmtCallDateTable,
  fmtCallDurationTable,
  fmtCallPhone,
  type CallListFilter,
} from "@/lib/voice/calls/display";
import {
  MOCK_CALL_ROWS,
  MOCK_CALLS_METRICS,
  type MockCallRow,
} from "@/lib/voice/calls/mock-data";
import { cn } from "@/lib/utils";
import {
  AudioWaveform,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  MessageSquare,
  Search,
} from "lucide-react";
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
  startedAt: string;
  contactName?: string | null;
  summary?: string | null;
  appointmentBooked?: boolean;
  transferred?: boolean;
  voicemailDetected?: boolean;
  isLead?: boolean | null;
  leadScore?: number | null;
  hasRecording?: boolean;
  recordingId?: string | null;
  avatarUrl?: string;
  mockOutcome?: string | null;
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
  { id: "all", label: "All Calls" },
  { id: "leads", label: "Leads" },
  { id: "appointments", label: "Appointments" },
  { id: "messages", label: "Messages" },
  { id: "transferred", label: "Transfers" },
  { id: "voicemails", label: "Voicemails" },
  { id: "no_answer", label: "No Answer" },
];

function mockToRow(m: MockCallRow): CallRow {
  return {
    id: m.id,
    direction: m.direction,
    status: m.status,
    outcome: m.outcome,
    fromE164: m.fromE164,
    toE164: m.toE164,
    durationSeconds: m.durationSeconds,
    startedAt: m.startedAt,
    contactName: m.contactName,
    summary: m.summary,
    appointmentBooked: m.appointmentBooked,
    transferred: m.transferred,
    voicemailDetected: m.voicemailDetected,
    isLead: m.isLead,
    leadScore: m.leadScore,
    hasRecording: m.hasRecording,
    recordingId: m.recordingId,
    avatarUrl: m.avatarUrl,
    mockOutcome: m.outcome,
  };
}

function filterRow(filter: CallListFilter, row: CallRow): boolean {
  const badge = deriveCallOutcomeBadge({
    outcome: row.outcome,
    appointmentBooked: row.appointmentBooked,
    transferred: row.transferred,
    voicemailDetected: row.voicemailDetected,
    isLead: row.isLead,
    leadScore: row.leadScore,
    status: row.status,
    mockOutcome: row.mockOutcome,
  });
  if (filter === "all") return true;
  if (filter === "leads") return badge === "New Lead" || badge === "Lead Captured";
  if (filter === "appointments") return badge === "Appointment Booked";
  if (filter === "messages") return badge === "Message Taken";
  if (filter === "transferred") return badge === "Transferred";
  if (filter === "voicemails") return badge === "Voicemail";
  if (filter === "no_answer") return badge === "No Answer" || badge === "No Action";
  return true;
}

export default function VoiceCallsPage() {
  const [apiRows, setApiRows] = useState<CallRow[]>([]);
  const [apiMetrics, setApiMetrics] = useState<Analytics | null>(null);
  const [filter, setFilter] = useState<CallListFilter>("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const useDemo = apiRows.length === 0;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100", test: "0", filter: "all", dateRange: "7d" });
    fetch(`/api/voice/calls?${params}`)
      .then((r) => r.json())
      .then((j) => {
        setApiRows(j.data || []);
        setApiMetrics(j.analytics || null);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const allRows = useMemo(() => {
    const source = useDemo ? MOCK_CALL_ROWS.map(mockToRow) : apiRows;
    const needle = q.trim().toLowerCase();
    return source.filter((row) => {
      if (!filterRow(filter, row)) return false;
      if (!needle) return true;
      const phone = row.direction === "INBOUND" ? row.fromE164 : row.toE164;
      return (
        row.contactName?.toLowerCase().includes(needle) ||
        phone.includes(needle) ||
        row.summary?.toLowerCase().includes(needle)
      );
    });
  }, [apiRows, useDemo, filter, q]);

  const metrics = useDemo
    ? MOCK_CALLS_METRICS
    : apiMetrics ?? {
        answered: 0,
        leads: 0,
        appointments: 0,
        talkTimeSeconds: 0,
        answeredChangePct: null,
        leadsChangePct: null,
        appointmentsChangePct: null,
        talkTimeChangePct: null,
      };

  const totalPages = Math.max(1, Math.ceil(allRows.length / perPage));
  const pageRows = allRows.slice((page - 1) * perPage, page * perPage);
  const totalCount = useDemo ? 47 : allRows.length;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8">
      <div className="mb-6">
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-[#111827]">Calls</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Track and manage all calls handled by your AI receptionist.
        </p>
      </div>

      <CallsMetrics metrics={metrics} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
          <input
            type="search"
            placeholder="Search calls..."
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-sm shadow-sm placeholder:text-[#9ca3af] focus:border-[#6366f1] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm text-[#374151] shadow-sm"
          >
            <Calendar className="h-4 w-4 text-[#6b7280]" />
            Mar 12 – Mar 18, 2024
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm font-medium text-[#374151] shadow-sm hover:bg-[#f9fafb]"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-6 border-b border-[#e5e7eb]">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setPage(1);
              setFilter(f.id);
            }}
            className={cn(
              "pb-3 text-sm font-medium transition",
              filter === f.id
                ? "border-b-2 border-[#6366f1] text-[#6366f1]"
                : "text-[#6b7280] hover:text-[#374151]",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-sm">
        <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto_auto_minmax(0,2fr)_auto] gap-4 border-b border-[#e5e7eb] bg-[#f9fafb] px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
          <span>Caller</span>
          <span>Call Date & Time</span>
          <span>Duration</span>
          <span>Outcome</span>
          <span>AI Summary</span>
          <span className="w-24 text-right"> </span>
        </div>

        {loading && !useDemo ? (
          <div className="px-5 py-14 text-center text-sm text-[#6b7280]">Loading calls…</div>
        ) : pageRows.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-[#6b7280]">
            No calls match your filters.
          </div>
        ) : (
          pageRows.map((c) => {
            const callerPhone = c.direction === "INBOUND" ? c.fromE164 : c.toE164;
            const callerName = c.contactName?.trim() || "Unknown Caller";
            const dt = fmtCallDateTable(c.startedAt);
            const outcome = deriveCallOutcomeBadge({
              outcome: c.outcome,
              appointmentBooked: c.appointmentBooked,
              transferred: c.transferred,
              voicemailDetected: c.voicemailDetected,
              isLead: c.isLead,
              leadScore: c.leadScore,
              status: c.status,
              mockOutcome: c.mockOutcome,
            });

            return (
              <Link
                key={c.id}
                href={`/voice/calls/${c.id}`}
                className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto_auto_minmax(0,2fr)_auto] items-center gap-4 border-b border-[#f3f4f6] px-5 py-4 transition hover:bg-[#fafafa] last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {c.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.avatarUrl}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full bg-[#f3f4f6] object-cover ring-1 ring-[#e5e7eb]"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-xs font-semibold text-[#6366f1]">
                      {callerName.slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#111827]">{callerName}</p>
                    <p className="truncate text-xs text-[#6b7280]">{fmtCallPhone(callerPhone)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-[#111827]">{dt.date}</p>
                  <p className="text-xs text-[#6b7280]">{dt.time}</p>
                </div>

                <p className="text-sm tabular-nums text-[#374151]">
                  {fmtCallDurationTable(c.durationSeconds)}
                </p>

                <CallOutcomeBadge outcome={outcome} />

                <p className="line-clamp-2 text-sm leading-snug text-[#4b5563]">
                  {c.summary || "No summary yet."}
                </p>

                <div className="flex w-24 items-center justify-end gap-2">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#6366f1]"
                    title="Play recording"
                  >
                    <AudioWaveform className="h-4 w-4" />
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.location.href = `/send/quick?to=${encodeURIComponent(callerPhone)}`;
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#6b7280] hover:text-[#374151]"
                    title="Text caller"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                  <ChevronRight className="h-4 w-4 text-[#9ca3af]" />
                </div>
              </Link>
            );
          })
        )}
      </div>

      <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-[#6b7280]">
          Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, allRows.length)} of{" "}
          {totalCount} calls
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#f3f4f6] disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium",
                page === n
                  ? "bg-[#6366f1] text-white shadow-sm"
                  : "text-[#6b7280] hover:bg-[#f3f4f6]",
              )}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#f3f4f6] disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="text-sm text-[#6b7280]">Rows per page: 10</div>
      </div>
    </div>
  );
}
