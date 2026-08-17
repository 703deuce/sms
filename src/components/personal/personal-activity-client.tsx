"use client";

import type { PersonalActivityRow, PersonalNumberRow } from "@/lib/workspace/personal-data";
import {
  WIREFRAME_ACTIVITY_ROWS,
  WIREFRAME_ANALYTICS_KPIS,
  WIREFRAME_RECENT_CALL_EVENTS,
  WIREFRAME_ROUTING_HEALTH,
  usePersonalWireframe,
} from "@/lib/workspace/personal-mockup-wireframe";
import { cn, formatPhone } from "@/lib/utils";
import {
  AlertTriangle,
  Ban,
  Calendar,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  MoreHorizontal,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  Voicemail,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PersonalMockLineChart } from "./mockup/charts";
import {
  PersonalMockBtn,
  PersonalMockHeader,
  PersonalMockInput,
  PersonalMockKpi,
  PersonalMockPage,
  PersonalMockPagination,
  PersonalMockPill,
  PersonalMockSection,
  PersonalMockSelect,
  pm,
} from "./mockup/primitives";

type ActivityDisplayRow = PersonalActivityRow & {
  callerName?: string;
  calledLabel?: string;
  routeDevice?: string;
  smartRouted?: boolean;
  startedAt?: string;
  connectedAt?: string;
  endedAt?: string;
  callId?: string;
  handlingType?: string;
  callerIdMode?: string;
  screening?: string;
};

function outcomeTone(outcome: string): "green" | "orange" | "purple" | "red" | "gray" | "blue" {
  const o = outcome.toLowerCase();
  if (o.includes("answer")) return "green";
  if (o.includes("voice")) return "purple";
  if (o.includes("miss")) return "orange";
  if (o.includes("block")) return "blue";
  if (o.includes("fail")) return "red";
  return "gray";
}

const ACTIVITY_AVATAR_TONES = [
  "bg-[#eff6ff] text-[#2563eb]",
  "bg-[#f5f3ff] text-[#7c3aed]",
  "bg-[#fff7ed] text-[#ea580c]",
  "bg-[#ecfdf5] text-[#059669]",
  "bg-[#fdf2f8] text-[#db2777]",
  "bg-[#fef3c7] text-[#d97706]",
] as const;

