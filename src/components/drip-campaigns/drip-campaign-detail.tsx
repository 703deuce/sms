"use client";

import {
  formatSlickDateTime,
  SlickAudienceHeader,
  SlickStatCard,
} from "@/components/audience/slick-audience-ui";
import { DripStatusToggle } from "@/components/drip-campaigns/drip-ui";
import { fetchDripCampaignDetail } from "@/lib/drip-campaigns/drip-campaigns-adapter";
import { MockupDetailTabs } from "@/components/automate/mockup-automate-ui";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  delayLabel,
  dripTriggerLabel,
  type DripCampaignRecord,
  type DripEnrollmentRecord,
} from "@/lib/drip-campaigns/types";
import { dripCampaignEditHref } from "@/lib/drip-campaigns/routes";
import { cn, formatNumber, formatPhone, formatPercent } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  Inbox,
  Layers,
  MessageSquare,
  Pencil,
  Reply,
  Search,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  campaign: DripCampaignRecord;
  recipients: DripEnrollmentRecord[];
  stats: {
    totalTriggered: number;
    totalEnrollments: number;
    activeEnrollments: number;
    completedEnrollments: number;
    messagesSent: number;
    avgOpenRate: number;
    avgReplyRate: number;
    deliveryRate?: number;
    deliveredCount?: number;
    failedCount?: number;
  };
  chart: {
    labels: string[];
    sent: number[];
    replies: number[];
  };
  recentDeliveries?: Array<{ id: string; to: string; status: string; sentAt: string }>;
};

function enrollmentStatusLabel(status: string, stepIndex: number, totalSteps: number) {
  if (status === "completed") return "Completed";
  if (status === "opted_out") return "Opted Out";
  if (status === "paused") return "Paused";
  return `Message ${Math.min(stepIndex + 1, totalSteps)} of ${totalSteps}`;
}

function EnrollmentStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
    completed: "bg-primary/5 text-primary ring-primary/20",
    opted_out: "bg-rose-50 text-rose-700 ring-rose-200/70",
    paused: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  const labels: Record<string, string> = {
    active: "Active",
    completed: "Completed",
    opted_out: "Opted Out",
    paused: "Paused",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 ring-inset",
        styles[status] ?? "bg-slate-100 text-slate-600 ring-slate-200",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "active"
            ? "bg-emerald-500"
            : status === "completed"
              ? "bg-primary"
              : status === "opted_out"
                ? "bg-rose-500"
                : "bg-slate-400",
        )}
      />
      {labels[status] ?? status.replace("_", " ")}
    </span>
  );
}

function DeliveryStatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const failed = normalized.includes("fail") || normalized.includes("error");
  const delivered = normalized.includes("deliver") || normalized.includes("sent");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold capitalize ring-1 ring-inset",
        failed
          ? "bg-rose-50 text-rose-700 ring-rose-200/70"
          : delivered
            ? "bg-emerald-50 text-emerald-700 ring-emerald-200/70"
            : "bg-slate-100 text-slate-600 ring-slate-200",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          failed ? "bg-rose-500" : delivered ? "bg-emerald-500" : "bg-slate-400",
        )}
      />
      {status}
    </span>
  );
}

