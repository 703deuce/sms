"use client";

import Link from "next/link";
import { Phone } from "lucide-react";
import { Initials, Panel, Pill, TextLink } from "@/newui-transplant/components/app/kit";
import { buttonVariants } from "@/newui-transplant/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMctbCompactDateTime } from "@/lib/mctb/display-datetime";
import type { MctbOverviewRecentRecoveryRow } from "@/lib/mctb/overview-types";

function formatMissedRelative(iso: string, timeZone?: string | null): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "Just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} hr ago`;
  return formatMctbCompactDateTime(iso, timeZone);
}

function replyPillTone(replyLabel: string): "success" | "neutral" | "warning" {
  if (replyLabel === "Replied") return "success";
  if (replyLabel === "No reply") return "neutral";
  return "warning";
}

export function MctbOverviewRecoverySummaries({
  rows,
  timeZone,
}: {
  rows: MctbOverviewRecentRecoveryRow[];
  timeZone?: string | null;
}) {
  return (
    <Panel
      title="Recent missed calls"
      action={<TextLink href="/mctb/missed-calls">View all</TextLink>}
      bodyClassName="p-0"
    >
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          No missed calls yet. When someone calls and you do not answer, they will appear here with recovery
          status.
        </p>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => {
            const displayName = row.callerName ?? row.callerPhoneLabel;
            const initialsName = row.callerName ?? row.callerPhoneLabel;
            const telHref = row.callerPhoneE164 ? `tel:${row.callerPhoneE164}` : null;
            return (
              <li key={row.id} className="px-5 py-4 hover:bg-muted/30">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <Initials name={initialsName} className="size-9 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                          {row.callerName ? (
                            <p className="font-mono text-xs tabular-nums text-muted-foreground">
                              {row.callerPhoneLabel}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <Pill tone={replyPillTone(row.replyLabel)} dot>
                            {row.replyLabel === "—" ? row.recoveryLabel : row.replyLabel}
                          </Pill>
                          <span className="text-xs text-muted-foreground">{formatMissedRelative(row.missedAt, timeZone)}</span>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{row.summaryText}</p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          {row.footerChips.length > 0 ? row.footerChips.join(" · ") : row.recoveryLabel}
                        </p>
                        <div className="flex shrink-0 items-center gap-2">
                          {telHref ? (
                            <a
                              href={telHref}
                              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 gap-1.5 px-2")}
                            >
                              <Phone className="size-3.5" aria-hidden />
                              Call
                            </a>
                          ) : null}
                          <Link
                            href={`/mctb/missed-calls/${row.id}`}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            View details →
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
