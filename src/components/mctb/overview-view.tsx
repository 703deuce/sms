"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DashboardNeedsAttentionPanel } from "@/components/mctb/dashboard-needs-attention-panel";
import type { MctbOverviewPayload } from "@/lib/mctb/overview";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading overview">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-border bg-card" />
        ))}
      </div>
      <div className="h-40 rounded-xl border border-border bg-card" />
      <div className="h-56 rounded-xl border border-border bg-card" />
    </div>
  );
}

export function MctbOverviewView() {
  const [data, setData] = useState<MctbOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/mctb/overview", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.data) throw new Error("load failed");
      setData(json.data);
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <OverviewSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <PageHeader title="Overview" />
        <Card className="p-6">
          <p className="text-sm font-medium text-foreground">Overview couldn&apos;t be loaded.</p>
          <p className="mt-1 text-sm text-muted-foreground">Your settings have not been changed.</p>
          <Button type="button" size="sm" className="mt-4" onClick={() => void load()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  const headerActions =
    data.status === "setup_incomplete"
      ? (
          <Link
            href={MCTB_ROUTES.setup}
            className="inline-flex h-9 items-center rounded-[10px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Finish setup
          </Link>
        )
      : data.status === "paused"
        ? (
            <Link
              href={MCTB_ROUTES.setupRecovery}
              className="inline-flex h-9 items-center rounded-[10px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Resume now
            </Link>
          )
        : data.status === "messaging_blocked"
          ? (
              <Link
                href={MCTB_ROUTES.setup}
                className="inline-flex h-9 items-center rounded-[10px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Fix messaging
              </Link>
            )
          : (
              <Link
                href={MCTB_ROUTES.setup}
                className="inline-flex h-9 items-center rounded-[10px] border border-border bg-card px-4 text-[13px] font-medium text-foreground hover:bg-muted"
              >
                Manage setup
              </Link>
            );

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <PageHeader
        title="Overview"
        description="See missed-call recovery activity and anything that needs your attention."
        actions={headerActions}
      />

      {data.status === "active" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" aria-hidden />
          <span>
            <span className="font-medium text-foreground">Active</span> — Missed Call Text Back is
            running.
          </span>
        </p>
      ) : null}

      {data.status === "setup_incomplete" ? (
        <div
          className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            <div>
              <p className="font-semibold text-amber-950">Finish setting up Missed Call Text Back</p>
              <p className="mt-0.5 text-[13px] text-amber-900">
                Forwarding or messaging is not ready, so missed calls may not be recovered yet.
              </p>
            </div>
          </div>
          <Link
            href={MCTB_ROUTES.setup}
            className="inline-flex h-9 shrink-0 items-center rounded-lg bg-amber-900 px-4 text-[13px] font-semibold text-white hover:bg-amber-800"
          >
            Finish setup
          </Link>
        </div>
      ) : null}

      {data.status === "paused" ? (
        <div className="rounded-xl border border-border bg-muted/40 p-4" role="status">
          <p className="font-semibold text-foreground">Missed Call Text Back is paused</p>
          {data.pausedUntil ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Recovery is paused until {new Date(data.pausedUntil).toLocaleString()}.
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Recovery is paused indefinitely.</p>
          )}
        </div>
      ) : null}

      {data.status === "messaging_blocked" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4" role="status">
          <p className="font-semibold text-amber-950">Text-back messages are unavailable</p>
          <p className="mt-1 text-sm text-amber-900">
            Your text-back sender is not ready. Missed calls can still be detected, but recovery
            texts will not be sent.
          </p>
        </div>
      ) : null}

      <DashboardNeedsAttentionPanel />

      {!data.setupComplete ? (
        <Card className="p-6">
          <h2 className="text-base font-semibold text-foreground">Set up Missed Call Text Back</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Choose your business line</li>
            <li>Choose how consent is handled</li>
            <li>Configure your recovery message</li>
            <li>Connect call forwarding</li>
            <li>Run a live test</li>
          </ol>
          <Link
            href={MCTB_ROUTES.setupStart}
            className="mt-4 inline-flex h-9 items-center rounded-[10px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
          >
            Continue setup
          </Link>
        </Card>
      ) : (
        <>
          <section aria-labelledby="mctb-kpi-heading">
            <h2 id="mctb-kpi-heading" className="sr-only">Today&apos;s activity</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Missed calls"
                value={data.kpis.missedCallsToday}
                href={MCTB_ROUTES.missedCalls}
              />
              <KpiCard
                label="Recovery texts sent"
                value={data.kpis.recoveryTextsToday}
                href={MCTB_ROUTES.missedCalls}
              />
              <KpiCard label="Replies" value={data.kpis.repliesToday} href={MCTB_ROUTES.conversations} />
              <KpiCard
                label="Need a reply"
                value={data.kpis.needsReplyCount}
                href={`${MCTB_ROUTES.conversations}?filter=needs_reply`}
                highlight={data.kpis.needsReplyCount > 0}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Today</p>
          </section>

          <section aria-labelledby="recent-missed-heading">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="recent-missed-heading" className="text-base font-semibold text-foreground">
                Recent missed calls
              </h2>
              <Link
                href={MCTB_ROUTES.missedCalls}
                className="text-sm font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            {data.recentMissedCalls.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-sm font-medium text-foreground">No missed calls today</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  When a call is missed, its recovery status will appear here.
                </p>
              </Card>
            ) : (
              <Card className="overflow-hidden p-0">
                <Table>
                  <THead>
                    <TR>
                      <TH scope="col">Caller</TH>
                      <TH scope="col">Missed</TH>
                      <TH scope="col">Recovery</TH>
                      <TH scope="col">Reply</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.recentMissedCalls.map((row) => (
                      <TR key={row.id}>
                        <TD>
                          <Link
                            href={MCTB_ROUTES.missedCallDetail(row.id)}
                            className="font-medium text-primary hover:underline"
                          >
                            {row.callerLabel}
                          </Link>
                        </TD>
                        <TD className="text-muted-foreground">{fmtTime(row.missedAt)}</TD>
                        <TD>{row.recoveryLabel}</TD>
                        <TD>{row.replyLabel}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </Card>
            )}
          </section>

          <section aria-labelledby="recent-conv-heading">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="recent-conv-heading" className="text-base font-semibold text-foreground">
                Recent conversations
              </h2>
              <Link
                href={MCTB_ROUTES.conversations}
                className="text-sm font-medium text-primary hover:underline"
              >
                Open conversations
              </Link>
            </div>
            {data.recentConversations.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                No recent conversations yet.
              </Card>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {data.recentConversations.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`${MCTB_ROUTES.conversations}?conversation=${encodeURIComponent(c.id)}`}
                      className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{c.label}</p>
                        <p className="truncate text-sm text-muted-foreground">{c.preview}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        {c.needsReply ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-600/20">
                            Needs reply
                          </span>
                        ) : c.replied ? (
                          <span>Replied</span>
                        ) : null}
                        <span>{fmtTime(c.updatedAt)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="setup-health-heading">
            <h2 id="setup-health-heading" className="mb-3 text-base font-semibold text-foreground">
              Setup status
            </h2>
            <Card className="divide-y divide-border p-0">
              <SetupRow label="Business line" value={data.setupHealth.businessLine || "Not set"} href={MCTB_ROUTES.setupPhone} />
              <SetupRow label="Forwarding" value={data.setupHealth.forwardingLabel} href={MCTB_ROUTES.setupPhone} />
              <SetupRow label="Consent" value={data.setupHealth.consentLabel} href={MCTB_ROUTES.setupConsent} />
              <SetupRow label="Text-back sender" value={data.setupHealth.senderLabel} href={MCTB_ROUTES.setup} />
              <SetupRow label="Recovery" value={data.setupHealth.recoveryLabel} href={MCTB_ROUTES.setupRecovery} />
              {data.setupHealth.voicemailLabel ? (
                <SetupRow label="Voicemail" value={data.setupHealth.voicemailLabel} href={MCTB_ROUTES.setupVoicemail} />
              ) : null}
            </Card>
          </section>

          <section aria-labelledby="perf-heading" className="text-sm text-muted-foreground">
            <h2 id="perf-heading" className="mb-2 text-base font-semibold text-foreground">
              Recovery performance
            </h2>
            <p>
              Last 7 days — {data.performanceSnapshot.missedCalls} missed calls ·{" "}
              {data.performanceSnapshot.recoveryTexts} recovery texts ·{" "}
              {data.performanceSnapshot.replies} replies · {data.performanceSnapshot.replyRate}%
              reply rate
            </p>
            <Link
              href={MCTB_ROUTES.analytics}
              className="mt-2 inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              View analytics
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </section>
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  href,
  highlight,
}: {
  label: string;
  value: number;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-3 transition hover:border-primary/30",
        highlight && "border-primary/40",
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </Link>
  );
}

function SetupRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Link href={href} className="font-medium text-foreground hover:text-primary hover:underline">
        {value}
      </Link>
    </div>
  );
}
