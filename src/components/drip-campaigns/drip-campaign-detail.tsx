"use client";

import {
  formatSlickDateTime,
  SlickAudienceHeader,
  SlickStatCard,
} from "@/components/audience/slick-audience-ui";
import { DripStatusToggle } from "@/components/drip-campaigns/drip-ui";
import { MockupDetailTabs } from "@/components/automate/mockup-automate-ui";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  delayLabel,
  dripTriggerLabel,
  type DripCampaignRecord,
  type DripEnrollmentRecord,
} from "@/lib/drip-campaigns/types";
import { formatNumber, formatPercent } from "@/lib/utils";
import { Layers, MessageSquare, Pencil, Reply, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  campaign: DripCampaignRecord;
  recipients: DripEnrollmentRecord[];
  stats: {
    totalTriggered: number;
    messagesSent: number;
    avgOpenRate: number;
    avgReplyRate: number;
  };
  chart: {
    labels: string[];
    sent: number[];
    replies: number[];
  };
};

function enrollmentStatusLabel(status: string, stepIndex: number, totalSteps: number) {
  if (status === "completed") return "Completed";
  if (status === "opted_out") return "Opted Out";
  if (status === "paused") return "Paused";
  return `Message ${Math.min(stepIndex + 1, totalSteps)} of ${totalSteps}`;
}

export function DripCampaignDetail({
  campaign: initial,
  recipients,
  stats,
  chart,
}: Props) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("Overview");
  const totalSteps = campaign.steps.length;

  async function toggleStatus(next: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/drip-campaigns/${campaign.id}`, {
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

  const maxChart = Math.max(1, ...chart.sent, ...chart.replies);

  return (
    <div className="text-[13px]">
      <SlickAudienceHeader
        breadcrumb="Drip Campaigns"
        title={campaign.name}
        description={dripTriggerLabel(campaign.triggerType, campaign.triggerConfig)}
        icon={Layers}
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
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <span className="text-[12px] font-medium text-slate-600">Active</span>
              <DripStatusToggle
                active={campaign.status === "active"}
                disabled={busy}
                onChange={(next) => void toggleStatus(next)}
              />
            </div>
            <Link
              href={`/drip-campaigns/${campaign.id}/edit`}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-900 no-underline hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
              Edit Campaign
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SlickStatCard
          label="Total Triggered"
          value={formatNumber(stats.totalTriggered)}
          icon={Send}
          tone="violet"
        />
        <SlickStatCard
          label="Messages Sent"
          value={formatNumber(stats.messagesSent)}
          icon={MessageSquare}
          tone="green"
        />
        <SlickStatCard
          label="Avg. Open Rate"
          value={formatPercent(stats.avgOpenRate / 100)}
          icon={Layers}
          tone="rose"
        />
        <SlickStatCard
          label="Avg. Reply Rate"
          value={formatPercent(stats.avgReplyRate / 100)}
          icon={Reply}
          tone="violet"
        />
      </div>

      <Card className="mb-6 rounded-xl border-slate-200 p-5 shadow-sm">
        <h2 className="text-[15px] font-semibold text-slate-900">Campaign Activity</h2>
        <div className="mt-4 flex h-40 items-end gap-3">
          {chart.labels.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-28 w-full items-end justify-center gap-1">
                <div
                  className="w-3 rounded-t bg-primary/80"
                  style={{ height: `${((chart.sent[i] || 0) / maxChart) * 100}%` }}
                />
                <div
                  className="w-3 rounded-t bg-sky-300"
                  style={{ height: `${((chart.replies[i] || 0) / maxChart) * 100}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-500">{label}</span>
            </div>
          ))}
          {chart.labels.length === 0 ? (
            <p className="text-slate-500">Activity will appear after the first sends.</p>
          ) : null}
        </div>
        <div className="mt-3 flex gap-4 text-[12px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary" /> Sent
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sky-300" /> Replies
          </span>
        </div>
      </Card>

      <MockupDetailTabs tabs={["Overview", "Recipients", "Sequence"]} active={tab} onChange={setTab} />

      {tab === "Overview" ? (
        <Card className="rounded-xl border-slate-200 p-5 shadow-sm">
          <h2 className="text-[15px] font-semibold text-slate-900">Campaign summary</h2>
          <dl className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Trigger</dt>
              <dd className="font-medium text-slate-900">
                {dripTriggerLabel(campaign.triggerType, campaign.triggerConfig)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Messages in sequence</dt>
              <dd className="font-medium text-slate-900">{totalSteps}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Active enrollments</dt>
              <dd className="font-medium text-slate-900">
                {recipients.filter((r) => r.status === "active").length}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Completed</dt>
              <dd className="font-medium text-slate-900">
                {recipients.filter((r) => r.status === "completed").length}
              </dd>
            </div>
          </dl>
        </Card>
      ) : null}

      {tab === "Recipients" ? (
        <Card className="rounded-xl border-slate-200 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-slate-900">Recipients</h2>
            <input
              className="h-9 w-full max-w-xs rounded-lg border border-slate-200 px-3 text-[13px]"
              placeholder="Search recipients..."
            />
          </div>
          {recipients.length === 0 ? (
            <p className="text-slate-500">No recipients yet. Enrollments appear when the trigger fires.</p>
          ) : (
            <Table className="text-[13px]">
              <THead>
                <TR className="border-slate-200">
                  <TH>Contact</TH>
                  <TH>Status</TH>
                  <TH>Current Step</TH>
                  <TH>Next Message</TH>
                </TR>
              </THead>
              <TBody>
                {recipients.map((row) => (
                  <TR key={row.id} className="border-slate-100">
                    <TD>
                      <p className="font-semibold text-slate-900">{row.contactName}</p>
                      <p className="text-[12px] text-slate-400">{row.contactPhone}</p>
                    </TD>
                    <TD className="capitalize text-slate-600">{row.status.replace("_", " ")}</TD>
                    <TD className="text-slate-600">
                      {enrollmentStatusLabel(row.status, row.currentStepIndex, totalSteps)}
                    </TD>
                    <TD className="whitespace-nowrap text-slate-500">
                      {row.nextRunAt ? formatSlickDateTime(row.nextRunAt) : "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      ) : null}

      {tab === "Sequence" ? (
        <Card className="rounded-xl border-slate-200 p-5 shadow-sm">
          <h2 className="text-[15px] font-semibold text-slate-900">Message sequence</h2>
          <ul className="mt-3 space-y-2">
            {campaign.steps.map((step, index) => (
              <li key={step.id} className="rounded-lg border border-slate-200 px-4 py-3">
                <p className="font-semibold text-slate-900">
                  Message {index + 1} · {delayLabel(step, index)}
                </p>
                <p className="mt-1 text-slate-600">{step.message}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
