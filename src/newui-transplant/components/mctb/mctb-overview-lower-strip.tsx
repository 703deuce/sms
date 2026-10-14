"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, MessageSquare, Voicemail } from "lucide-react";
import type { MctbOverviewPayload, MctbOverviewRecentRecoveryRow } from "@/lib/mctb/overview-types";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { TextLink } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { cn } from "@/lib/utils";

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 3600) return `${Math.max(1, Math.floor(diffSec / 60))}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function StripCard({
  title,
  icon,
  count,
  empty,
  primary,
  secondary,
  href,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  empty: string;
  primary?: string;
  secondary?: string;
  href?: string;
}) {
  const interactive = Boolean(href && primary);
  const body = primary ? (
    <>
      <p className="truncate text-[13px] font-semibold text-foreground">{primary}</p>
      {secondary ? (
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{secondary}</p>
      ) : null}
    </>
  ) : (
    <p className="rounded-lg border border-dashed border-border/70 px-2.5 py-2 text-xs text-muted-foreground">
      {empty}
    </p>
  );

  return (
    <div className="min-w-0 flex-1 lg:border-r lg:border-border/80 lg:pr-3 lg:last:border-r-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="text-muted-foreground/90" aria-hidden>{icon}</span>
          {title}
        </p>
        {count > 0 ? (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-foreground">
            {count}
          </span>
        ) : null}
      </div>
      {interactive ? (
        <Link
          href={href!}
          className="block rounded-lg border border-border/80 bg-muted/15 px-2.5 py-2 transition-colors hover:border-primary/30 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {body}
        </Link>
      ) : (
        <div className="rounded-lg border border-border/80 bg-muted/15 px-2.5 py-2">{body}</div>
      )}
    </div>
  );
}

function voicemailRows(rows: MctbOverviewRecentRecoveryRow[]) {
  return rows.filter((r) => r.footerChips.some((c) => c.toLowerCase().includes("voicemail")));
}

export function MctbOverviewLowerStrip({ data }: { data: MctbOverviewPayload }) {
  const [collapsed, setCollapsed] = useState(false);
  const conversations = data.recentConversations ?? [];
  const voicemails = useMemo(() => voicemailRows(data.recentMissedCalls ?? []), [data.recentMissedCalls]);
  const latestConv = conversations[0];
  const latestVm = voicemails[0];

  const recoveryTrend =
    data.kpis.missedCallsToday > 0
      ? `${data.kpis.recoveryTextsToday} of ${data.kpis.missedCallsToday} missed calls texted today`
      : "No missed calls today";

  return (
    <section
      aria-label="Recent conversations and voicemail"
      className={cn(
        "mt-4 shrink-0 rounded-xl border border-border/80 bg-card/95 shadow-sm backdrop-blur-[2px] transition-[height] duration-200",
        collapsed ? "h-11" : "min-h-[7.5rem] max-h-[11rem] max-lg:max-h-none",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-1.5">
        <p className="text-xs font-semibold text-foreground">Recent conversations &amp; voicemails</p>
        <div className="flex items-center gap-2">
          <TextLink href={MCTB_ROUTES.conversations}>All conversations</TextLink>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7"
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand lower section" : "Collapse lower section"}
          >
            {collapsed ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
          </Button>
        </div>
      </div>

      {collapsed ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 text-[11px] text-muted-foreground">
          <span>
            Conversations{" "}
            <strong className="font-semibold text-foreground">{conversations.length}</strong>
          </span>
          <span>
            Voicemail <strong className="font-semibold text-foreground">{voicemails.length}</strong>
          </span>
          <span className="truncate">
            Today <strong className="font-semibold text-foreground">{recoveryTrend}</strong>
          </span>
        </div>
      ) : (
        <div className="grid min-h-0 gap-3 px-3 py-2.5 md:grid-cols-3">
          <StripCard
            title="Recent conversations"
            icon={<MessageSquare className="size-3.5" />}
            count={conversations.length}
            empty="No recent SMS threads"
            primary={latestConv?.label}
            secondary={
              latestConv
                ? `${latestConv.preview} · ${formatRelative(latestConv.updatedAt)}`
                : undefined
            }
            href={latestConv ? `${MCTB_ROUTES.conversations}/${latestConv.id}` : undefined}
          />
          <StripCard
            title="Voicemail activity"
            icon={<Voicemail className="size-3.5" />}
            count={voicemails.length}
            empty="No recent voicemails"
            primary={latestVm?.callerLabel}
            secondary={latestVm ? latestVm.summaryText : undefined}
            href={latestVm ? `/mctb/missed-calls/${latestVm.id}` : MCTB_ROUTES.voicemail}
          />
          <StripCard
            title="Recovery today"
            icon={<MessageSquare className="size-3.5" />}
            count={data.kpis.repliesToday}
            empty="Quiet day — no recovery traffic yet"
            primary={recoveryTrend}
            secondary={
              data.kpis.repliesToday > 0
                ? `${data.kpis.repliesToday} customer repl${data.kpis.repliesToday === 1 ? "y" : "ies"}`
                : "Open analytics for trends"
            }
            href={MCTB_ROUTES.analytics}
          />
        </div>
      )}
    </section>
  );
}
