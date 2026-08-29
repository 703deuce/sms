"use client";

import {
  formatSlickDateTime,
  SlickAudienceHeader,
  SlickStatCard,
} from "@/components/audience/slick-audience-ui";
import { AiReplyStatusToggle } from "@/components/ai-replies/ai-reply-ui";
import { MockupDetailTabs } from "@/components/automate/mockup-automate-ui";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { aiReplyTypeLabel, type AiReplyRecord } from "@/lib/ai-replies/types";
import { formatNumber, formatPercent } from "@/lib/utils";
import { Clock, MessageSquare, Pencil, Sparkles, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  campaign: AiReplyRecord;
  stats: {
    totalReplies: number;
    contactsEngaged: number;
    conversions: number;
    leadsCaptured: number;
    resolutionRate: number;
    handoffs: number;
    deliveryRate?: number;
    deliveredCount?: number;
    failedCount?: number;
  };
  chart: { labels: string[]; values: number[] };
  sentiment: { positive: number; neutral: number; negative: number };
  topQueries: Array<{ topic: string; count: number }>;
  sessions: Array<{
    id: string;
    contactName: string;
    contactPhone: string;
    status: string;
    messageCount: number;
    handedOff: boolean;
    lastMessageAt: string | null;
  }>;
  recentDeliveries?: Array<{ id: string; to: string; status: string; sentAt: string }>;
};

