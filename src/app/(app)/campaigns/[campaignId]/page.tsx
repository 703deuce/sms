import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";
import { auditLogs, campaigns } from "@/lib/mock/data";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  estimateSmsSegments,
} from "@/lib/utils";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  ExternalLink,
  MessageSquare,
  MousePointerClick,
  Reply,
  Send,
  Tag,
  UserMinus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

function formatDateTime(at: string | null) {
  if (!at) return "—";
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildTimeline(campaign: (typeof campaigns)[number]) {
  const events = [
    {
      label: "Campaign created",
      at: campaign.scheduledAt
        ? new Date(new Date(campaign.scheduledAt).getTime() - 86400000 * 2).toISOString()
        : "2026-07-15T14:00:00Z",
      detail: `Created by ${campaign.createdBy}`,
    },
  ];

  if (campaign.scheduledAt) {
    events.push({
      label: "Scheduled for send",
      at: campaign.scheduledAt,
      detail: `Audience: ${campaign.audience}`,
    });
  }

  if (
    campaign.status === "Sending" ||
    campaign.status === "Completed" ||
    campaign.status === "Failed"
  ) {
    events.push({
      label: "Send started",
      at: campaign.scheduledAt ?? "2026-07-26T12:00:00Z",
      detail: `${formatNumber(campaign.sent)} messages queued`,
    });
  }

  if (campaign.status === "Completed") {
    events.push({
      label: "Send completed",
      at: campaign.scheduledAt
        ? new Date(new Date(campaign.scheduledAt).getTime() + 3600000).toISOString()
        : "2026-07-20T11:00:00Z",
      detail: `${formatNumber(campaign.delivered)} delivered · ${formatNumber(campaign.replies)} replies`,
    });
  }

  if (campaign.status === "Failed") {
    events.push({
      label: "Send failed",
      at: campaign.scheduledAt
        ? new Date(new Date(campaign.scheduledAt).getTime() + 1800000).toISOString()
        : "2026-07-22T08:30:00Z",
      detail: `Only ${formatNumber(campaign.delivered)} of ${formatNumber(campaign.sent)} delivered`,
    });
  }

  if (campaign.status === "Draft") {
    events.push({
      label: "Awaiting schedule",
      at: "2026-07-15T14:00:00Z",
      detail: "Complete message and audience before scheduling",
    });
  }

  if (campaign.status === "Scheduled") {
    events.push({
      label: "Queued for delivery",
      at: campaign.scheduledAt ?? "2026-07-28T15:00:00Z",
      detail: "Will send automatically at scheduled time",
    });
  }

  return events;
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const campaign = campaigns.find((c) => c.id === campaignId);

  if (!campaign) {
    notFound();
  }

  const deliveryRate =
    campaign.sent > 0 ? (campaign.delivered / campaign.sent) * 100 : 0;
  const replyRate =
    campaign.delivered > 0 ? (campaign.replies / campaign.delivered) * 100 : 0;
  const clickRate =
    campaign.delivered > 0 ? (campaign.clicks / campaign.delivered) * 100 : 0;
  const optOutRate =
    campaign.delivered > 0 ? (campaign.optOuts / campaign.delivered) * 100 : 0;
  const segments = estimateSmsSegments(campaign.body);
  const timeline = buildTimeline(campaign);
  const activity = auditLogs.filter((log) =>
    log.detail.toLowerCase().includes(campaign.name.toLowerCase()),
  );

  const primaryStats = [
    {
      label: "Sent",
      value: formatNumber(campaign.sent),
      hint: null as string | null,
      icon: Send,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Delivered",
      value: formatNumber(campaign.delivered),
      hint: formatPercent(deliveryRate),
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Replies",
      value: formatNumber(campaign.replies),
      hint: formatPercent(replyRate),
      icon: Reply,
      tone: "bg-sky-50 text-sky-600",
    },
    {
      label: "Clicks",
      value: formatNumber(campaign.clicks),
      hint: formatPercent(clickRate),
      icon: MousePointerClick,
      tone: "bg-violet-50 text-violet-600",
    },
    {
      label: "Opt-outs",
      value: formatNumber(campaign.optOuts),
      hint: formatPercent(optOutRate),
      icon: UserMinus,
      tone: "bg-orange-50 text-orange-600",
    },
    {
      label: "Cost",
      value: formatCurrency(campaign.cost),
      hint: null,
      icon: DollarSign,
      tone: "bg-amber-50 text-amber-600",
    },
  ];

  return (
    <div className="space-y-5 text-[13px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-foreground">
            {campaign.name}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {campaign.type} campaign · {campaign.audience}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            <StatusChip status={campaign.status} />
            <span className="text-[12px] text-muted-foreground">
              Created by {campaign.createdBy}
            </span>
            {campaign.scheduledAt ? (
              <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {formatDateTime(campaign.scheduledAt)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/campaigns">
            <Button variant="outline" className="rounded-[10px]">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          {campaign.status === "Draft" ? (
            <Link href="/send">
              <Button className="rounded-[10px]">Continue editing</Button>
            </Link>
          ) : (
            <Link href="/send">
              <Button variant="outline" className="rounded-[10px]">
                <Copy className="h-4 w-4" />
                Duplicate
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-5">
          <Card className="rounded-[12px] p-5">
            <h2 className="text-[15px] font-semibold text-foreground">Summary</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { label: "Type", value: campaign.type, icon: Tag, tone: "bg-emerald-50 text-emerald-600" },
                { label: "Audience", value: campaign.audience, icon: Users, tone: "bg-sky-50 text-sky-600" },
                {
                  label: "Scheduled",
                  value: formatDateTime(campaign.scheduledAt),
                  icon: CalendarDays,
                  tone: "bg-violet-50 text-violet-600",
                },
                {
                  label: "Segments per message",
                  value: `${segments.segments} (${segments.characters} characters)`,
                  icon: MessageSquare,
                  tone: "bg-amber-50 text-amber-600",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-3 rounded-[10px] border border-border bg-muted/30 px-3 py-3"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] ${item.tone}`}
                  >
                    <item.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-[13px] font-semibold text-foreground">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-[12px] p-5">
            <h2 className="text-[15px] font-semibold text-foreground">Message preview</h2>
            <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_180px] lg:items-start">
              <div>
                <div className="max-w-md rounded-2xl rounded-bl-md bg-emerald-50 px-4 py-3 text-[13px] leading-relaxed text-emerald-950">
                  {campaign.body}
                </div>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Preview includes compliance footer. Merge tags render at send time.
                </p>
              </div>
              <div className="mx-auto w-[150px]">
                <div className="rounded-[28px] border-[6px] border-slate-800 bg-slate-900 p-2 shadow-lg">
                  <div className="mb-2 flex justify-center">
                    <span className="h-1.5 w-10 rounded-full bg-slate-700" />
                  </div>
                  <div className="min-h-[220px] rounded-[18px] bg-slate-100 p-2.5">
                    <p className="mb-2 text-center text-[9px] font-semibold text-slate-500">
                      Messages
                    </p>
                    <div className="rounded-2xl rounded-bl-md bg-primary px-2.5 py-2 text-[10px] leading-snug text-primary-foreground">
                      {campaign.body}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {primaryStats.map((stat) => (
              <div key={stat.label} className="surface rounded-[12px] bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-[22px] font-bold tracking-tight">{stat.value}</p>
                    {stat.hint ? (
                      <p className="mt-1 text-[12px] font-medium text-emerald-600">{stat.hint}</p>
                    ) : null}
                  </div>
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-[8px] ${stat.tone}`}
                  >
                    <stat.icon className="h-4 w-4" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Reply rate", value: formatPercent(replyRate), icon: Reply, tone: "bg-sky-100 text-sky-700" },
              {
                label: "Click rate",
                value: formatPercent(clickRate),
                icon: MousePointerClick,
                tone: "bg-violet-100 text-violet-700",
              },
              {
                label: "Opt-out rate",
                value: formatPercent(optOutRate),
                icon: UserMinus,
                tone: "bg-orange-100 text-orange-700",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="surface flex items-center gap-3 rounded-[12px] bg-card p-4"
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-[8px] ${item.tone}`}>
                  <item.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[12px] text-muted-foreground">{item.label}</p>
                  <p className="text-[16px] font-bold">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <Card className="rounded-[12px] p-5">
            <h2 className="text-[15px] font-semibold text-foreground">Timeline</h2>
            <ol className="mt-4 space-y-4">
              {timeline.map((event, idx) => (
                <li key={event.label} className="relative pl-8">
                  {idx < timeline.length - 1 ? (
                    <span className="absolute left-[11px] top-6 h-[calc(100%-8px)] w-px bg-emerald-200" />
                  ) : null}
                  <span className="absolute left-0 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-[13px] font-semibold text-foreground">{event.label}</p>
                  <p className="text-[12px] text-muted-foreground">{formatDateTime(event.at)}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{event.detail}</p>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="rounded-[12px] p-5">
            <h2 className="text-[15px] font-semibold text-foreground">Cost breakdown</h2>
            <dl className="mt-4 space-y-3 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Messages sent</dt>
                <dd className="font-medium">{formatNumber(campaign.sent)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Segments per message</dt>
                <dd className="font-medium">{segments.segments}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Rate per segment</dt>
                <dd className="font-medium">$0.015</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-3">
                <dt className="font-semibold">Total cost</dt>
                <dd className="text-[15px] font-bold">{formatCurrency(campaign.cost)}</dd>
              </div>
            </dl>
          </Card>

          <Card className="rounded-[12px] p-5">
            <h2 className="text-[15px] font-semibold text-foreground">Activity log</h2>
            {activity.length === 0 ? (
              <p className="mt-4 text-[13px] text-muted-foreground">
                No activity recorded for this campaign yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {activity.map((log) => (
                  <li key={log.id} className="rounded-[10px] border border-border px-3 py-2.5">
                    <p className="text-[13px] font-semibold">{log.event}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {log.actor} · {formatDateTime(log.at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:underline"
            >
              View full activity log
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}
