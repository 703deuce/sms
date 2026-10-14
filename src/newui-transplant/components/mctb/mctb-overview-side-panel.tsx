"use client";

import Link from "next/link";
import {
  AlertTriangle,
  MessageSquare,
  MessageSquareReply,
  PhoneMissed,
  Send,
  Settings2,
  Sparkles,
} from "lucide-react";
import type { MctbOverviewPayload } from "@/lib/mctb/overview-types";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { KeyValueRow, Pill, TextLink } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { MctbRecoveryPauseOpus } from "@/newui-transplant/components/mctb/mctb-recovery-pause-opus";
import { cn } from "@/lib/utils";

function StatCell({
  label,
  value,
  icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: "neutral" | "warning" | "primary";
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="text-muted-foreground/90" aria-hidden>{icon}</span>
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </>
  );
  const className = cn(
    "rounded-lg border border-border/80 bg-muted/10 px-2.5 py-2 transition-colors",
    tone === "warning" && "border-amber-500/30 bg-amber-500/5",
    tone === "primary" && "border-primary/25 bg-primary/5",
    href && "hover:border-primary/30 hover:bg-muted/25",
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

export function MctbOverviewSidePanel({
  data,
  schedule,
  timezone,
  onScheduleUpdated,
  className,
}: {
  data: MctbOverviewPayload;
  schedule: { paused: boolean; pauseUntil: string | null; pauseKind: "manual" | "timed" | null } | null;
  timezone: string;
  onScheduleUpdated: () => void;
  className?: string;
}) {
  const kpis = data.kpis;
  const needsReply = kpis.needsReplyCount;

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="shrink-0 border-b px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Recovery operations
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{kpis.windowLabel}</p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <StatCell
              label="Missed calls"
              value={kpis.missedCallsToday}
              icon={<PhoneMissed className="size-3.5" />}
              href={MCTB_ROUTES.missedCalls}
            />
            <StatCell
              label="Texts sent"
              value={kpis.recoveryTextsToday}
              icon={<Send className="size-3.5" />}
              tone="primary"
              href={MCTB_ROUTES.missedCalls}
            />
            <StatCell
              label="Replies"
              value={kpis.repliesToday}
              icon={<MessageSquareReply className="size-3.5" />}
              href={MCTB_ROUTES.conversations}
            />
            <StatCell
              label="Needs reply"
              value={needsReply}
              icon={<AlertTriangle className="size-3.5" />}
              tone={needsReply > 0 ? "warning" : "neutral"}
              href="/mctb/conversations?filter=needs_reply"
            />
          </div>
        </div>

        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Needs attention</h2>
            {needsReply > 0 ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-amber-800 dark:text-amber-200">
                {needsReply}
              </span>
            ) : null}
          </div>
          {needsReply > 0 ? (
            <div className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
              <p className="text-sm font-semibold text-foreground">Waiting for your reply</p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {needsReply} conversation{needsReply === 1 ? "" : "s"} need a team response.
              </p>
              <Button
                nativeButton={false}
                size="sm"
                className="mt-2 h-8"
                render={<Link href="/mctb/conversations?filter=needs_reply" />}
              >
                Open conversations
              </Button>
            </div>
          ) : (
            <p className="mt-2 rounded-lg border border-dashed border-border/70 px-2.5 py-2 text-xs text-muted-foreground">
              All caught up — no conversations waiting on your team.
            </p>
          )}
        </div>

        <div className="border-b px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recovery status</h2>
          <div className="mt-2 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Text-back service</span>
              <Pill
                tone={
                  data.status === "active"
                    ? "success"
                    : data.status === "paused"
                      ? "warning"
                      : data.status === "messaging_blocked"
                        ? "danger"
                        : "neutral"
                }
              >
                {data.statusLabel}
              </Pill>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Auto-replies</span>
              <Pill tone="success" dot={false} className="h-auto bg-success/15 ring-0">
                Included
              </Pill>
            </div>
          </div>
          {schedule ? (
            <div className="mt-3">
              <MctbRecoveryPauseOpus
                compact
                paused={schedule.paused}
                pauseUntil={schedule.pauseUntil}
                pauseKind={schedule.pauseKind}
                timezone={timezone}
                onUpdated={onScheduleUpdated}
              />
            </div>
          ) : null}
        </div>

        <div className="border-b px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick actions</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li>
              <TextLink href={MCTB_ROUTES.conversations}>View conversations</TextLink>
            </li>
            <li>
              <TextLink href={MCTB_ROUTES.textBack}>
                <Sparkles className="mr-1 inline size-3.5 align-text-bottom" aria-hidden />
                Manage text back
              </TextLink>
            </li>
            <li>
              <TextLink href={MCTB_ROUTES.phone}>Phone &amp; forwarding</TextLink>
            </li>
          </ul>
        </div>

        <div className="px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Settings2 className="size-3.5" aria-hidden />
            Setup health
          </div>
          <div className="divide-y rounded-lg border border-border/80">
            <KeyValueRow label="Business line" value={data.setupHealth.businessLine || "—"} href={MCTB_ROUTES.phone} />
            <KeyValueRow label="Forwarding" value={data.setupHealth.forwardingLabel} href={MCTB_ROUTES.phone} />
            <KeyValueRow
              label="Consent"
              value={data.setupHealth.consentLabel}
              href={`${MCTB_ROUTES.missedCallRecovery}?tab=consent`}
            />
            <KeyValueRow label="Sender" value={data.setupHealth.senderLabel} href={MCTB_ROUTES.phone} />
            <KeyValueRow
              label="Recovery"
              value={data.setupHealth.recoveryLabel}
              href={MCTB_ROUTES.missedCallRecovery}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
