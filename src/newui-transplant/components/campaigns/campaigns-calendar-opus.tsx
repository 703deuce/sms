"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  displayCampaignStatus,
  fetchCampaigns,
  normalizeCampaignStatus,
  type CampaignListRow,
} from "@/lib/campaigns/kimi-campaigns-adapter";
import { startFreshComposeDraft } from "@/lib/campaigns/compose-draft";
import { PageHeader, Pill } from "@/newui-transplant/components/app/kit";
import { OpusDataSurface } from "@/newui-transplant/components/appointment-reminders/ar-opus-layout";
import { Button } from "@/newui-transplant/components/ui/button";
import { cn } from "@/lib/utils";

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

function statusTone(status: string): "success" | "neutral" | "warning" | "primary" {
  const s = normalizeCampaignStatus(status);
  if (s === "completed" || s === "sent") return "success";
  if (s === "failed" || s === "canceled" || s === "cancelled") return "warning";
  if (s === "scheduled") return "primary";
  return "neutral";
}

export function CampaignsCalendarOpus() {
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
    <div className="space-y-6">
      <PageHeader
        title="Campaign calendar"
        description="Visual schedule of upcoming and past campaign sends."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                startFreshComposeDraft();
                router.push("/campaigns/new");
              }}
            >
              <Plus className="size-4" />
              Schedule campaign
            </Button>
            <Link
              href="/campaigns/scheduled"
              className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
            >
              Scheduled list
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {(["month", "week", "agenda"] as const).map((mode) => (
          <Button
            key={mode}
            type="button"
            size="sm"
            variant={view === mode ? "default" : "outline"}
            onClick={() => setView(mode)}
            className="capitalize"
          >
            {mode} view
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (view === "week") {
                const next = new Date(cursor);
                next.setDate(cursor.getDate() - 7);
                setCursor(next);
                return;
              }
              setCursor(new Date(year, month - 1, 1));
            }}
          >
            Prev
          </Button>
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {view === "week"
              ? `${weekDays[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekDays[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
              : monthLabel}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (view === "week") {
                const next = new Date(cursor);
                next.setDate(cursor.getDate() + 7);
                setCursor(next);
                return;
              }
              setCursor(new Date(year, month + 1, 1));
            }}
          >
            Next
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading calendar…</p>
      ) : scheduledCampaigns.length === 0 ? (
        <OpusDataSurface className="px-6 py-16 text-center">
          <p className="text-sm font-semibold text-foreground">No scheduled campaigns</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Campaigns with a scheduled send time will appear on the calendar.
          </p>
        </OpusDataSurface>
      ) : view === "month" ? (
        <OpusDataSurface className="overflow-hidden p-0">
          <div className="grid grid-cols-7 gap-px bg-border">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="bg-muted/50 px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground"
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
                  className={cn("min-h-[96px] bg-card p-2", day === null && "bg-muted/30")}
                >
                  {day ? (
                    <>
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                          isToday && "bg-primary text-primary-foreground",
                        )}
                      >
                        {day}
                      </span>
                      <div className="mt-1 space-y-1">
                        {dayCampaigns.map((c) => (
                          <Link
                            key={c.id}
                            href={`/campaigns/${c.id}`}
                            className="block truncate rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted/80"
                          >
                            {c.name}
                          </Link>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </OpusDataSurface>
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
              <OpusDataSurface key={date.toISOString()} className="p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {date.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                {dayCampaigns.length === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">No sends</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {dayCampaigns.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/campaigns/${c.id}`}
                          className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-2 py-1.5 text-sm hover:bg-muted"
                        >
                          <span className="truncate font-medium">{c.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatTime(c.scheduledAt!)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </OpusDataSurface>
            );
          })}
        </div>
      ) : (
        <ul className="space-y-3">
          {scheduledCampaigns.map((c) => (
            <li key={c.id}>
              <Link href={`/campaigns/${c.id}`}>
                <OpusDataSurface className="flex items-start gap-3 p-4 transition hover:bg-muted/30">
                  <div className="shrink-0 text-center">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      {new Date(c.scheduledAt!).toLocaleDateString(undefined, { weekday: "short" })}
                    </p>
                    <p className="text-lg font-bold text-foreground tabular-nums">
                      {new Date(c.scheduledAt!).getDate()}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(c.scheduledAt!)} · {c.audience || "Audience"}
                    </p>
                  </div>
                  <Pill tone={statusTone(c.status)}>{displayCampaignStatus(c.status)}</Pill>
                </OpusDataSurface>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
