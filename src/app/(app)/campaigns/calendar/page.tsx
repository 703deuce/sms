import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/metric";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import { campaignTabs } from "@/lib/campaign-tabs";
import { campaigns } from "@/lib/mock/data";
import type { Campaign } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CalendarDays, List, X } from "lucide-react";
import Link from "next/link";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getCampaignsForDay(year: number, month: number, day: number): Campaign[] {
  return campaigns.filter((c) => {
    if (!c.scheduledAt) return false;
    const d = new Date(c.scheduledAt);
    return (
      d.getUTCFullYear() === year &&
      d.getUTCMonth() === month &&
      d.getUTCDate() === day
    );
  });
}

function formatTime(at: string) {
  return new Date(at).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function chipStyle(status: Campaign["status"]) {
  if (status === "Completed") {
    return { bg: "bg-emerald-100", text: "text-emerald-800", dot: "bg-emerald-500" };
  }
  if (status === "Failed") {
    return { bg: "bg-rose-100", text: "text-rose-800", dot: "bg-rose-500" };
  }
  if (status === "Scheduled") {
    return { bg: "bg-sky-100", text: "text-sky-800", dot: "bg-sky-500" };
  }
  if (status === "Sending") {
    return { bg: "bg-amber-100", text: "text-amber-800", dot: "bg-amber-500" };
  }
  return { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" };
}

export default function CampaignCalendarPage() {
  const year = 2026;
  const month = 6;
  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarCells: Array<number | null> = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const scheduledCampaigns = campaigns
    .filter((c) => c.scheduledAt)
    .sort(
      (a, b) =>
        new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime(),
    );

  const weekStart = 20;
  const weekDays = Array.from({ length: 7 }, (_, i) => weekStart + i);

  return (
    <div className="text-[13px]">
      <SectionHeader
        icon={CalendarDays}
        title="Campaign calendar"
        description="Visual schedule of upcoming and past campaign sends for July 2026."
        actions={
          <Link href="/campaigns/scheduled">
            <Button variant="outline" className="rounded-[10px]">
              <List className="h-4 w-4" />
              Scheduled list
            </Button>
          </Link>
        }
      />

      <Tabs items={campaignTabs} />

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-primary-foreground"
        >
          Month view
        </button>
        <button
          type="button"
          className="rounded-full border border-border bg-card px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground"
        >
          Week view
        </button>
        <button
          type="button"
          className="rounded-full border border-border bg-card px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground"
        >
          Agenda view
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <Card className="rounded-[12px] p-4">
          <h2 className="text-[16px] font-bold text-foreground">{monthLabel}</h2>
          <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-[10px] border border-border bg-border">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="bg-muted/60 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {day}
              </div>
            ))}
            {calendarCells.map((day, idx) => {
              const dayCampaigns = day ? getCampaignsForDay(year, month, day) : [];
              const isToday = day === 27;

              return (
                <div
                  key={idx}
                  className={cn(
                    "min-h-[96px] bg-card p-1.5",
                    day === null && "bg-muted/30",
                    isToday && "ring-2 ring-inset ring-primary",
                  )}
                >
                  {day ? (
                    <>
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold",
                          isToday && "bg-primary text-primary-foreground",
                        )}
                      >
                        {day}
                      </span>
                      <div className="mt-1 space-y-1">
                        {dayCampaigns.map((c) => {
                          const style = chipStyle(c.status);
                          return (
                            <Link
                              key={c.id}
                              href={`/campaigns/${c.id}`}
                              className={cn(
                                "block rounded px-1.5 py-1 text-[10px] font-medium leading-tight transition hover:opacity-80",
                                style.bg,
                                style.text,
                              )}
                            >
                              <span className="flex items-center gap-1 truncate">
                                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", style.dot)} />
                                <span className="truncate">{c.name}</span>
                              </span>
                              <span className="mt-0.5 block text-[9px] opacity-80">
                                {formatTime(c.scheduledAt!)}
                              </span>
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

          <div className="mt-4 flex items-center justify-between gap-3 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12px] text-emerald-800">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Timezone: America/Los_Angeles
            </span>
            <button type="button" className="rounded-md p-1 hover:bg-emerald-100" aria-label="Dismiss">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-[12px] p-4">
            <h2 className="text-[14px] font-bold text-foreground">Week of Jul 20–26</h2>
            <div className="mt-3 space-y-2">
              {weekDays.map((day) => {
                const dayCampaigns = getCampaignsForDay(year, month, day);
                const dateLabel = new Date(year, month, day).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });

                return (
                  <div key={day} className="rounded-[10px] border border-border p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {dateLabel}
                    </p>
                    {dayCampaigns.length === 0 ? (
                      <p className="mt-2 text-[12px] text-muted-foreground">No sends</p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {dayCampaigns.map((c) => {
                          const style = chipStyle(c.status);
                          return (
                            <li key={c.id}>
                              <Link
                                href={`/campaigns/${c.id}`}
                                className={cn(
                                  "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[12px]",
                                  style.bg,
                                  style.text,
                                )}
                              >
                                <span className="truncate font-medium">{c.name}</span>
                                <span className="shrink-0 opacity-80">{formatTime(c.scheduledAt!)}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="rounded-[12px] p-4">
            <h2 className="text-[14px] font-bold text-foreground">Agenda</h2>
            <ul className="mt-3 space-y-2.5">
              {scheduledCampaigns.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/campaigns/${c.id}`}
                    className="flex items-start gap-3 rounded-[10px] border border-border p-3 transition hover:bg-muted/40"
                  >
                    <div className="shrink-0 text-center">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {new Date(c.scheduledAt!).toLocaleDateString(undefined, { weekday: "short" })}
                      </p>
                      <p className="text-[18px] font-bold leading-none">
                        {new Date(c.scheduledAt!).getUTCDate()}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{c.name}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {formatTime(c.scheduledAt!)} · {c.audience}
                      </p>
                    </div>
                    <StatusChip status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/campaigns/scheduled"
              className="mt-3 inline-flex text-[12px] font-semibold text-primary hover:underline"
            >
              View all scheduled campaigns →
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
