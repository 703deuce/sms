"use client";

import {
  formatSlickDateTime,
  SlickAudienceHeader,
  SlickStatCard,
} from "@/components/audience/slick-audience-ui";
import { AutoReplyStatusToggle } from "@/components/auto-replies/auto-reply-ui";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  autoReplyTriggerLabel,
  type AutoReplyRecord,
} from "@/lib/auto-replies/types";
import { formatNumber } from "@/lib/utils";
import { Clock, MessageSquare, Pencil, Reply, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
};

export function AutoReplyDetail({ autoReply: initial, recentSends }: Props) {
  const router = useRouter();
  const [row, setRow] = useState(initial);
  const [busy, setBusy] = useState(false);

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
        title={row.name}
        description={autoReplyTriggerLabel(row.triggerType, row.triggerConfig)}
        icon={Reply}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <span className="text-[12px] font-medium text-slate-600">Active</span>
              <AutoReplyStatusToggle
                active={row.status === "active"}
                disabled={busy}
                onChange={(next) => void toggleStatus(next)}
              />
            </div>
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

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SlickStatCard label="Total sent" value={formatNumber(row.sendCount)} icon={Send} tone="violet" />
        <SlickStatCard
          label="Last triggered"
          value={
            row.lastTriggeredAt
              ? formatSlickDateTime(row.lastTriggeredAt).split("@")[0].trim()
              : "—"
          }
          icon={Clock}
          tone="green"
        />
        <SlickStatCard
          label="Status"
          value={row.status === "active" ? "Active" : "Paused"}
          icon={MessageSquare}
          tone="rose"
        />
      </div>

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
                {recentSends.map((send) => (
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
                    <TD className="capitalize text-slate-600">{send.status}</TD>
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
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
              Rules
            </h3>
            <ul className="mt-2 space-y-1 text-[13px] text-slate-600">
              <li>{row.rules.oncePerContact ? "Once per contact" : "May repeat per contact"}</li>
              <li>
                {row.rules.excludeUnsubscribed
                  ? "Skips unsubscribed contacts"
                  : "Includes unsubscribed contacts"}
              </li>
              <li>
                {row.rules.respectQuietHours ? "Respects quiet hours" : "Ignores quiet hours"}
              </li>
            </ul>
          </div>
          <div className="mt-4">
            <Link
              href={`/auto-replies/${row.id}/edit`}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground no-underline hover:bg-muted"
            >
              Edit auto reply
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
