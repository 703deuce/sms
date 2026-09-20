"use client";

import { CallOutcomeBadge } from "@/components/calls/call-outcome-badge";
import { CallsMetrics } from "@/components/calls/calls-metrics";
import {
  deriveCallOutcomeBadge,
  filterMatchesOutcome,
  fmtCallDateTable,
  fmtCallDurationTable,
  fmtCallPhone,
  type CallListFilter,
} from "@/lib/voice/calls/display";
import { cn } from "@/lib/utils";
import {
  AudioWaveform,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type DateRangeKey = "today" | "7d" | "30d";

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
  reasonForCall?: string | null;
  appointmentBooked?: boolean;
  transferred?: boolean;
  voicemailDetected?: boolean;
  isLead?: boolean | null;
  leadScore?: number | null;
  hasRecording?: boolean;
  needsAttention?: boolean;
  spamLikely?: boolean;
  solicitor?: boolean;
  v3Outcome?: string | null;
  postCallStatus?: string | null;
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
  { id: "all", label: "All" },
  { id: "attention", label: "Needs attention" },
  { id: "appointments", label: "Appointments" },
  { id: "messages", label: "Messages" },
  { id: "transferred", label: "Transfers" },
  { id: "emergencies", label: "Emergencies" },
  { id: "spam", label: "Spam / solicitors" },
  { id: "leads", label: "Leads" },
  { id: "voicemails", label: "Voicemails" },
  { id: "no_answer", label: "No answer" },
];

const DATE_RANGES: { id: DateRangeKey; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
];

function parseUrlFilter(raw: string | null): CallListFilter {
  const valid = FILTERS.map((f) => f.id);
  if (raw && valid.includes(raw as CallListFilter)) return raw as CallListFilter;
  return "all";
}

function parseDateRange(raw: string | null): DateRangeKey {
  if (raw === "today" || raw === "30d") return raw;
  return "7d";
}

export default function VoiceCallsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [apiRows, setApiRows] = useState<CallRow[]>([]);
  const [apiMetrics, setApiMetrics] = useState<Analytics | null>(null);
  const [filter, setFilter] = useState<CallListFilter>(() =>
    parseUrlFilter(searchParams.get("filter")),
  );
  const [dateRange, setDateRange] = useState<DateRangeKey>(() =>
    parseDateRange(searchParams.get("dateRange")),
  );
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    setFilter(parseUrlFilter(searchParams.get("filter")));
    setDateRange(parseDateRange(searchParams.get("dateRange")));
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: "200",
      filter: filter === "voicemails" || filter === "no_answer" ? "all" : filter,
      dateRange,
    });
    if (q.trim()) params.set("q", q.trim());
    fetch(`/api/voice/calls?${params}`)
      .then((r) => r.json())
      .then((j) => {
        setApiRows(j.data || []);
        setApiMetrics(j.analytics || null);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [filter, dateRange, q]);

  function syncUrl(next: { filter?: CallListFilter; dateRange?: DateRangeKey; q?: string }) {
    const params = new URLSearchParams();
    const f = next.filter ?? filter;
    const d = next.dateRange ?? dateRange;
    const query = next.q ?? q;
    if (f !== "all") params.set("filter", f);
    if (d !== "7d") params.set("dateRange", d);
    if (query.trim()) params.set("q", query.trim());
    const qs = params.toString();
    router.replace(qs ? `/voice/calls?${qs}` : "/voice/calls", { scroll: false });
  }

  const allRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return apiRows.filter((row) => {
      if (!filterMatchesOutcome(filter, row)) return false;
      if (!needle) return true;
      const phone = row.direction === "INBOUND" ? row.fromE164 : row.toE164;
      return (
        row.contactName?.toLowerCase().includes(needle) ||
        phone.includes(needle) ||
        row.summary?.toLowerCase().includes(needle) ||
        row.reasonForCall?.toLowerCase().includes(needle)
      );
    });
  }, [apiRows, filter, q]);

  const metrics =
    apiMetrics ?? {
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
  const totalCount = allRows.length;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8">
      <div className="mb-6">
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-[#111827]">Calls</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          After-hours and receptionist calls with outcomes, summaries, and recordings.
        </p>
      </div>

      <CallsMetrics metrics={metrics} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
          <input
            type="search"
            placeholder="Search calls…"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
              syncUrl({ q: e.target.value });
            }}
            className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-sm shadow-sm placeholder:text-[#9ca3af] focus:border-[#6366f1] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-[#374151]">
          <span className="text-[#6b7280]">Range</span>
          <select
            value={dateRange}
            onChange={(e) => {
              const d = e.target.value as DateRangeKey;
              setPage(1);
              setDateRange(d);
              syncUrl({ dateRange: d });
            }}
            className="h-10 rounded-lg border border-[#e5e7eb] bg-white px-3 shadow-sm"
          >
            {DATE_RANGES.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 border-b border-[#e5e7eb]">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setPage(1);
              setFilter(f.id);
              syncUrl({ filter: f.id });
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
        <div className="hidden gap-4 border-b border-[#e5e7eb] bg-[#f9fafb] px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#6b7280] md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto_minmax(0,1.6fr)_auto]">
          <span>Caller</span>
          <span>Time</span>
          <span>Duration</span>
          <span>Outcome</span>
          <span>Reason / summary</span>
          <span className="w-20 text-right"> </span>
        </div>

        {loading ? (
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
            const outcome = deriveCallOutcomeBadge(c);
            const reasonLine = c.reasonForCall || c.summary || "No summary yet.";
            const processing = c.postCallStatus === "processing";

            return (
              <Link
                key={c.id}
                href={`/voice/calls/${c.id}`}
                className="block border-b border-[#f3f4f6] px-5 py-4 transition hover:bg-[#fafafa] last:border-b-0 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto_minmax(0,1.6fr)_auto] md:items-center md:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-xs font-semibold text-[#6366f1]">
                    {callerName.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#111827]">{callerName}</p>
                    <p className="truncate text-xs text-[#6b7280]">{fmtCallPhone(callerPhone)}</p>
                  </div>
                </div>

                <div className="mt-2 md:mt-0">
                  <p className="text-sm text-[#111827]">{dt.date}</p>
                  <p className="text-xs text-[#6b7280]">{dt.time}</p>
                </div>

                <p className="mt-1 text-sm tabular-nums text-[#374151] md:mt-0">
                  {fmtCallDurationTable(c.durationSeconds)}
                </p>

                <div className="mt-2 md:mt-0">
                  <CallOutcomeBadge outcome={outcome} />
                </div>

                <p className="mt-2 line-clamp-2 text-sm leading-snug text-[#4b5563] md:mt-0">
                  {processing ? "Processing transcript and summary…" : reasonLine}
                </p>

                <div className="mt-3 flex items-center justify-end gap-2 md:mt-0">
                  {c.hasRecording ? (
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#6366f1]"
                      title="Recording available"
                    >
                      <AudioWaveform className="h-4 w-4" />
                    </span>
                  ) : null}
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
      </div>
    </div>
  );
}
