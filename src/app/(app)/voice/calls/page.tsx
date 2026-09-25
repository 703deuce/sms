"use client";

import { CallAttentionBadge } from "@/components/calls/call-attention-badge";
import { CallOutcomeBadge } from "@/components/calls/call-outcome-badge";
import { CallsMetrics } from "@/components/calls/calls-metrics";
import { NeedsAttentionView } from "@/components/voice/needs-attention-view";
import {
  fmtCallDateTable,
  fmtCallDurationTable,
  fmtCallPhone,
  type CallListFilter,
} from "@/lib/voice/calls/display";
import { deriveCallListOutcomeDisplay } from "@/lib/voice/calls/outcome-display";
import {
  MOCK_CALL_ROWS,
  MOCK_CALLS_METRICS,
  type MockCallRow,
} from "@/lib/voice/calls/mock-data";
import { PageHeader } from "@/components/ui/page-header";
import { TransovoOperationalToolbar } from "@/components/transovo/operational-toolbar";
import {
  TransovoPageEmpty,
  TransovoTableBodySkeleton,
} from "@/components/transovo/state-feedback";
import { cn } from "@/lib/utils";
import { AudioWaveform, ChevronLeft, ChevronRight, MessageSquare, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import "@/styles/transovo-voice-calls-workspace.css";

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

type DateRangeKey = "today" | "7d" | "30d";

function filterRow(filter: CallListFilter, row: CallRow): boolean {
  const { primary: badge } = deriveCallListOutcomeDisplay({
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
  if (filter === "messages") return badge === "Message Taken" || badge === "Callback Requested";
  if (filter === "transferred") return badge === "Transferred" || badge === "Transfer Failed";
  if (filter === "voicemails") return badge === "Voicemail";
  if (filter === "no_answer") return badge === "No Answer" || badge === "No Action";
  return true;
}

function parseUrlFilter(raw: string | null): CallListFilter {
  const valid: CallListFilter[] = [
    "all",
    "leads",
    "appointments",
    "messages",
    "transferred",
    "voicemails",
    "no_answer",
  ];
  if (raw && valid.includes(raw as CallListFilter)) return raw as CallListFilter;
  return "all";
}

export default function VoiceCallsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const attentionOpen = searchParams.get("attention") === "open";
  const [apiRows, setApiRows] = useState<CallRow[]>([]);
  const [apiMetrics, setApiMetrics] = useState<Analytics | null>(null);
  const [filter, setFilter] = useState<CallListFilter>(() =>
    parseUrlFilter(searchParams.get("filter")),
  );
  const [dateRange, setDateRange] = useState<DateRangeKey>("7d");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const useDemo = false;

  useEffect(() => {
    setFilter(parseUrlFilter(searchParams.get("filter")));
  }, [searchParams]);

  useEffect(() => {
    if (attentionOpen) return;
    setLoading(true);
    const params = new URLSearchParams({ limit: "100", filter: "all", dateRange });
    fetch(`/api/voice/calls?${params}`)
      .then((r) => r.json())
      .then((j) => {
        setApiRows(j.data || []);
        setApiMetrics(j.analytics || null);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [attentionOpen, dateRange]);

  function setAttentionOpen(open: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (open) params.set("attention", "open");
    else params.delete("attention");
    router.push(`/voice/calls?${params.toString()}`);
  }

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

  const metricsData = useDemo ? MOCK_CALLS_METRICS : apiMetrics;
  const metricsLoading = !useDemo && loading;
  const metricsDegraded = !useDemo && !loading && apiMetrics === null;

  const totalPages = Math.max(1, Math.ceil(allRows.length / perPage));
  const pageRows = allRows.slice((page - 1) * perPage, page * perPage);
  const totalCount = allRows.length;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div
      className="transovo-page-container transovo-page-stack transovo-voice-calls-workspace transovo-voice-calls-bleed"
    >
      <PageHeader
        title="Calls"
        description="Track and manage all calls handled by your AI receptionist."
        className="!mb-0"
      />

      {!attentionOpen ? (
        <CallsMetrics
          metrics={metricsData}
          loading={metricsLoading}
          degraded={metricsDegraded}
        />
      ) : null}

      <div className="transovo-calls-workspace-panel">
      <section className="transovo-operating-region" aria-label="Calls filters and views">
        <TransovoOperationalToolbar>
          {!attentionOpen ? (
            <div className="transovo-operational-toolbar__search">
              <label className="sr-only" htmlFor="voice-calls-search">Search calls</label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--transovo-text-subtle)]"
                aria-hidden
              />
              <input
                id="voice-calls-search"
                type="search"
                placeholder="Search calls…"
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
                className="transovo-input pl-9"
              />
            </div>
          ) : null}
          <div className="transovo-operational-toolbar__controls">
            {!attentionOpen ? (
              <label className="transovo-calls-period inline-flex items-center gap-2">
                <span>Period</span>
                <select
                  value={dateRange}
                  onChange={(e) => {
                    setPage(1);
                    setDateRange(e.target.value as DateRangeKey);
                  }}
                  aria-label="Date range for calls"
                >
                  <option value="today">Today</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                </select>
              </label>
            ) : null}
          </div>
        </TransovoOperationalToolbar>

        <div
          className="transovo-view-tabs"
          role="tablist"
          aria-label="Calls view"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!attentionOpen}
            onClick={() => setAttentionOpen(false)}
            className={cn("transovo-tab-link", !attentionOpen && "transovo-tab-link--active")}
          >
            All calls
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={attentionOpen}
            onClick={() => setAttentionOpen(true)}
            className={cn("transovo-tab-link", attentionOpen && "transovo-tab-link--active")}
          >
            Needs attention
          </button>
        </div>

        {!attentionOpen ? (
          <div className="transovo-filter-chips" role="group" aria-label="Filter by outcome">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setPage(1);
                  setFilter(f.id);
                }}
                className={cn(
                  "transovo-filter-chip",
                  filter === f.id && "transovo-filter-chip--active",
                )}
                aria-pressed={filter === f.id}
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {attentionOpen ? (
        <NeedsAttentionView voiceOnly embedded />
      ) : null}

      {!attentionOpen ? (
      <>
      <div className="transovo-data-table-shell transovo-data-table-scroll border-t-0">
        <div className="transovo-data-table-min">
        <div className="transovo-data-table-head grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto_auto_minmax(0,2fr)_auto]">
          <span>Caller</span>
          <span>Call Date & Time</span>
          <span>Duration</span>
          <span>Outcome</span>
          <span>AI Summary</span>
          <span className="w-24 text-right"> </span>
        </div>

        {loading && !useDemo ? (
          <TransovoTableBodySkeleton rows={8} message="Loading calls…" />
        ) : pageRows.length === 0 ? (
          <TransovoPageEmpty title="No calls match your filters." />
        ) : (
          pageRows.map((c) => {
            const callerPhone = c.direction === "INBOUND" ? c.fromE164 : c.toE164;
            const callerName = c.contactName?.trim() || "Unknown Caller";
            const dt = fmtCallDateTable(c.startedAt);
            const { primary: outcome, attention } = deriveCallListOutcomeDisplay({
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
                className="transovo-calls-table-row grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto_auto_minmax(0,2fr)_auto] items-center transition"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {c.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.avatarUrl}
                      alt=""
                      className="h-6 w-6 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <span className="transovo-calls-initial" aria-hidden>
                      {callerName.slice(0, 1)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="transovo-calls-caller-name truncate">{callerName}</p>
                    <p className="transovo-calls-caller-phone truncate">{fmtCallPhone(callerPhone)}</p>
                  </div>
                </div>

                <div>
                  <p className="transovo-calls-meta-line">{dt.date}</p>
                  <p className="text-[0.6875rem] text-[var(--transovo-calls-meta,#9ca3af)]">{dt.time}</p>
                </div>

                <p className="transovo-calls-meta-line tabular-nums">
                  {fmtCallDurationTable(c.durationSeconds)}
                </p>

                <div className="flex min-w-[7rem] flex-col gap-0.5">
                  <CallOutcomeBadge outcome={outcome} compact />
                  {attention ? (
                    <CallAttentionBadge
                      label={attention}
                      className="transovo-calls-attention-badge !rounded px-1.5 py-px !text-[10px] !ring-0"
                    />
                  ) : null}
                </div>

                <p className="transovo-calls-summary line-clamp-2">
                  {c.summary || "No summary yet."}
                </p>

                <div className="flex w-20 items-center justify-end gap-0.5">
                  <span
                    className="transovo-calls-row-action"
                    title="Play recording"
                    aria-hidden
                  >
                    <AudioWaveform className="h-3.5 w-3.5" />
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.location.href = `/send/quick?to=${encodeURIComponent(callerPhone)}`;
                    }}
                    className="transovo-calls-row-action"
                    aria-label={`Text ${callerName}`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </button>
                  <ChevronRight className="h-3.5 w-3.5 text-[var(--transovo-calls-meta,#9ca3af)]" aria-hidden />
                </div>
              </Link>
            );
          })
        )}
        </div>
      </div>

      <div className="transovo-calls-pagination flex flex-col items-center justify-between gap-2 px-3 py-2 sm:flex-row">
        <p>
          Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, allRows.length)} of{" "}
          {totalCount} calls
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="transovo-calls-row-action disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              className={cn(
                "transovo-calls-page-btn flex items-center justify-center",
                page === n
                  ? "transovo-calls-page-btn--active"
                  : "text-[var(--transovo-calls-muted)] hover:bg-[#f3f4f6]",
              )}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="transovo-calls-row-action disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div>Rows per page: 10</div>
      </div>
      </>
      ) : null}
      </div>
    </div>
  );
}
