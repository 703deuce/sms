"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PhoneMissed } from "lucide-react";
import {
  dayKeyInTimeZone,
  formatEventTime,
} from "@/lib/appointment-reminders/calendar/ar-calendar-layout";
import type { MctbOverviewRecentRecoveryRow } from "@/lib/mctb/overview-types";
import { EmptyState, Pill } from "@/newui-transplant/components/app/kit";
import { OPUS_INSET_LIST } from "@/newui-transplant/components/app/opus-surfaces";
import { cn } from "@/lib/utils";

function groupLabelForDay(dayKey: string, timeZone: string): string {
  const todayKey = dayKeyInTimeZone(new Date(), timeZone);
  if (dayKey === todayKey) return "Today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey === dayKeyInTimeZone(yesterday, timeZone)) return "Yesterday";
  return new Date(`${dayKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  });
}

function recoveryPillTone(row: MctbOverviewRecentRecoveryRow): "success" | "neutral" | "warning" | "primary" {
  const r = row.recoveryLabel.toLowerCase();
  if (r.includes("fail") || r.includes("suppress")) return "warning";
  if (r.includes("deliver") || r.includes("sent") || r.includes("text")) return "primary";
  if (row.replyLabel === "Replied") return "success";
  if (row.footerChips.some((c) => c.toLowerCase().includes("voicemail"))) return "neutral";
  if (row.replyLabel === "Needs reply" || row.recoveryLabel.toLowerCase().includes("attention")) return "warning";
  return "neutral";
}

function lifecycleStatusLabel(row: MctbOverviewRecentRecoveryRow): string {
  if (row.footerChips.some((c) => c.toLowerCase().includes("voicemail"))) return "Voicemail";
  if (row.replyLabel === "Replied") return "Customer responded";
  if (row.replyLabel === "Needs reply") return "Needs attention";
  if (row.recoveryLabel && row.recoveryLabel !== "—") return row.recoveryLabel;
  return row.replyLabel !== "—" ? row.replyLabel : "Missed call";
}

export function MctbOverviewAgendaView({
  rows,
  timeZone,
  selectedId,
}: {
  rows: MctbOverviewRecentRecoveryRow[];
  timeZone: string;
  selectedId?: string | null;
}) {
  const grouped = useMemo(() => {
    const sorted = [...rows].sort(
      (a, b) => new Date(b.missedAt).getTime() - new Date(a.missedAt).getTime(),
    );
    const byDay = new Map<string, MctbOverviewRecentRecoveryRow[]>();
    for (const row of sorted) {
      const key = dayKeyInTimeZone(row.missedAt, timeZone);
      const list = byDay.get(key) || [];
      list.push(row);
      byDay.set(key, list);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, list]) => ({
        key,
        label: groupLabelForDay(key, timeZone),
        list: list.sort(
          (a, b) => new Date(b.missedAt).getTime() - new Date(a.missedAt).getTime(),
        ),
      }));
  }, [rows, timeZone]);

  if (!rows.length) {
    return (
      <EmptyState
        icon={PhoneMissed}
        title="No missed calls yet"
        description="When someone calls and you do not answer, activity will appear here grouped by day."
      />
    );
  }

  return (
    <div className="flex flex-col overflow-visible rounded-lg border bg-background lg:min-h-0 lg:flex-1 lg:overflow-hidden">
      <div className="hidden shrink-0 border-b bg-muted/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[22%_28%_28%_22%] md:gap-2">
        <span>Time</span>
        <span>Caller</span>
        <span>Recovery</span>
        <span>Status</span>
      </div>
      <div className="max-lg:overflow-visible lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
        {grouped.map((group) => (
          <section key={group.key} className="border-b border-border/70 last:border-b-0">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-3 py-2 backdrop-blur-sm">
              <p className="text-xs font-semibold text-foreground">{group.label}</p>
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {group.list.length} event{group.list.length === 1 ? "" : "s"}
              </p>
            </div>
            <ul className={cn(OPUS_INSET_LIST, "mx-0 divide-y divide-border/60")}>
              {group.list.map((row) => {
                const href = `/mctb/missed-calls/${row.id}`;
                const status = lifecycleStatusLabel(row);
                return (
                  <li key={row.id}>
                    <Link
                      href={href}
                      className={cn(
                        "grid w-full gap-2 px-3 py-2.5 text-left transition-colors md:grid-cols-[22%_28%_28%_22%] md:items-start",
                        "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                        row.id === selectedId && "bg-primary/[0.06]",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold tabular-nums text-foreground">
                          {formatEventTime(row.missedAt, timeZone)}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">Missed call</p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium text-foreground">{row.callerLabel}</p>
                        <p className="truncate font-mono text-[11px] tabular-nums text-muted-foreground">
                          {row.callerPhoneLabel}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <Pill tone={recoveryPillTone(row)} className="text-[10px]">
                          {row.recoveryLabel !== "—" ? row.recoveryLabel : "Recorded"}
                        </Pill>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                          {row.summaryText}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-foreground">{status}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {row.replyLabel !== "—" ? row.replyLabel : "—"}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
