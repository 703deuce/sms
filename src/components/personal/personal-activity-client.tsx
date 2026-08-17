"use client";

import type { PersonalActivityRow, PersonalNumberRow } from "@/lib/workspace/personal-data";
import {
  WIREFRAME_ACTIVITY_ROWS,
  WIREFRAME_ANALYTICS_KPIS,
  usePersonalWireframe,
} from "@/lib/workspace/personal-mockup-wireframe";
import { cn, formatPhone } from "@/lib/utils";
import {
  AlertTriangle,
  Ban,
  Calendar,
  ChevronDown,
  Download,
  MoreHorizontal,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  Voicemail,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PersonalMockLineChart } from "./mockup/charts";
import {
  PersonalMockBtn,
  PersonalMockFilterChips,
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

function outcomeTone(outcome: string): "green" | "orange" | "purple" | "red" | "gray" {
  const o = outcome.toLowerCase();
  if (o.includes("answer")) return "green";
  if (o.includes("voice")) return "purple";
  if (o.includes("miss")) return "orange";
  if (o.includes("block") || o.includes("fail")) return "red";
  return "gray";
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

  const displayRows = useMemo(() => {
    if (!useWireframe) return rows;
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
    }));
  }, [rows, useWireframe]);

  const filtered = useMemo(() => {
    return displayRows.filter((r) => {
      if (outcomeFilter === "Answered" && !r.answered) return false;
      if (outcomeFilter === "Missed" && r.answered) return false;
      if (outcomeFilter === "Voicemail" && !r.voicemail) return false;
      if (outcomeFilter === "Blocked" && !r.blocked) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        r.caller.includes(q) ||
        r.calledNumber.includes(q) ||
        (r.forwardDestination?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [displayRows, outcomeFilter, search]);

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
    const failed = rows.filter((r) => r.outcome.toLowerCase().includes("fail") || r.blocked).length;
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

  async function blockCaller(phone: string) {
    await fetch("/api/personal/blocked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, numberId }),
    });
    load();
  }

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
          sub="This period"
          icon={PhoneIncoming}
          trend={useWireframe ? 12 : 12}
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
          sub={useWireframe ? "3.1% of total calls" : totals.total ? `${Math.round((totals.failed / totals.total) * 100)}% of total` : "—"}
          icon={Ban}
          iconClass="bg-[#fef2f2] text-[#dc2626]"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <PersonalMockSection title="Call Volume Trend">
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
                  <option>All</option>
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
                  <option>All</option>
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
            {loading ? (
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
                      {filtered.slice(0, 10).map((r) => {
                        const row = r as PersonalActivityRow & {
                          callerName?: string;
                          calledLabel?: string;
                          routeDevice?: string;
                        };
                        const initials = row.callerName
                          ? row.callerName
                              .split(" ")
                              .map((w) => w[0])
                              .join("")
                              .slice(0, 2)
                          : row.caller.replace(/\D/g, "").slice(-2);
                        return (
                        <tr
                          key={r.id}
                          className={cn(
                            "cursor-pointer transition",
                            selected?.id === r.id ? "bg-[#eff6ff]" : "hover:bg-[#f9fafb]",
                          )}
                          onClick={() => setSelectedId(r.id)}
                        >
                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eff6ff] text-[11px] font-bold text-[#2563eb]">
                                {initials}
                              </span>
                              <div>
                                <p className="font-semibold text-[#111827]">
                                  {row.callerName || formatPhone(r.caller)}
                                </p>
                                <p className="text-[11px] text-[#6b7280]">{formatPhone(r.caller)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-3">
                            <p className="text-[#111827]">{formatPhone(r.calledNumber)}</p>
                            {row.calledLabel ? (
                              <p className="text-[11px] text-[#6b7280]">{row.calledLabel}</p>
                            ) : null}
                          </td>
                          <td className="py-3 pr-3 text-[#6b7280]">
                            <p>{r.forwardDestination || "—"}</p>
                            {row.routeDevice ? (
                              <p className="text-[11px]">({row.routeDevice})</p>
                            ) : null}
                          </td>
                          <td className="py-3 pr-3">
                            <PersonalMockPill tone={outcomeTone(r.outcome)}>
                              {r.outcome}
                            </PersonalMockPill>
                          </td>
                          <td className="py-3 pr-3 text-[#6b7280]">
                            {r.ringDurationSeconds != null
                              ? `${r.ringDurationSeconds}s`
                              : "—"}
                          </td>
                          <td className="py-3 pr-3 text-[#6b7280]">
                            {formatDuration(r.durationSeconds)}
                          </td>
                          <td className="py-3 pr-3 text-[#6b7280]">{r.date} {r.time}</td>
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
                  total={useWireframe ? 1284 : filtered.length}
                  pages={useWireframe ? 13 : Math.max(1, Math.ceil(filtered.length / 10))}
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
                {totals.failed > 0 ? (
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
              <ul className="space-y-2 text-[13px]">
                {filtered.slice(0, 4).map((r) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span>{r.outcome} · {formatPhone(r.caller)}</span>
                    <span className="text-[#9ca3af]">{r.time}</span>
                  </li>
                ))}
              </ul>
              <Link href="/personal/activity" className="mt-3 text-[12px] font-semibold text-[#2563eb]">
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
            <PersonalMockPill tone={outcomeTone(selected.outcome)}>
              {selected.outcome}
            </PersonalMockPill>
            <div className="mt-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eff6ff] text-[18px] font-bold text-[#2563eb]">
                {selected.caller.replace(/\D/g, "").slice(-2)}
              </div>
              <p className="mt-2 font-semibold text-[#111827]">{formatPhone(selected.caller)}</p>
            </div>
            <dl className="mt-4 space-y-2 text-[12px]">
              <div className="flex justify-between">
                <dt className="text-[#6b7280]">Called Number</dt>
                <dd className="font-medium">{formatPhone(selected.calledNumber)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#6b7280]">Duration</dt>
                <dd className="font-medium">{formatDuration(selected.durationSeconds)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#6b7280]">Date</dt>
                <dd className="font-medium">{selected.date} {selected.time}</dd>
              </div>
            </dl>
            <div className="mt-4 space-y-2">
              <p className="text-[12px] font-semibold text-[#111827]">Call Journey</p>
              <ol className="space-y-2 text-[12px] text-[#6b7280]">
                <li>Incoming call received</li>
                {selected.forwardDestination ? (
                  <li>Forwarded to {selected.forwardDestination}</li>
                ) : null}
                <li>Call ended · {formatDuration(selected.durationSeconds)}</li>
              </ol>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <PersonalMockBtn variant="outline" className="w-full text-[12px]">Call Back</PersonalMockBtn>
              {!selected.blocked ? (
                <PersonalMockBtn
                  variant="outline"
                  className="w-full text-[12px] text-[#dc2626]"
                  onClick={() => blockCaller(selected.caller)}
                >
                  Block Caller
                </PersonalMockBtn>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </PersonalMockPage>
  );
}
