import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import { getActiveWorkspaceId } from "@/lib/auth";
import type { Campaign } from "@/lib/types";
import { loadCampaigns } from "@/lib/workspace-data";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { getCampaignTabs } from "@/lib/campaign-tabs";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getCampaignsForDay(
  campaigns: Campaign[],
  year: number,
  month: number,
  day: number,
): Campaign[] {
  return campaigns.filter((c) => {
    if (!c.scheduledAt) return false;
    const d = new Date(c.scheduledAt);
    return (
      d.getFullYear() === year &&
      d.getMonth() === month &&
      d.getDate() === day
    );
  });
}

function formatTime(at: string) {
  return new Date(at).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAgendaDate(at: string) {
  return new Date(at).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default async function CampaignCalendarPage() {
  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    return (
      <div>
        <PageHeader title="Campaign calendar" description="Visual schedule of campaign sends." />
        <EmptyState title="No workspace selected" description="Select or create a workspace to view the calendar." />
      </div>
    );
  }

  const allCampaigns: Campaign[] = await loadCampaigns(workspaceId);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
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
  while (calendarCells.length % 7 !== 0) {
    calendarCells.push(null);
  }

  const scheduledCampaigns = allCampaigns
    .filter((c) => c.scheduledAt)
    .sort(
      (a, b) =>
        new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime(),
    );

  const weekStart = Math.max(1, today - today % 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => weekStart + i).filter(
    (d) => d <= daysInMonth,
  );
  const tabs = await getCampaignTabs(workspaceId);

  return (
    <div>
      <PageHeader
        title="Campaign calendar"
        description={`Visual schedule of upcoming and past campaign sends for ${monthLabel}.`}
        actions={
          <Link href="/campaigns/scheduled">
            <Button variant="outline">Scheduled list</Button>
          </Link>
        }
      />

      <Tabs items={tabs} />

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Month view
        </span>
        <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          Week view
        </span>
        <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          Agenda view
        </span>
      </div>

      {scheduledCampaigns.length === 0 ? (
        <EmptyState
          title="No scheduled campaigns"
          description="Campaigns with a scheduled send time will appear on the calendar."
          actionLabel="Schedule campaign"
          actionHref="/campaigns/new"
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardTitle>{monthLabel}</CardTitle>
            <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="bg-muted/60 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {day}
                </div>
              ))}
              {calendarCells.map((day, idx) => {
                const dayCampaigns = day ? getCampaignsForDay(allCampaigns, year, month, day) : [];
                const isToday = day === today;

                return (
                  <div
                    key={idx}
                    className={cn(
                      "min-h-[88px] bg-card p-2",
                      day === null && "bg-muted/30",
                      isToday && "ring-2 ring-inset ring-primary/30",
                    )}
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
                              className="block truncate rounded px-1.5 py-0.5 text-[10px] font-medium transition hover:opacity-80"
                              style={{
                                backgroundColor:
                                  c.status === "Completed"
                                    ? "rgb(209 250 229)"
                                    : c.status === "Failed"
                                      ? "rgb(254 226 226)"
                                      : c.status === "Scheduled"
                                        ? "rgb(224 242 254)"
                                        : "rgb(254 243 199)",
                                color:
                                  c.status === "Completed"
                                    ? "rgb(6 78 59)"
                                    : c.status === "Failed"
                                      ? "rgb(127 29 29)"
                                      : c.status === "Scheduled"
                                        ? "rgb(12 74 110)"
                                        : "rgb(120 53 15)",
                              }}
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
          </Card>

          <div className="space-y-6">
            {weekDays.length > 0 ? (
              <Card>
                <CardTitle>
                  Week of{" "}
                  {new Date(year, month, weekDays[0]).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                  –
                  {new Date(year, month, weekDays[weekDays.length - 1]).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </CardTitle>
                <div className="mt-4 space-y-2">
                  {weekDays.map((day) => {
                    const dayCampaigns = getCampaignsForDay(allCampaigns, year, month, day);
                    const dateLabel = new Date(year, month, day).toLocaleDateString(
                      undefined,
                      { weekday: "short", month: "short", day: "numeric" },
                    );

                    return (
                      <div
                        key={day}
                        className="rounded-lg border border-border p-3"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {dateLabel}
                        </p>
                        {dayCampaigns.length === 0 ? (
                          <p className="mt-2 text-xs text-muted-foreground">No sends</p>
                        ) : (
                          <ul className="mt-2 space-y-2">
                            {dayCampaigns.map((c) => (
                              <li key={c.id}>
                                <Link
                                  href={`/campaigns/${c.id}`}
                                  className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-sm hover:bg-muted"
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
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : null}

            <Card>
              <CardTitle>Agenda</CardTitle>
              <ul className="mt-4 space-y-3">
                {scheduledCampaigns.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="flex items-start gap-3 rounded-lg border border-border p-3 transition hover:bg-muted/50"
                    >
                      <div className="shrink-0 text-center">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          {formatAgendaDate(c.scheduledAt!).split(",")[0]}
                        </p>
                        <p className="font-display text-lg font-semibold">
                          {new Date(c.scheduledAt!).getDate()}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(c.scheduledAt!)} · {c.audience}
                        </p>
                      </div>
                      <StatusChip status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
