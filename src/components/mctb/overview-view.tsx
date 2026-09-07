"use client";

import { Button } from "@/components/ui/button";
import { MctbNeedsAttention, type MctbAttentionItem } from "@/components/mctb/kimi-ui/mctb-needs-attention";
import { MctbStatCards } from "@/components/mctb/kimi-ui/mctb-stat-cards";
import type { MctbOverviewPayload } from "@/lib/mctb/overview";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import {
  AlertTriangle,
  ArrowRight,
  MessageSquare,
  PhoneMissed,
  Send,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MctbPageHeader, MctbPrimaryLink, MctbStatusBadge } from "@/components/mctb/kimi-ui/mctb-premium-patterns";
import "./kimi-ui/reference.css";

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function attentionFromOverview(data: MctbOverviewPayload): MctbAttentionItem[] {
  const items: MctbAttentionItem[] = [];
  if (data.kpis.needsReplyCount > 0) {
    items.push({
      id: "needs-reply",
      title: `${data.kpis.needsReplyCount} conversation${data.kpis.needsReplyCount === 1 ? "" : "s"} need a reply`,
      subtitle: "Customers replied to recovery texts",
      href: `${MCTB_ROUTES.conversations}?filter=needs_reply`,
      kind: "reply",
    });
  }
  if (data.status === "messaging_blocked") {
    items.push({
      id: "messaging-blocked",
      title: "Text-back sender not ready",
      subtitle: "Complete messaging compliance to send recovery texts",
      href: MCTB_ROUTES.setup,
      kind: "other",
    });
  }
  if (data.status === "setup_incomplete") {
    items.push({
      id: "setup-incomplete",
      title: "Finish Missed Call Text Back setup",
      subtitle: "Forwarding or messaging is not ready",
      href: MCTB_ROUTES.setup,
      kind: "other",
    });
  }
  for (const row of data.recentMissedCalls.filter((r) => r.replyLabel === "Needs reply").slice(0, 3)) {
    items.push({
      id: `mc-${row.id}`,
      title: `Reply needed — ${row.callerLabel}`,
      subtitle: row.recoveryLabel,
      href: MCTB_ROUTES.missedCallDetail(row.id),
      kind: "missed_call",
    });
  }
  return items.slice(0, 5);
}

type MctbOverviewViewProps = {
  initialData?: MctbOverviewPayload | null;
};