function initialsOf(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-[15px] font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-[12px] text-slate-500">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function DripCampaignDetail({
  campaign: initial,
  recipients,
  stats,
  chart,
  recentDeliveries = [],
}: Props) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initial);
  const [detailStats, setDetailStats] = useState(stats);
  const [detailRecipients, setDetailRecipients] = useState(recipients);
  const [detailChart, setDetailChart] = useState(chart);
  const [detailDeliveries, setDetailDeliveries] = useState(recentDeliveries);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Overview");
  const [query, setQuery] = useState("");
  const totalSteps = campaign.steps.length;

  const reloadDetail = useCallback(async () => {
    try {
      const data = await fetchDripCampaignDetail(campaign.id);
      setCampaign(data.campaign);
      setDetailStats(data.stats);
      setDetailRecipients(data.recipients);
      setDetailChart(data.chart);
      setDetailDeliveries(data.recentDeliveries || []);
    } catch {
      // Keep SSR seed on transient errors.
    }
  }, [campaign.id]);

  useEffect(() => {
    void reloadDetail();
  }, [reloadDetail]);

  useEffect(() => {
    if (campaign.status !== "active") return;
    const timer = setInterval(() => {
      void reloadDetail();
    }, 15_000);
    return () => clearInterval(timer);
  }, [campaign.status, reloadDetail]);

  async function toggleStatus(next: boolean) {
    setBusy(true);
    setError("");
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
      void reloadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  const maxChart = Math.max(1, ...detailChart.sent, ...detailChart.replies);
  const isActive = campaign.status === "active";

  const filteredRecipients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return detailRecipients;
    return detailRecipients.filter(
      (r) =>
        r.contactName.toLowerCase().includes(q) ||
        r.contactPhone.toLowerCase().includes(q),
    );
  }, [detailRecipients, query]);

  return (
    <div className="text-[13px]">
      {error ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      ) : null}
      <SlickAudienceHeader
        breadcrumb="Drip Campaigns"
        title={campaign.name}
        description={dripTriggerLabel(campaign.triggerType, campaign.triggerConfig)}
        icon={Layers}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={cn(
                "flex h-10 items-center gap-2.5 rounded-lg border bg-white px-3 shadow-sm transition-colors",
                isActive ? "border-emerald-200" : "border-slate-200",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isActive ? "bg-emerald-500" : "bg-slate-400",
                )}
              />
              <span className="text-[12px] font-semibold text-slate-700">
                {isActive ? "Active" : "Paused"}
              </span>
              <DripStatusToggle
                active={isActive}
                disabled={busy}
                onChange={(next) => void toggleStatus(next)}
              />
            </div>
            <Link
              href={dripCampaignEditHref(campaign.id)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-900 no-underline shadow-sm transition hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4 text-slate-500" />
              Edit Campaign
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SlickStatCard
          label="Total Triggered"
          value={formatNumber(detailStats.totalTriggered)}
          icon={Send}
          tone="violet"
        />
        <SlickStatCard
          label="Messages Sent"
          value={formatNumber(detailStats.messagesSent)}
          icon={MessageSquare}
          tone="green"
        />
        <SlickStatCard
          label="Delivered"
          value={
            detailStats.deliveryRate != null && detailStats.messagesSent > 0
              ? formatPercent(detailStats.deliveryRate)
              : "—"
          }
          icon={CheckCircle2}
          tone="green"
        />
        <SlickStatCard
          label="Reply Rate"
          value={
            detailStats.totalEnrollments > 0
              ? formatPercent(detailStats.avgReplyRate)
              : "—"
          }
          icon={Reply}
          tone="violet"
        />
      </div>

      <Card className="mb-6 rounded-xl border-slate-200 p-5 shadow-sm">
        <SectionTitle
          title="Campaign Activity"
          description="Messages sent and replies over time"
          action={
            <div className="flex items-center gap-4 text-[12px] font-medium text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" /> Sent
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-400" /> Replies
              </span>
            </div>
          }
        />
        {detailChart.labels.length === 0 ? (
          <div className="mt-4 flex h-44 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-center">
            <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Inbox className="h-5 w-5" />
            </div>
            <p className="text-[13px] font-medium text-slate-700">No activity yet</p>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Activity will appear here after the first sends.
            </p>
          </div>
        ) : (
          <div className="mt-6 flex h-48 items-end gap-4 border-b border-slate-100 pb-px">
            {detailChart.labels.map((label, i) => (
              <div key={label} className="group flex flex-1 flex-col items-center gap-2">
                <div className="flex h-40 w-full items-end justify-center gap-1.5">
                  <div
                    className="w-3.5 rounded-t-[3px] bg-primary/85 transition-all duration-200 group-hover:bg-primary"
                    style={{
                      height: `${Math.max(((detailChart.sent[i] || 0) / maxChart) * 100, detailChart.sent[i] ? 4 : 0)}%`,
                    }}
                  />
                  <div
                    className="w-3.5 rounded-t-[3px] bg-sky-300 transition-all duration-200 group-hover:bg-sky-400"
                    style={{
                      height: `${Math.max(((detailChart.replies[i] || 0) / maxChart) * 100, detailChart.replies[i] ? 4 : 0)}%`,
                    }}
                  />
                </div>
                <span className="text-[11px] font-medium text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <MockupDetailTabs tabs={["Overview", "Recipients", "Sequence"]} active={tab} onChange={setTab} />

      {tab === "Overview" ? (
        <Card className="rounded-xl border-slate-200 p-5 shadow-sm">
          <SectionTitle title="Campaign summary" />
          <dl className="mt-5 grid gap-x-8 gap-y-5 text-[13px] sm:grid-cols-2">
            <div className="border-l-2 border-primary/30 pl-3">
              <dt className="text-[12px] font-medium text-slate-500">Trigger</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {dripTriggerLabel(campaign.triggerType, campaign.triggerConfig)}
              </dd>
            </div>
            <div className="border-l-2 border-slate-100 pl-3">
              <dt className="text-[12px] font-medium text-slate-500">Messages in sequence</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{totalSteps}</dd>
            </div>
            <div className="border-l-2 border-emerald-200 pl-3">
              <dt className="text-[12px] font-medium text-slate-500">Active enrollments</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {formatNumber(detailStats.activeEnrollments)}
              </dd>
            </div>
            <div className="border-l-2 border-slate-100 pl-3">
              <dt className="text-[12px] font-medium text-slate-500">Completed</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {formatNumber(detailStats.completedEnrollments)}
              </dd>
            </div>
          </dl>
          <div className="mt-7 border-t border-slate-100 pt-5">
            <SectionTitle
              title="Delivery log"
              description="Most recent message deliveries for this campaign"
            />
            {detailDeliveries.length ? (
              <Table className="mt-4 text-[13px]">
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>To</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Sent</TH>
                  </TR>
                </THead>
                <TBody>
                  {detailDeliveries.slice(0, 20).map((row) => (
                    <TR key={row.id}>
                      <TD className="font-medium tabular-nums text-slate-800">
                        {formatPhone(row.to)}
                      </TD>
                      <TD>
                        <DeliveryStatusPill status={row.status} />
                      </TD>
                      <TD className="text-right text-slate-500">
                        {formatSlickDateTime(row.sentAt)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            ) : (
              <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
                <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Send className="h-5 w-5" />
                </div>
                <p className="text-[13px] font-medium text-slate-700">No deliveries yet</p>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  Sent messages will show up here once the campaign starts delivering.
                </p>
              </div>
            )}
          </div>
        </Card>
      ) : null}

      {tab === "Recipients" ? (
        <Card className="rounded-xl border-slate-200 p-5 shadow-sm">
          <SectionTitle
            title="Recipients"
            description={`${formatNumber(detailStats.totalEnrollments)} contact${detailStats.totalEnrollments === 1 ? "" : "s"} enrolled in this campaign`}
            action={
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or phone"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
            }
          />
          {filteredRecipients.length ? (
            <Table className="mt-4 text-[13px]">
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Contact</TH>
                  <TH>Status</TH>
                  <TH>Progress</TH>
                  <TH>Replied</TH>
                  <TH className="text-right">Last sent</TH>
                </TR>
              </THead>
              <TBody>
                {filteredRecipients.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                          {initialsOf(r.contactName)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {r.contactName || "Unknown contact"}
                          </p>
                          <p className="truncate text-[12px] tabular-nums text-slate-500">
                            {formatPhone(r.contactPhone)}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <EnrollmentStatusPill status={r.status} />
                    </TD>
                    <TD className="text-slate-600">
                      {enrollmentStatusLabel(r.status, r.currentStepIndex, totalSteps)}
                    </TD>
                    <TD>
                      {r.replied ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
                          <Reply className="h-3.5 w-3.5" /> Yes
                        </span>
                      ) : (
                        <span className="text-[12px] text-slate-400">—</span>
                      )}
                    </TD>
                    <TD className="text-right text-slate-500">
                      {formatSlickDateTime(r.lastSentAt)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
              <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Inbox className="h-5 w-5" />
              </div>
              <p className="text-[13px] font-medium text-slate-700">
                {query ? "No recipients match your search" : "No recipients yet"}
              </p>
              <p className="mt-0.5 max-w-sm text-[12px] text-slate-500">
                {query
                  ? "Try a different name or phone number."
                  : "Contacts will appear here as soon as the trigger enrolls them."}
              </p>
            </div>
          )}
        </Card>
      ) : null}

      {tab === "Sequence" ? (
        <Card className="rounded-xl border-slate-200 p-5 shadow-sm">
          <SectionTitle
            title="Message sequence"
            description={`${totalSteps} message${totalSteps === 1 ? "" : "s"} sent after the trigger fires`}
          />
          <ol className="mt-6 space-y-0">
            {campaign.steps.map((step, i) => (
              <li key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
                {i < totalSteps - 1 ? (
                  <span className="absolute left-[15px] top-9 h-[calc(100%-36px)] w-px bg-slate-200" />
                ) : null}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[12px] font-bold text-primary ring-4 ring-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      <Clock className="h-3 w-3" />
                      {delayLabel(step, i)}
                    </span>
                    {step.mediaUrls?.length ? (
                      <span className="text-[11px] font-medium text-slate-400">
                        {step.mediaUrls.length} attachment{step.mediaUrls.length === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2.5 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
                    {step.message}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          {totalSteps === 0 ? (
            <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
              <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MessageSquare className="h-5 w-5" />
              </div>
              <p className="text-[13px] font-medium text-slate-700">No messages configured</p>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Edit the campaign to add messages to this sequence.
              </p>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
