"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CampaignNavTabs } from "@/components/campaigns/campaign-nav-tabs";
import { StatusChip } from "@/components/ui/status-chip";
import { cn } from "@/lib/utils";
import {
  displayCampaignStatus,
  fetchCampaigns,
  normalizeCampaignStatus,
  type CampaignListRow,
} from "@/lib/campaigns/kimi-campaigns-adapter";
import { startFreshComposeDraft } from "@/lib/campaigns/compose-draft";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type CalendarView = "month" | "week" | "agenda";

function getCampaignsForDay(rows: CampaignListRow[], year: number, month: number, day: number) {
  return rows.filter((c) => {
    if (!c.scheduledAt) return false;
    const d = new Date(c.scheduledAt);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  });
}

function formatTime(at: string) {
  return new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function statusColor(status: string) {
  const s = normalizeCampaignStatus(status);
  if (s === "completed" || s === "sent") return { bg: "rgb(209 250 229)", color: "rgb(6 78 59)" };
  if (s === "failed" || s === "canceled" || s === "cancelled") {
    return { bg: "rgb(254 226 226)", color: "rgb(127 29 29)" };
  }
  if (s === "scheduled") return { bg: "rgb(224 242 254)", color: "rgb(12 74 110)" };
  return { bg: "rgb(254 243 199)", color: "rgb(120 53 15)" };
}

export default function CampaignCalendarPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CampaignListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(() => new Date());

  const reload = useCallback(() => {
    setLoading(true);
    fetchCampaigns({ take: 200 })
      .then((data) => setRows(data.filter((c) => c.scheduledAt)))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load calendar");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const today = new Date();
  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const scheduledCampaigns = useMemo(
    () =>
      [...rows].sort(
        (a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime(),
      ),
    [rows],
  );

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarCells: Array<number | null> = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const weekStart = new Date(cursor);
  weekStart.setDate(cursor.getDate() - cursor.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  return (
    <div className="kimi-surface kimi-campaigns min-h-screen bg-[#f6f7fb]">
      <div className="border-b border-slate-200/80 bg-white px-8 pt-6">
        <CampaignNavTabs />
      </div>

      <div className="px-8 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-bold text-slate-900">Campaign calendar</h1>
            <p className="mt-1 text-[13px] text-slate-500">
              Visual schedule of upcoming and past campaign sends.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                startFreshComposeDraft();
                router.push("/campaigns/new");
              }}
              className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white"
            >
              Schedule campaign
            </button>
            <Link
              href="/campaigns/scheduled"
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-600"
            >
              Scheduled list
            </Link>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(["month", "week", "agenda"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize",
                view === mode ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground",
              )}
            >
              {mode} view
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (view === "week") {
                  const next = new Date(cursor);
                  next.setDate(cursor.getDate() - 7);
                  setCursor(next);
                  return;
                }
                setCursor(new Date(year, month - 1, 1));
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600"
            >
              Prev
            </button>
            <span className="text-[13px] font-semibold text-slate-700">
              {view === "week"
                ? `${weekDays[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekDays[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                : monthLabel}
            </span>
            <button
              type="button"
              onClick={() => {
                if (view === "week") {
                  const next = new Date(cursor);
                  next.setDate(cursor.getDate() + 7);
                  setCursor(next);
                  return;
                }
                setCursor(new Date(year, month + 1, 1));
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600"
            >
              Next
            </button>
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-[13px] text-slate-500">Loading calendar…</p>
        ) : scheduledCampaigns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
            <p className="text-sm font-semibold text-slate-800">No scheduled campaigns</p>
            <p className="mt-1 text-[13px] text-slate-500">
              Campaigns with a scheduled send time will appear on the calendar.
            </p>
          </div>
        ) : view === "month" ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-7 gap-px bg-slate-200">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="bg-slate-50 px-2 py-2 text-center text-xs font-semibold uppercase text-slate-500"
                >
                  {day}
                </div>
              ))}
              {calendarCells.map((day, idx) => {
                const dayCampaigns = day ? getCampaignsForDay(rows, year, month, day) : [];
                const isToday =
                  day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                return (
                  <div
                    key={idx}
                    className={cn("min-h-[96px] bg-white p-2", day === null && "bg-slate-50/80")}
                  >
                    {day ? (
                      <>
                        <span
                          className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                            isToday && "bg-indigo-600 text-white",
                          )}
                        >
                          {day}
                        </span>
                        <div className="mt-1 space-y-1">
                          {dayCampaigns.map((c) => {
                            const colors = statusColor(c.status);
                            return (
                              <Link
                                key={c.id}
                                href={`/campaigns/${c.id}`}
                                className="block truncate rounded px-1.5 py-0.5 text-[10px] font-medium"
                                style={{ backgroundColor: colors.bg, color: colors.color }}
                              >
                                {c.name}
                              </Link>
                            );
                          })}
                        </div>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : view === "week" ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {weekDays.map((date) => {
              const dayCampaigns = getCampaignsForDay(
                rows,
                date.getFullYear(),
                date.getMonth(),
                date.getDate(),
              );
              return (
                <div key={date.toISOString()} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    {date.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  {dayCampaigns.length === 0 ? (
                    <p className="mt-3 text-[12px] text-slate-400">No sends</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {dayCampaigns.map((c) => (
                        <li key={c.id}>
                          <Link
                            href={`/campaigns/${c.id}`}
                            className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-sm hover:bg-slate-100"
                          >
                            <span className="truncate font-medium">{c.name}</span>
                            <span className="shrink-0 text-xs text-slate-500">
                              {formatTime(c.scheduledAt!)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <ul className="space-y-3">
            {scheduledCampaigns.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/campaigns/${c.id}`}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50"
                >
                  <div className="shrink-0 text-center">
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      {new Date(c.scheduledAt!).toLocaleDateString(undefined, { weekday: "short" })}
                    </p>
                    <p className="text-lg font-bold text-slate-900">
                      {new Date(c.scheduledAt!).getDate()}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatTime(c.scheduledAt!)} · {c.audience || "Audience"}
                    </p>
                  </div>
                  <StatusChip status={displayCampaignStatus(c.status)} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
