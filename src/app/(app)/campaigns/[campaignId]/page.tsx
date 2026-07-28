import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
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
  Clock,
  MessageSquare,
  MousePointerClick,
  Reply,
  UserMinus,
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
        ? new Date(
            new Date(campaign.scheduledAt).getTime() - 86400000 * 2,
          ).toISOString()
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

  if (campaign.status === "Sending" || campaign.status === "Completed" || campaign.status === "Failed") {
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
        ? new Date(
            new Date(campaign.scheduledAt).getTime() + 3600000,
          ).toISOString()
        : "2026-07-20T11:00:00Z",
      detail: `${formatNumber(campaign.delivered)} delivered · ${formatNumber(campaign.replies)} replies`,
    });
  }

  if (campaign.status === "Failed") {
    events.push({
      label: "Send failed",
      at: campaign.scheduledAt
        ? new Date(
            new Date(campaign.scheduledAt).getTime() + 1800000,
          ).toISOString()
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

  return (
    <div>
      <PageHeader
        title={campaign.name}
        description={`${campaign.type} campaign · ${campaign.audience}`}
        actions={
          <>
            <Link href="/campaigns">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            {campaign.status === "Draft" ? (
              <Link href="/send">
                <Button>Continue editing</Button>
              </Link>
            ) : (
              <Link href="/send">
                <Button variant="outline">Duplicate</Button>
              </Link>
            )}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusChip status={campaign.status} />
        <span className="text-sm text-muted-foreground">
          Created by {campaign.createdBy}
        </span>
        {campaign.scheduledAt ? (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {formatDateTime(campaign.scheduledAt)}
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardTitle>Summary</CardTitle>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Type
                </dt>
                <dd className="mt-1 text-sm font-medium">{campaign.type}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Audience
                </dt>
                <dd className="mt-1 text-sm font-medium">{campaign.audience}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Scheduled
                </dt>
                <dd className="mt-1 text-sm font-medium">
                  {formatDateTime(campaign.scheduledAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Segments per message
                </dt>
                <dd className="mt-1 text-sm font-medium">
                  {segments.segments} ({segments.characters} characters)
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardTitle>Message preview</CardTitle>
            <div className="mt-4 max-w-sm">
              <div className="rounded-2xl rounded-bl-sm bg-primary/10 px-4 py-3 text-sm leading-relaxed">
                {campaign.body}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Preview includes compliance footer. Merge tags render at send time.
              </p>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Sent" value={formatNumber(campaign.sent)} />
            <StatCard
              label="Delivered"
              value={formatNumber(campaign.delivered)}
              hint={formatPercent(deliveryRate)}
            />
            <StatCard
              label="Replies"
              value={formatNumber(campaign.replies)}
              hint={formatPercent(replyRate)}
            />
            <StatCard
              label="Clicks"
              value={formatNumber(campaign.clicks)}
              hint={formatPercent(clickRate)}
            />
            <StatCard
              label="Opt-outs"
              value={formatNumber(campaign.optOuts)}
              hint={formatPercent(optOutRate)}
            />
            <StatCard label="Cost" value={formatCurrency(campaign.cost)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="flex items-center gap-3">
              <div className="rounded-lg bg-sky-100 p-2 text-sky-800">
                <Reply className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Reply rate</p>
                <p className="font-display text-lg font-semibold">
                  {formatPercent(replyRate)}
                </p>
              </div>
            </Card>
            <Card className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-100 p-2 text-violet-800">
                <MousePointerClick className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Click rate</p>
                <p className="font-display text-lg font-semibold">
                  {formatPercent(clickRate)}
                </p>
              </div>
            </Card>
            <Card className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-100 p-2 text-orange-800">
                <UserMinus className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Opt-out rate</p>
                <p className="font-display text-lg font-semibold">
                  {formatPercent(optOutRate)}
                </p>
              </div>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>Timeline</CardTitle>
            <ol className="mt-4 space-y-4">
              {timeline.map((event, idx) => (
                <li key={idx} className="relative pl-6">
                  {idx < timeline.length - 1 ? (
                    <span className="absolute left-[7px] top-5 h-full w-px bg-border" />
                  ) : null}
                  <span className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-primary bg-card" />
                  <p className="text-sm font-medium">{event.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(event.at)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <CardTitle>Cost breakdown</CardTitle>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Messages sent</dt>
                <dd className="font-medium">{formatNumber(campaign.sent)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Segments per message</dt>
                <dd className="font-medium">{segments.segments}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Rate per segment</dt>
                <dd className="font-medium">$0.015</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3">
                <dt className="font-medium">Total cost</dt>
                <dd className="font-display font-semibold">
                  {formatCurrency(campaign.cost)}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <CardTitle>Activity log</CardTitle>
            </div>
            {activity.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No activity recorded for this campaign yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {activity.map((log) => (
                  <li
                    key={log.id}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <p className="font-medium">{log.event}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {log.actor} · {formatDateTime(log.at)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{log.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