export function AiReplyDetail({ campaign: initial, stats, chart, sentiment, topQueries, sessions, recentDeliveries = [] }: Props) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("Analytics");
  const maxChart = Math.max(1, ...chart.values);

  const responseRate =
    stats.contactsEngaged > 0 ? (stats.totalReplies / stats.contactsEngaged) * 100 : 0;
  const handoffRate =
    stats.contactsEngaged > 0 ? (stats.handoffs / stats.contactsEngaged) * 100 : 0;
  const resolved = stats.contactsEngaged - stats.handoffs;
  const outcomeTotal = Math.max(1, resolved + stats.handoffs);

  async function toggleStatus(next: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/ai-replies/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next ? "active" : "paused" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      setCampaign(json.data);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-[13px]">
      <SlickAudienceHeader
        breadcrumb="AI Agents"
        title={campaign.name}
        description={`${aiReplyTypeLabel(campaign.replyType)} · ${campaign.description || "AI auto-responder"}`}
        icon={Sparkles}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                campaign.status === "active"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {campaign.status === "active" ? "Active" : "Paused"}
            </span>
            <AiReplyStatusToggle
              active={campaign.status === "active"}
              disabled={busy}
              onChange={(n) => void toggleStatus(n)}
            />
            <Link
              href={`/ai-replies/${campaign.id}/edit`}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 font-semibold text-slate-900 no-underline hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" /> Edit Agent
            </Link>
          </div>
        }
      />

      <MockupDetailTabs tabs={["Analytics", "Settings", "Logs"]} active={tab} onChange={setTab} />

      {tab === "Analytics" ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SlickStatCard label="Total Sent" value={formatNumber(stats.totalReplies)} icon={MessageSquare} tone="violet" />
            <SlickStatCard
              label="Delivered"
              value={
                stats.deliveryRate != null && stats.totalReplies > 0
                  ? formatPercent(stats.deliveryRate)
                  : "—"
              }
              icon={TrendingUp}
              tone="green"
            />
            <SlickStatCard label="Human Hand-offs" value={formatNumber(stats.handoffs)} icon={Users} tone="rose" />
            <SlickStatCard label="Failed" value={formatNumber(stats.failedCount ?? 0)} icon={Clock} tone="violet" />
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Card className="rounded-xl border-slate-200 p-5 shadow-sm">
              <h2 className="text-[15px] font-semibold text-slate-900">Message volume</h2>
              <div className="mt-4 flex h-44 items-end gap-2">
                {chart.labels.length ? (
                  chart.labels.map((label, i) => (
                    <div key={label} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-primary/80"
                        style={{
                          height: `${((chart.values[i] || 0) / maxChart) * 100}%`,
                          minHeight: chart.values[i] ? 4 : 0,
                        }}
                      />
                      <span className="text-[10px] text-slate-500">{label}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500">No activity yet.</p>
                )}
              </div>
            </Card>

            <Card className="rounded-xl border-slate-200 p-5 shadow-sm">
              <h2 className="text-[15px] font-semibold text-slate-900">Outcome distribution</h2>
              <div className="mt-6 flex items-center justify-center">
                <div
                  className="relative h-36 w-36 rounded-full"
                  style={{
                    background: `conic-gradient(
                      #14b8a6 0 ${(resolved / outcomeTotal) * 100}%,
                      #fb7185 ${(resolved / outcomeTotal) * 100}% ${((resolved + stats.handoffs) / outcomeTotal) * 100}%,
                      #94a3b8 ${((resolved + stats.handoffs) / outcomeTotal) * 100}% 100%
                    )`,
                  }}
                >
                  <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white text-center">
                    <p className="text-[20px] font-semibold text-slate-900">{formatPercent(stats.resolutionRate / 100)}</p>
                    <p className="text-[11px] text-slate-500">Resolved</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" /> Resolved
                  </span>
                  <span>{formatPercent(stats.resolutionRate / 100)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-400" /> Handed off
                  </span>
                  <span>{formatPercent(handoffRate / 100)}</span>
                </div>
              </div>
            </Card>
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <Card className="rounded-xl border-slate-200 p-5 shadow-sm">
              <h2 className="text-[15px] font-semibold text-slate-900">Top queries</h2>
              <ul className="mt-3 space-y-2">
                {topQueries.length ? (
                  topQueries.map((q) => (
                    <li key={q.topic} className="flex justify-between text-[13px]">
                      <span className="capitalize text-slate-700">{q.topic}</span>
                      <span className="text-slate-500">{q.count}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500">Topics appear as conversations grow.</li>
                )}
              </ul>
            </Card>
            <Card className="rounded-xl border-slate-200 p-5 shadow-sm">
              <h2 className="text-[15px] font-semibold text-slate-900">Sentiment</h2>
              <div className="mt-4 space-y-2 text-[13px]">
                <div className="flex justify-between"><span>Positive</span><span>{sentiment.positive}%</span></div>
                <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${sentiment.positive}%` }} /></div>
                <div className="flex justify-between"><span>Neutral</span><span>{sentiment.neutral}%</span></div>
                <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-slate-400" style={{ width: `${sentiment.neutral}%` }} /></div>
                <div className="flex justify-between"><span>Negative</span><span>{sentiment.negative}%</span></div>
                <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-rose-400" style={{ width: `${sentiment.negative}%` }} /></div>
              </div>
            </Card>
          </div>
        </>
      ) : null}

      {tab === "Settings" ? (
        <Card className="rounded-xl border-slate-200 p-5 shadow-sm">
          <h2 className="text-[15px] font-semibold text-slate-900">Agent instructions</h2>
          <p className="mt-3 whitespace-pre-wrap text-[13px] text-slate-600">{campaign.systemPrompt}</p>
          <Link
            href={`/ai-replies/${campaign.id}/edit`}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white no-underline hover:bg-primary/90"
          >
            Edit settings
          </Link>
        </Card>
      ) : null}

      {tab === "Logs" ? (
        <Card className="rounded-xl border-slate-200 p-5 shadow-sm">
          <h2 className="text-[15px] font-semibold text-slate-900">Recent conversations</h2>
          {sessions.length === 0 ? (
            <p className="mt-3 text-slate-500">No conversations yet.</p>
          ) : (
            <Table className="mt-4 text-[13px]">
              <THead>
                <TR className="border-slate-200">
                  <TH>Contact</TH>
                  <TH>Status</TH>
                  <TH>Messages</TH>
                  <TH>Last activity</TH>
                </TR>
              </THead>
              <TBody>
                {sessions.map((s) => (
                  <TR key={s.id} className="border-slate-100">
                    <TD>
                      <p className="font-semibold text-slate-900">{s.contactName}</p>
                      <p className="text-[12px] text-slate-400">{s.contactPhone}</p>
                    </TD>
                    <TD className="capitalize text-slate-600">{s.status.replace("_", " ")}</TD>
                    <TD>{s.messageCount}</TD>
                    <TD className="text-slate-500">{formatSlickDateTime(s.lastMessageAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
          {recentDeliveries.length ? (
            <>
              <h2 className="mt-8 text-[15px] font-semibold text-slate-900">Delivery log</h2>
              <Table className="mt-4 text-[13px]">
                <THead>
                  <TR className="border-slate-200">
                    <TH>To</TH>
                    <TH>Delivery</TH>
                    <TH>Sent</TH>
                  </TR>
                </THead>
                <TBody>
                  {recentDeliveries.map((row) => (
                    <TR key={row.id} className="border-slate-100">
                      <TD className="font-medium text-slate-900">{row.to}</TD>
                      <TD className="capitalize text-slate-600">{row.status}</TD>
                      <TD className="text-slate-500">{formatSlickDateTime(row.sentAt)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