export function MctbOverviewView({ initialData = null }: MctbOverviewViewProps) {
  const [data, setData] = useState<MctbOverviewPayload | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
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
    if (initialData) {
      setData(initialData);
      setLoading(false);
      setError(false);
      return;
    }
    void load();
  }, [initialData, load]);

  const attentionItems = useMemo(() => (data ? attentionFromOverview(data) : []), [data]);

  if (loading) {
    return (
      <div className="mctb-page">
        <div className="mctb-page-inner animate-pulse space-y-6" aria-busy="true">
          <div className="h-10 w-64 rounded bg-gray-200" />
          <div className="grid grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="ref-card h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mctb-page">
        <div className="mctb-page-inner">
          <div className="ref-card p-8 text-center">
            <p className="font-medium text-gray-900">Overview couldn&apos;t be loaded.</p>
            <Button type="button" size="sm" className="mt-4" onClick={() => void load()}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  const headerCta =
    data.status === "setup_incomplete"
      ? { href: MCTB_ROUTES.setup, label: "Finish setup" }
      : data.status === "paused"
        ? { href: MCTB_ROUTES.setupRecovery, label: "Resume now" }
        : data.status === "messaging_blocked"
          ? { href: MCTB_ROUTES.setup, label: "Fix messaging" }
          : { href: MCTB_ROUTES.setup, label: "Manage setup" };

  return (
    <div className="mctb-page">
      <div className="mctb-page-inner">
        <MctbPageHeader
          title="Overview"
          description="Missed call recovery health — activity, attention, and setup status."
          badge={
            data.status === "active" ? (
              <MctbStatusBadge tone="active" label="Active" />
            ) : data.status === "paused" ? (
              <MctbStatusBadge tone="paused" label="Paused" />
            ) : data.status === "messaging_blocked" ? (
              <MctbStatusBadge tone="attention" label="Needs attention" />
            ) : undefined
          }
          action={<MctbPrimaryLink href={headerCta.href}>{headerCta.label}</MctbPrimaryLink>}
        />

        {data.status === "setup_incomplete" ? (
          <div className="mb-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4" role="status">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            <div>
              <p className="font-semibold text-amber-950">Finish setting up Missed Call Text Back</p>
              <p className="mt-0.5 text-[13px] text-amber-900">Forwarding or messaging is not ready yet.</p>
            </div>
          </div>
        ) : null}

        {data.status === "paused" ? (
          <div className="mb-5 ref-card p-4" role="status">
            <p className="font-semibold text-gray-900">Recovery is paused</p>
            <p className="mt-1 text-[13px] text-gray-500">
              {data.pausedUntil
                ? `Paused until ${new Date(data.pausedUntil).toLocaleString()}.`
                : "Paused until you resume from Recovery controls."}
            </p>
          </div>
        ) : null}

        {!data.setupComplete ? (
          <div className="ref-card mb-5 p-6">
            <h2 className="text-[15px] font-bold text-gray-900">Get started</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-[13px] text-gray-600">
              <li>Connect your business line and forwarding</li>
              <li>Choose consent method</li>
              <li>Configure recovery message</li>
              <li>Run a live test</li>
            </ol>
            <Link
              href={MCTB_ROUTES.setupStart}
              className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
            >
              Continue setup
            </Link>
          </div>
        ) : (
          <>
            <MctbStatCards
              stats={[
                {
                  label: "Missed calls today",
                  value: data.kpis.missedCallsToday,
                  sub: "Today",
                  href: MCTB_ROUTES.missedCalls,
                  icon: PhoneMissed,
                  tint: "purple",
                },
                {
                  label: "Recovery texts sent",
                  value: data.kpis.recoveryTextsToday,
                  sub: "Today",
                  href: MCTB_ROUTES.missedCalls,
                  icon: Send,
                  tint: "blue",
                },
                {
                  label: "Replies",
                  value: data.kpis.repliesToday,
                  sub: "Today",
                  href: MCTB_ROUTES.conversations,
                  icon: MessageSquare,
                  tint: "green",
                },
                {
                  label: "Need a reply",
                  value: data.kpis.needsReplyCount,
                  sub: "Conversations",
                  href: `${MCTB_ROUTES.conversations}?filter=needs_reply`,
                  icon: ShieldCheck,
                  tint: "amber",
                  highlight: data.kpis.needsReplyCount > 0,
                },
              ]}
            />

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="ref-deco-section lg:col-span-2">
                <div className="ref-deco-section-head">
                  <div className="flex w-full items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="ref-deco-section-accent" aria-hidden />
                      <h3 className="text-[15px] font-bold text-gray-900">Recent missed calls</h3>
                    </div>
                    <Link href={MCTB_ROUTES.missedCalls} className="text-[13px] font-semibold text-indigo-600 hover:underline">
                      View all
                    </Link>
                  </div>
                </div>
                <div className="ref-deco-section-body">
                {data.recentMissedCalls.length === 0 ? (
                  <p className="py-8 text-center text-[13px] text-gray-500">No missed calls today.</p>
                ) : (
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-gray-500">
                        <th className="pb-2 font-semibold">Caller</th>
                        <th className="pb-2 font-semibold">Missed</th>
                        <th className="pb-2 font-semibold">Recovery</th>
                        <th className="pb-2 font-semibold">Reply</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentMissedCalls.map((row) => (
                        <tr key={row.id} className="border-b border-gray-50">
                          <td className="py-2.5 font-medium">
                            <Link href={MCTB_ROUTES.missedCallDetail(row.id)} className="text-indigo-600 hover:underline">
                              {row.callerLabel}
                            </Link>
                          </td>
                          <td className="py-2.5 text-gray-500">{fmtTime(row.missedAt)}</td>
                          <td className="py-2.5 text-gray-700">{row.recoveryLabel}</td>
                          <td className="py-2.5 text-gray-700">{row.replyLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                </div>
              </div>

              <MctbNeedsAttention
                items={attentionItems}
                viewAllHref={MCTB_ROUTES.missedCalls + "?status=needs_attention"}
              />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="ref-deco-section ref-deco-section--tint-blue">
                <div className="ref-deco-section-head">
                  <div className="flex w-full items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="ref-deco-section-accent ref-deco-section-accent--blue" aria-hidden />
                      <h3 className="text-[15px] font-bold text-gray-900">Recent conversations</h3>
                    </div>
                    <Link href={MCTB_ROUTES.conversations} className="text-[13px] font-semibold text-indigo-600 hover:underline">
                      Open inbox
                    </Link>
                  </div>
                </div>
                <div className="ref-deco-section-body">
                {data.recentConversations.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-gray-500">No recent conversations.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {data.recentConversations.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`${MCTB_ROUTES.conversations}?conversation=${encodeURIComponent(c.id)}`}
                          className="flex items-center justify-between gap-3 py-3 hover:bg-gray-50/80 px-1 -mx-1 rounded-lg"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-gray-900">{c.label}</p>
                            <p className="truncate text-[12px] text-gray-500">{c.preview}</p>
                          </div>
                          {c.needsReply ? (
                            <span className="ref-pill pill-amber shrink-0">Needs reply</span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                </div>
              </div>

              <div className="ref-deco-section ref-deco-section--tint-purple">
                <div className="ref-deco-section-head">
                  <div className="flex items-center gap-2.5">
                    <span className="ref-deco-section-accent" aria-hidden />
                    <h3 className="text-[15px] font-bold text-gray-900">Setup status</h3>
                  </div>
                </div>
                <div className="ref-deco-section-body">
                <dl className="space-y-2 text-[13px]">
                  {[
                    ["Business line", data.setupHealth.businessLine || "Not set", MCTB_ROUTES.setupPhone],
                    ["Forwarding", data.setupHealth.forwardingLabel, MCTB_ROUTES.setupPhone],
                    ["Consent", data.setupHealth.consentLabel, MCTB_ROUTES.setupConsent],
                    ["Text-back sender", data.setupHealth.senderLabel, MCTB_ROUTES.setup],
                    ["Recovery", data.setupHealth.recoveryLabel, MCTB_ROUTES.setupRecovery],
                  ].map(([label, value, href]) => (
                    <div key={label} className="flex justify-between gap-3 border-b border-gray-50 pb-2">
                      <dt className="text-gray-500">{label}</dt>
                      <dd>
                        <Link href={href} className="font-medium text-gray-900 hover:text-indigo-600 hover:underline">
                          {value}
                        </Link>
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-[12px] text-gray-500">
                  Last 7 days: {data.performanceSnapshot.missedCalls} missed · {data.performanceSnapshot.recoveryTexts} texts ·{" "}
                  {data.performanceSnapshot.replyRate}% reply rate
                </p>
                <Link
                  href={MCTB_ROUTES.analytics}
                  className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-indigo-600 hover:underline"
                >
                  View analytics <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