function activityAvatarClass(index: number): string {
  return ACTIVITY_AVATAR_TONES[index % ACTIVITY_AVATAR_TONES.length];
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function callerInitials(row: ActivityDisplayRow): string {
  if (row.callerName && row.callerName.toLowerCase() !== "unknown") {
    const parts = row.callerName.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return row.callerName.slice(0, 2).toUpperCase();
  }
  return row.caller.replace(/\D/g, "").slice(-2);
}

function callerName(row: ActivityDisplayRow): string {
  if (row.callerName && row.callerName.toLowerCase() !== "unknown") return row.callerName;
  return formatPhone(row.caller);
}

export function PersonalActivityClient({
  numbers,
  initialNumberId,
}: {
  numbers: PersonalNumberRow[];
  initialNumberId?: string;
}) {
  const [rows, setRows] = useState<PersonalActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [outcomeFilter, setOutcomeFilter] = useState("All");
  const [handlingFilter, setHandlingFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chartGranularity, setChartGranularity] = useState("Day");
  const numberId = initialNumberId || numbers[0]?.id;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (numberId) params.set("numberId", numberId);
    const res = await fetch(`/api/personal/activity?${params}`);
    const j = await res.json().catch(() => ({}));
    setRows(j.data || []);
    setLoading(false);
  }, [numberId]);

  useEffect(() => {
    load();
  }, [load]);

  const useWireframe = usePersonalWireframe(rows.length);

  useEffect(() => {
    if (useWireframe && !selectedId && WIREFRAME_ACTIVITY_ROWS[0]) {
      setSelectedId(WIREFRAME_ACTIVITY_ROWS[0].id);
    }
  }, [useWireframe, selectedId]);

  const displayRows: ActivityDisplayRow[] = useMemo(() => {
    if (!useWireframe) return rows as ActivityDisplayRow[];
    return WIREFRAME_ACTIVITY_ROWS.map((r) => ({
      id: r.id,
      caller: r.caller,
      calledNumber: r.calledNumber,
      forwardDestination: r.route,
      outcome: r.outcome,
      answered: r.answered,
      voicemail: r.voicemail,
      blocked: r.blocked,
      ringDurationSeconds: r.ringDurationSeconds,
      durationSeconds: r.durationSeconds,
      date: r.date,
      time: r.time,
      callerName: r.callerName,
      calledLabel: r.calledLabel,
      routeDevice: r.routeDevice,
      smartRouted: r.smartRouted,
      startedAt: r.startedAt,
      connectedAt: r.connectedAt,
      endedAt: r.endedAt,
      callId: r.callId,
      handlingType: r.handlingType,
      callerIdMode: r.callerIdMode,
      screening: r.screening,
    }));
  }, [rows, useWireframe]);

  const filtered = useMemo(() => {
    return displayRows.filter((r) => {
      if (outcomeFilter === "Answered" && !r.answered) return false;
      if (outcomeFilter === "Missed" && r.answered) return false;
      if (outcomeFilter === "Voicemail" && !r.voicemail) return false;
      if (outcomeFilter === "Blocked" && !r.blocked) return false;
      if (handlingFilter === "Smart Routed" && !r.smartRouted) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        r.caller.includes(q) ||
        r.calledNumber.includes(q) ||
        (r.forwardDestination?.toLowerCase().includes(q) ?? false) ||
        (r.callerName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [displayRows, outcomeFilter, handlingFilter, search]);

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  const totals = useMemo(() => {
    if (useWireframe) {
      const k = WIREFRAME_ANALYTICS_KPIS;
      return {
        total: k.totalCalls,
        answered: k.answered,
        missed: k.missed,
        voicemails: k.voicemails,
        failed: 40,
      };
    }
    const total = rows.length;
    const answered = rows.filter((r) => r.answered).length;
    const missed = rows.filter((r) => !r.answered && !r.voicemail).length;
    const voicemails = rows.filter((r) => r.voicemail).length;
    const failed = rows.filter(
      (r) => r.outcome.toLowerCase().includes("fail") || r.blocked,
    ).length;
    return { total, answered, missed, voicemails, failed };
  }, [rows, useWireframe]);

  const chartLabels = useMemo(() => {
    if (useWireframe) {
      return ["Apr 28", "May 2", "May 6", "May 10", "May 14", "May 18", "May 22", "May 26"];
    }
    const days = [...new Set(displayRows.map((r) => r.date))].slice(-14);
    return days.length ? days : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  }, [displayRows, useWireframe]);

  const chartSeries = useMemo(() => {
    if (useWireframe) {
      const answered = [12, 18, 22, 28, 35, 42, 38, 45];
      const missed = [4, 6, 5, 8, 7, 9, 6, 8];
      const voicemail = [2, 3, 2, 4, 3, 5, 4, 3];
      return [
        { label: "Answered", color: "#10b981", values: answered },
        { label: "Missed", color: "#f97316", values: missed },
        { label: "Voicemail", color: "#8b5cf6", values: voicemail },
      ];
    }
    const byDay = new Map<string, { answered: number; missed: number; voicemail: number }>();
    for (const r of displayRows) {
      const d = r.date;
      const cur = byDay.get(d) || { answered: 0, missed: 0, voicemail: 0 };
      if (r.answered) cur.answered += 1;
      else if (r.voicemail) cur.voicemail += 1;
      else cur.missed += 1;
      byDay.set(d, cur);
    }
    const days = chartLabels;
    return [
      {
        label: "Answered",
        color: "#10b981",
        values: days.map((d) => byDay.get(d)?.answered ?? 0),
      },
      {
        label: "Missed",
        color: "#f97316",
        values: days.map((d) => byDay.get(d)?.missed ?? 0),
      },
      {
        label: "Voicemail",
        color: "#8b5cf6",
        values: days.map((d) => byDay.get(d)?.voicemail ?? 0),
      },
    ];
  }, [displayRows, chartLabels, useWireframe]);

  const journeySteps = useMemo(() => {
    if (!selected) return [];
    const steps: Array<{ label: string; time?: string; tone: "blue" | "green" | "red" }> = [
      {
        label: "Incoming call received",
        time: selected.startedAt || selected.time,
        tone: "blue",
      },
    ];
    if (selected.forwardDestination) {
      steps.push({
        label: "Forwarding rule matched",
        tone: "blue",
      });
      steps.push({
        label: `Dialing ${selected.forwardDestination.replace(/^Forward to /i, "")}`,
        tone: "blue",
      });
      if (selected.answered) {
        steps.push({ label: "Destination answered", tone: "green" });
      }
    }
    steps.push({
      label: "Call ended",
      time: selected.endedAt || selected.time,
      tone: "red",
    });
    return steps;
  }, [selected]);

  async function blockCaller(phone: string) {
    await fetch("/api/personal/blocked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, numberId }),
    });
    load();
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  const tablePageSize = 8;
  const tableTotal = useWireframe ? WIREFRAME_ANALYTICS_KPIS.totalCalls : filtered.length;
  const tablePages = useWireframe
    ? Math.ceil(tableTotal / tablePageSize)
    : Math.max(1, Math.ceil(filtered.length / 10));

  return (
    <PersonalMockPage>
      <PersonalMockHeader
        title="Call Activity"
        description="See every call, route, outcome, and voicemail event across your numbers."
        actions={
          <>
            <PersonalMockSelect className="w-[140px]">
              <option>All Numbers</option>
              {numbers.map((n) => (
                <option key={n.id} value={n.id}>{formatPhone(n.number)}</option>
              ))}
            </PersonalMockSelect>
            <PersonalMockBtn variant="outline" className="gap-1.5">
              <Calendar className="h-4 w-4" />
              Last 30 Days
              <ChevronDown className="h-3.5 w-3.5" />
            </PersonalMockBtn>
            <PersonalMockBtn variant="outline" className="gap-1.5">
              <Download className="h-4 w-4" />
              Export Activity
            </PersonalMockBtn>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <PersonalMockKpi
          label="Total Calls"
          value={totals.total}
          icon={PhoneIncoming}
          trend={useWireframe ? 12 : undefined}
          trendLabel="vs previous 30 days"
        />
        <PersonalMockKpi
          label="Answered"
          value={totals.answered}
          sub={
            useWireframe
              ? "68.2% of total calls"
              : totals.total
                ? `${Math.round((totals.answered / totals.total) * 100)}% of total`
                : "—"
          }
          icon={Phone}
          iconClass="bg-[#ecfdf5] text-[#059669]"
        />
        <PersonalMockKpi
          label="Missed"
          value={totals.missed}
          sub={
            useWireframe
              ? "19.9% of total calls"
              : totals.total
                ? `${Math.round((totals.missed / totals.total) * 100)}% of total`
                : "—"
          }
          icon={PhoneMissed}
          iconClass="bg-[#fff7ed] text-[#ea580c]"
        />
        <PersonalMockKpi
          label="Voicemails"
          value={totals.voicemails}
          sub={
            useWireframe
              ? "8.7% of total calls"
              : totals.total
                ? `${Math.round((totals.voicemails / totals.total) * 100)}% of total`
                : "—"
          }
          icon={Voicemail}
          iconClass="bg-[#f5f3ff] text-[#7c3aed]"
        />
        <PersonalMockKpi
          label="Failed / Blocked"
          value={totals.failed}
          sub={
            useWireframe
              ? "3.1% of total calls"
              : totals.total
                ? `${Math.round((totals.failed / totals.total) * 100)}% of total`
                : "—"
          }
          icon={Ban}
          iconClass="bg-[#fef2f2] text-[#dc2626]"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <PersonalMockSection
            title="Call Volume Trend"
            action={
              <PersonalMockSelect
                className="h-8 w-[90px] text-[12px]"
                value={chartGranularity}
                onChange={(e) => setChartGranularity(e.target.value)}
              >
                <option>Day</option>
                <option>Week</option>
                <option>Month</option>
              </PersonalMockSelect>
            }
          >
            <PersonalMockLineChart labels={chartLabels} series={chartSeries} height={220} />
          </PersonalMockSection>

          <PersonalMockSection
            title="All Calls"
            action={
              <div className="flex flex-wrap gap-2">
                <PersonalMockInput
                  placeholder="Search by caller, number, or destination"
                  className="w-52"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <PersonalMockSelect
                  value={outcomeFilter}
                  onChange={(e) => setOutcomeFilter(e.target.value)}
                  className="w-[120px]"
                >
                  <option value="All">Outcome</option>
                  <option>Answered</option>
                  <option>Missed</option>
                  <option>Voicemail</option>
                  <option>Blocked</option>
                </PersonalMockSelect>
                <PersonalMockSelect
                  value={handlingFilter}
                  onChange={(e) => setHandlingFilter(e.target.value)}
                  className="w-[130px]"
                >
                  <option value="All">Handling Type</option>
                  <option value="All">Handling Type</option>
                  <option>Forward</option>
                  <option>Voicemail</option>
                  <option>Smart Routed</option>
                </PersonalMockSelect>
                <PersonalMockSelect className="w-[120px]">
                  <option>Newest First</option>
                </PersonalMockSelect>
                <PersonalMockBtn variant="outline" className="h-8 text-[12px]">Filters</PersonalMockBtn>
              </div>
            }
          >
            {loading && !useWireframe ? (
              <p className={pm.muted}>Loading…</p>
            ) : filtered.length === 0 ? (
              <p className={pm.muted}>No call activity yet.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                        <th className="pb-3 pr-3">Caller</th>
                        <th className="pb-3 pr-3">Called Number</th>
                        <th className="pb-3 pr-3">Route / Destination</th>
                        <th className="pb-3 pr-3">Outcome</th>
                        <th className="pb-3 pr-3">Ring Time</th>
                        <th className="pb-3 pr-3">Duration</th>
                        <th className="pb-3 pr-3">Date / Time</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f3f4f6]">
                      {filtered.slice(0, useWireframe ? 8 : 10).map((r, rowIdx) => {
                        const isSelected = selected?.id === r.id;
                        return (
                          <tr
                            key={r.id}
                            className={cn(
                              "cursor-pointer transition",
                              isSelected
                                ? "border-l-4 border-l-[#6366f1] bg-[#eef2ff]"
                                : "border-l-4 border-l-transparent hover:bg-[#f9fafb]",
                            )}
                            onClick={() => setSelectedId(r.id)}
                          >
                            <td className="py-3 pr-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold",
                                    activityAvatarClass(rowIdx),
                                  )}
                                >
                                  {callerInitials(r)}
                                </span>
                                <div>
                                  <p className="font-semibold text-[#111827]">{callerName(r)}</p>
                                  <p className="text-[11px] text-[#6b7280]">{formatPhone(r.caller)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 pr-3">
                              <p className="text-[#111827]">{formatPhone(r.calledNumber)}</p>
                              {r.calledLabel ? (
                                <p className="text-[11px] text-[#6b7280]">{r.calledLabel}</p>
                              ) : null}
                            </td>
                            <td className="py-3 pr-3 text-[#6b7280]">
                              <p>{r.forwardDestination || "—"}</p>
                              {r.routeDevice ? (
                                <p className="text-[11px]">({r.routeDevice})</p>
                              ) : null}
                            </td>
                            <td className="py-3 pr-3">
                              <div className="flex flex-wrap items-center gap-1">
                                <PersonalMockPill tone={outcomeTone(r.outcome)}>
                                  {r.outcome}
                                </PersonalMockPill>
                                {r.smartRouted ? (
                                  <PersonalMockPill tone="blue">Smart Routed</PersonalMockPill>
                                ) : null}
                              </div>
                            </td>
                            <td className="py-3 pr-3 text-[#6b7280]">
                              {r.ringDurationSeconds != null
                                ? formatDuration(r.ringDurationSeconds)
                                : "—"}
                            </td>
                            <td className="py-3 pr-3 text-[#6b7280]">
                              {formatDuration(r.durationSeconds)}
                            </td>
                            <td className="py-3 pr-3 text-[#6b7280]">
                              {r.date} {r.time}
                            </td>
                            <td className="py-3 text-right">
                              <button type="button" className="rounded p-1 hover:bg-[#f3f4f6]">
                                <MoreHorizontal className="h-4 w-4 text-[#9ca3af]" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <PersonalMockPagination
                  showing={
                    useWireframe
                      ? "Showing 1 to 8 of 1,284 calls"
                      : `Showing 1 to ${Math.min(10, filtered.length)} of ${filtered.length} calls`
                  }
                  total={tableTotal}
                  pages={tablePages}
                  pageSizeLabel="10 / page"
                />
              </>
            )}
          </PersonalMockSection>

          <div className="grid gap-4 md:grid-cols-2">
            <PersonalMockSection title="Routing Health">
              <div className="space-y-3 text-[13px]">
                <p className="flex items-center gap-2 font-semibold text-[#059669]">
                  <span className="h-2 w-2 rounded-full bg-[#10b981]" />
                  Good
                </p>
                {useWireframe ? (
                  WIREFRAME_ROUTING_HEALTH.map((alert) => (
                    <div key={alert.id} className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          "flex items-start gap-2",
                          alert.tone === "red" ? "text-[#dc2626]" : "text-[#ea580c]",
                        )}
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        {alert.text}
                      </p>
                      <button
                        type="button"
                        className="shrink-0 text-[12px] font-semibold text-[#6366f1]"
                      >
                        {alert.action}
                      </button>
                    </div>
                  ))
                ) : totals.failed > 0 ? (
                  <p className="flex items-start gap-2 text-[#dc2626]">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {totals.failed} failed or blocked calls need review.
                  </p>
                ) : (
                  <p className={pm.muted}>No routing issues detected this period.</p>
                )}
              </div>
            </PersonalMockSection>
            <PersonalMockSection title="Recent Call Events">
              {useWireframe ? (
                <ul className="space-y-3 text-[13px]">
                  {WIREFRAME_RECENT_CALL_EVENTS.map((e) => (
                    <li key={e.id} className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                          e.icon === "answered" && "bg-[#ecfdf5] text-[#059669]",
                          e.icon === "voicemail" && "bg-[#f5f3ff] text-[#7c3aed]",
                          e.icon === "missed" && "bg-[#fff7ed] text-[#ea580c]",
                        )}
                      >
                        {e.icon === "answered" ? (
                          <Phone className="h-4 w-4" />
                        ) : e.icon === "voicemail" ? (
                          <Voicemail className="h-4 w-4" />
                        ) : (
                          <PhoneOff className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#111827]">{e.text}</p>
                        <p className="text-[12px] text-[#6b7280]">{e.number}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-[#9ca3af]">{e.time}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="space-y-2 text-[13px]">
                  {filtered.slice(0, 4).map((r) => (
                    <li key={r.id} className="flex justify-between gap-2">
                      <span>{r.outcome} · {formatPhone(r.caller)}</span>
                      <span className="text-[#9ca3af]">{r.time}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/personal/activity" className="mt-3 text-[12px] font-semibold text-[#6366f1]">
                View all
              </Link>
            </PersonalMockSection>
          </div>
        </div>

        {selected ? (
          <div className={cn(pm.card, "sticky top-4 p-5")}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-[#111827]">Call Details</h3>
              <button type="button" onClick={() => setSelectedId(null)} className="text-[#9ca3af]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2">
              <PersonalMockPill tone={outcomeTone(selected.outcome)}>{selected.outcome}</PersonalMockPill>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div
                className={cn(
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[18px] font-bold",
                  activityAvatarClass(
                    filtered.findIndex((r) => r.id === selected.id),
                  ),
                )}
              >
                {callerInitials(selected)}
              </div>
              <div>
                <p className="text-[16px] font-semibold text-[#111827]">{callerName(selected)}</p>
                <p className="text-[12px] text-[#6b7280]">{formatPhone(selected.caller)}</p>
              </div>
              <a
                href={`tel:${selected.caller}`}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e7eb] text-[#6366f1]"
              >
                <Phone className="h-4 w-4" />
              </a>
            </div>

            <dl className="mt-4 space-y-2.5 text-[12px]">
              <div>
                <dt className="text-[#6b7280]">Called Transovo Number</dt>
                <dd className="mt-0.5 flex items-center gap-1 font-medium text-[#111827]">
                  {formatPhone(selected.calledNumber)}
                  <button
                    type="button"
                    className="text-[#9ca3af] hover:text-[#6366f1]"
                    onClick={() => copyText(selected.calledNumber)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </dd>
              </div>
              {selected.calledLabel ? (
                <div>
                  <dt className="text-[#6b7280]">Label</dt>
                  <dd className="mt-0.5 font-medium text-[#111827]">{selected.calledLabel}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-[#6b7280]">Started</dt>
                <dd className="font-medium">{selected.startedAt || selected.time}</dd>
              </div>
              {selected.connectedAt ? (
                <div className="flex justify-between">
                  <dt className="text-[#6b7280]">Connected</dt>
                  <dd className="font-medium">{selected.connectedAt}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-[#6b7280]">Ended</dt>
                <dd className="font-medium">{selected.endedAt || selected.time}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#6b7280]">Ring Time</dt>
                <dd className="font-medium">
                  {selected.ringDurationSeconds != null
                    ? formatDuration(selected.ringDurationSeconds)
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#6b7280]">Connected Duration</dt>
                <dd className="font-medium">{formatDuration(selected.durationSeconds)}</dd>
              </div>
              {selected.callId ? (
                <div>
                  <dt className="text-[#6b7280]">Call ID</dt>
                  <dd className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-[#111827]">
                    <span className="truncate">{selected.callId}</span>
                    <button
                      type="button"
                      className="shrink-0 text-[#9ca3af] hover:text-[#6366f1]"
                      onClick={() => copyText(selected.callId || "")}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-4">
              <p className="text-[12px] font-semibold text-[#111827]">Call Journey</p>
              <ol className="mt-3 space-y-3">
                {journeySteps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-[12px]">
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        step.tone === "green" && "bg-[#10b981]",
                        step.tone === "red" && "bg-[#dc2626]",
                        step.tone === "blue" && "bg-[#6366f1]",
                      )}
                    />
                    <div>
                      <p className="font-medium text-[#111827]">{step.label}</p>
                      {step.time ? (
                        <p className="text-[11px] text-[#9ca3af]">{step.time}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <PersonalMockBtn variant="outline" className="w-full gap-1 text-[12px]">
                <Phone className="h-3.5 w-3.5" />
                Call Back
              </PersonalMockBtn>
              {!selected.blocked ? (
                <PersonalMockBtn
                  variant="outline"
                  className="w-full gap-1 text-[12px] text-[#dc2626]"
                  onClick={() => blockCaller(selected.caller)}
                >
                  <Ban className="h-3.5 w-3.5" />
                  Block Caller
                </PersonalMockBtn>
              ) : null}
              {selected.voicemail ? (
                <PersonalMockBtn variant="outline" className="w-full gap-1 text-[12px]">
                  <Voicemail className="h-3.5 w-3.5 text-[#7c3aed]" />
                  View Voicemail
                </PersonalMockBtn>
              ) : null}
              {selected.forwardDestination ? (
                <Link href="/personal/forwarding" className="col-span-2">
                  <PersonalMockBtn variant="outline" className="w-full text-[12px]">
                    View Forwarding Rule
                  </PersonalMockBtn>
                </Link>
              ) : null}
            </div>
            {selected.callId ? (
              <button
                type="button"
                className="mt-3 flex w-full items-center justify-center gap-1 text-[12px] font-semibold text-[#6366f1]"
                onClick={() => copyText(selected.callId || "")}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Call ID
              </button>
            ) : null}

            {(selected.handlingType || selected.forwardDestination) ? (
              <div className="mt-4 rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-3 text-[12px]">
                <p className="font-semibold text-[#111827]">Routing Details</p>
                <dl className="mt-2 space-y-1.5">
                  {selected.handlingType ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#6b7280]">Handling Type</dt>
                      <dd className="font-medium">{selected.handlingType}</dd>
                    </div>
                  ) : null}
                  {selected.callerIdMode ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#6b7280]">Caller ID Mode</dt>
                      <dd className="font-medium">{selected.callerIdMode}</dd>
                    </div>
                  ) : null}
                  {selected.screening ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#6b7280]">Screening</dt>
                      <dd className="font-medium">{selected.screening}</dd>
                    </div>
                  ) : null}
                  {selected.forwardDestination ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#6b7280]">Destination</dt>
                      <dd className="flex items-center gap-1 font-medium">
                        {selected.forwardDestination.replace(/^Forward to /i, "")}
                        <ExternalLink className="h-3 w-3 text-[#9ca3af]" />
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </PersonalMockPage>
  );
}
