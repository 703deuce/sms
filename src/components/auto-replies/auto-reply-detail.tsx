"use client";

import {
  formatSlickDateTime,
  SlickAudienceHeader,
  SlickStatCard,
} from "@/components/audience/slick-audience-ui";
import { AutoReplyStatusToggle } from "@/components/auto-replies/auto-reply-ui";
import { MockupDetailTabs } from "@/components/automate/mockup-automate-ui";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  autoReplyTriggerLabel,
  type AutoReplyRecord,
} from "@/lib/auto-replies/types";
import { deliveryStatusLabel } from "@/lib/automate/delivery-stats";
import { formatNumber, formatPercent } from "@/lib/utils";
import { MessageSquare, MousePointerClick, Pencil, Reply, Send, UserMinus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type RecentSend = {
  id: string;
  to: string;
  contactId: string | null;
  contactName: string;
  status: string;
  sentAt: string;
};

type Props = {
  autoReply: AutoReplyRecord;
  recentSends: RecentSend[];
  delivery?: {
    sent: number;
    delivered: number;
    failed: number;
    pending: number;
    deliveryRate: number;
  };
};

export function AutoReplyDetail({ autoReply: initial, recentSends, delivery }: Props) {
  const router = useRouter();
  const [row, setRow] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("Overview");

  const chartData = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const send of recentSends) {
      const key = new Date(send.sentAt).toLocaleDateString(undefined, { weekday: "short" });
      byDay.set(key, (byDay.get(key) || 0) + 1);
    }
    const labels = [...byDay.keys()].slice(-7);
    const values = labels.map((l) => byDay.get(l) || 0);
    return { labels: labels.length ? labels : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], values: labels.length ? values : [0, 0, 0, 0, 0, 0, 0] };
  }, [recentSends]);

  const maxChart = Math.max(1, ...chartData.values);

  async function toggleStatus(next: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/auto-replies/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next ? "active" : "paused" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      setRow(json.data);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-[13px]">
      <SlickAudienceHeader
        breadcrumb="Auto Replies"
        title={`Auto Reply: ${row.name}`}
        description={autoReplyTriggerLabel(row.triggerType, row.triggerConfig)}
        icon={Reply}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                row.status === "active"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {row.status === "active" ? "Active" : "Paused"}
            </span>
            <AutoReplyStatusToggle
              active={row.status === "active"}
              disabled={busy}
              onChange={(next) => void toggleStatus(next)}
            />
            <Link
              href={`/auto-replies/${row.id}/edit`}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-900 no-underline hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SlickStatCard label="Total Sent" value={formatNumber(row.sendCount)} icon={Send} tone="violet" />
        <SlickStatCard
          label="Delivered"
          value={
            delivery && delivery.sent > 0
              ? formatPercent(delivery.deliveryRate)
              : row.sendCount > 0
                ? "—"
                : "—"
          }
          icon={MessageSquare}
          tone="green"
        />
        <SlickStatCard label="Clicks" value="—" icon={MousePointerClick} tone="rose" />
        <SlickStatCard label="Opt-outs" value="—" icon={UserMinus} tone="violet" />
      </div>

      <Card className="mb-6 rounded-xl border-slate-200 p-5 shadow-sm">
        <h2 className="text-[15px] font-semibold text-slate-900">Sending history</h2>
        <div className="mt-4 flex h-44 items-end gap-2">
          {chartData.labels.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-primary/80 transition-all"
                style={{
                  height: `${((chartData.values[i] || 0) / maxChart) * 100}%`,
                  minHeight: chartData.values[i] ? 4 : 0,
                }}
              />
              <span className="text-[10px] text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </Card>

      <MockupDetailTabs tabs={["Overview", "Settings", "Logs"]} active={tab} onChange={setTab} />

      {tab === "Overview" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card className="rounded-xl border-slate-200 p-5 shadow-sm">
            <h2 className="text-[15px] font-semibold text-slate-900">Recent activity</h2>
            {recentSends.length === 0 ? (
              <p className="mt-4 text-slate-500">
                No sends yet. Messages appear here after this auto reply fires.
              </p>
            ) : (
              <Table className="mt-4 text-[13px]">
                <THead>
                  <TR className="border-slate-200">
                    <TH>Contact</TH>
                    <TH>Status</TH>
                    <TH>Sent</TH>
                  </TR>
                </THead>
                <TBody>
                  {recentSends.slice(0, 10).map((send) => (
                    <TR key={send.id} className="border-slate-100">
                      <TD>
                        {send.contactId ? (
                          <Link
                            href={`/contacts?highlight=${send.contactId}`}
                            className="font-medium text-primary no-underline hover:underline"
                          >
                            {send.contactName}
                          </Link>
                        ) : (
                          <span className="font-medium text-slate-900">{send.contactName}</span>
                        )}
                        <p className="text-[12px] text-slate-400">{send.to}</p>
                      </TD>
                      <TD className="text-slate-600">{deliveryStatusLabel(send.status)}</TD>
                      <TD className="whitespace-nowrap text-slate-500">
                        {formatSlickDateTime(send.sentAt)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>

          <Card className="rounded-xl border-slate-200 p-5 shadow-sm">
            <h2 className="text-[15px] font-semibold text-slate-900">Message</h2>
            <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
              {row.message}
            </p>
          </Card>
        </div>
      ) : null}

      {tab === "Settings" ? (
        <Card className="rounded-xl border-slate-200 p-5 shadow-sm">
          <h2 className="text-[15px] font-semibold text-slate-900">Configuration</h2>
          <dl className="mt-4 space-y-3 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Trigger</dt>
              <dd className="font-medium text-slate-900">
                {autoReplyTriggerLabel(row.triggerType, row.triggerConfig)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Once per contact</dt>
              <dd>{row.rules.oncePerContact ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Quiet hours</dt>
              <dd>{row.rules.respectQuietHours ? "Enabled" : "Disabled"}</dd>
            </div>
          </dl>
          <Link
            href={`/auto-replies/${row.id}/edit`}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white no-underline hover:bg-primary/90"
          >
            Edit settings
          </Link>
        </Card>
      ) : null}

      {tab === "Logs" ? (
        <Card className="rounded-xl border-slate-200 p-5 shadow-sm">
          <h2 className="text-[15px] font-semibold text-slate-900">Delivery logs</h2>
          {recentSends.length === 0 ? (
            <p className="mt-4 text-slate-500">No delivery logs yet.</p>
          ) : (
            <Table className="mt-4 text-[13px]">
              <THead>
                <TR className="border-slate-200">
                  <TH>Timestamp</TH>
                  <TH>Contact</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {recentSends.map((send) => (
                  <TR key={send.id} className="border-slate-100">
                    <TD className="whitespace-nowrap text-slate-500">
                      {formatSlickDateTime(send.sentAt)}
                    </TD>
                    <TD>
                      <p className="font-medium text-slate-900">{send.contactName}</p>
                      <p className="text-[12px] text-slate-400">{send.to}</p>
                    </TD>
                    <TD className="capitalize text-slate-600">{send.status}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      ) : null}
    </div>
  );
}
